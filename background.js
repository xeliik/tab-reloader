async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['DOM_SCRAPING'], justification: 'Timers' });
  await new Promise(resolve => setTimeout(resolve, 300)); 
}

function parseToTimestamp(timeStr) {
  const match = timeStr.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/);
  if (!match) return 0;
  const hh = parseInt(match[1], 10), mm = parseInt(match[2], 10), ss = match[3] ? parseInt(match[3], 10) : 0, mmm = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;
  const d = new Date(); d.setHours(hh, mm, ss, mmm);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function updateNextReloadTime(config, nextIntervalTick, scheduledTargets) {
  let times = [];
  if (config.chkInterval && nextIntervalTick) times.push(nextIntervalTick);
  if (config.chkScheduled && scheduledTargets) times.push(...Object.values(scheduledTargets));
  const nextTime = times.length > 0 ? Math.min(...times) : null;
  chrome.storage.local.set({ nextReloadTime: nextTime });
}

// Cleaned up executeReloads: No more URL filtering
function executeReloads(config) {
  let baseQuery = {};
  if (config.windowScope === 'current') baseQuery.currentWindow = true;

  chrome.tabs.query(baseQuery, (tabs) => {
    tabs.forEach(tab => {
      let shouldReload = false;
      if (config.tabScope === 'all') {
        shouldReload = true;
      } else if (config.tabScope === 'active' && tab.active) {
        shouldReload = true;
      }
      
      if (shouldReload) chrome.tabs.reload(tab.id);
    });
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "start_engine") {
    chrome.storage.local.get(['config'], async (data) => {
      await setupOffscreenDocument();
      const config = data.config;
      let nextIntervalTick = null;
      if (config.chkInterval && !config.chkScheduled) {
        nextIntervalTick = Date.now() + (config.intervalSecs * 1000);
      }
      let scheduledTargets = {};
      if (config.chkScheduled) {
        config.scheduledTimes.forEach(t => { scheduledTargets[t] = parseToTimestamp(t); });
      }
      
      chrome.storage.local.set({ nextIntervalTick, scheduledTargets });
      updateNextReloadTime(config, nextIntervalTick, scheduledTargets);
      chrome.runtime.sendMessage({ action: "start_timer", interval: 0.05 }).catch(()=>{}); 
    });
  }

  if (message.action === "stop_engine") {
     chrome.runtime.sendMessage({ action: "stop_timer" }).catch(()=>{});
     chrome.offscreen.closeDocument().catch(()=>{});
  }

  if (message.action === "tick") {
    chrome.storage.local.get(['isRunning', 'config', 'nextIntervalTick', 'scheduledTargets', 'measuredLatency'], (data) => {
      if (!data.isRunning || !data.config) return;
      const config = data.config;
      const now = Date.now();
      
      // Still accurately dividing measured latency by 2 for the one-way offset
      const latencyOffset = (config.chkLatency && data.measuredLatency) ? Math.round(data.measuredLatency / 2) : 0;
      let targetsUpdated = false;

      if (config.chkScheduled && data.scheduledTargets) {
        for (const [timeStr, targetTimestamp] of Object.entries(data.scheduledTargets)) {
          const exactFireTime = targetTimestamp - latencyOffset;
          const msUntilFire = exactFireTime - now;

          if (msUntilFire <= 100 && msUntilFire > 0) {
            setTimeout(() => executeReloads(config), msUntilFire);
            
            if (config.chkInterval) data.nextIntervalTick = targetTimestamp + (config.intervalSecs * 1000);
            data.scheduledTargets[timeStr] = targetTimestamp + (24 * 60 * 60 * 1000);
            targetsUpdated = true;
          } 
          else if (msUntilFire <= 0) {
            executeReloads(config);
            if (config.chkInterval) data.nextIntervalTick = targetTimestamp + (config.intervalSecs * 1000);
            data.scheduledTargets[timeStr] = targetTimestamp + (24 * 60 * 60 * 1000);
            targetsUpdated = true;
          }
        }
        if (targetsUpdated) {
          chrome.storage.local.set({ scheduledTargets: data.scheduledTargets, nextIntervalTick: data.nextIntervalTick });
          updateNextReloadTime(config, data.nextIntervalTick, data.scheduledTargets);
        }
      }

      if (config.chkInterval && data.nextIntervalTick) {
        const exactFireTime = data.nextIntervalTick - latencyOffset;
        const msUntilFire = exactFireTime - now;

        if (msUntilFire <= 100 && msUntilFire > 0) {
          setTimeout(() => executeReloads(config), msUntilFire);
          data.nextIntervalTick = data.nextIntervalTick + (config.intervalSecs * 1000);
          chrome.storage.local.set({ nextIntervalTick: data.nextIntervalTick });
          updateNextReloadTime(config, data.nextIntervalTick, data.scheduledTargets);
        } 
        else if (msUntilFire <= 0) {
          executeReloads(config);
          data.nextIntervalTick = data.nextIntervalTick + (config.intervalSecs * 1000);
          chrome.storage.local.set({ nextIntervalTick: data.nextIntervalTick });
          updateNextReloadTime(config, data.nextIntervalTick, data.scheduledTargets);
        }
      }
    });
  }
});