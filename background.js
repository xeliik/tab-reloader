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
      let shouldReload = false;

      // Apply the manually tested latency offset
      const latencyOffset = (config.chkLatency && data.measuredLatency) ? data.measuredLatency : 0;

      let targetsUpdated = false;
      if (config.chkScheduled && data.scheduledTargets) {
        for (const [timeStr, targetTimestamp] of Object.entries(data.scheduledTargets)) {
          if (now >= (targetTimestamp - latencyOffset)) {
            shouldReload = true;
            if (config.chkInterval) data.nextIntervalTick = targetTimestamp + (config.intervalSecs * 1000);
            data.scheduledTargets[timeStr] = targetTimestamp + (24 * 60 * 60 * 1000);
            targetsUpdated = true;
          }
        }
        if (targetsUpdated) chrome.storage.local.set({ scheduledTargets: data.scheduledTargets, nextIntervalTick: data.nextIntervalTick });
      }

      if (config.chkInterval && data.nextIntervalTick && now >= (data.nextIntervalTick - latencyOffset)) {
        shouldReload = true;
        data.nextIntervalTick = data.nextIntervalTick + (config.intervalSecs * 1000);
        chrome.storage.local.set({ nextIntervalTick: data.nextIntervalTick });
      }

      if (shouldReload) {
        updateNextReloadTime(config, data.nextIntervalTick, data.scheduledTargets);
        let baseQuery = {};
        if (config.windowScope === 'current') baseQuery.currentWindow = true;

        if (config.tabScope === 'active') {
          chrome.tabs.query({ ...baseQuery, active: true }, (tabs) => {
            tabs.forEach(tab => chrome.tabs.reload(tab.id));
          });
        } 
        else if (config.tabScope === 'all') {
          chrome.tabs.query(baseQuery, (tabs) => {
            tabs.forEach(tab => chrome.tabs.reload(tab.id));
          });
        }
        if (config.chkUrl && config.urlPattern) {
          chrome.tabs.query(baseQuery, (tabs) => {
            tabs.forEach(tab => {
              if (tab.url && tab.url.includes(config.urlPattern)) chrome.tabs.reload(tab.id);
            });
          });
        }
      }
    });
  }
});