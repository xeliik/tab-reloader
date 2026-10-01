let scheduledTimes = [];

function saveDraftState() {
  chrome.storage.local.set({
    draftConfig: {
      pingHost: document.getElementById('pingHost').value,
      tabScope: document.querySelector('input[name="tabScope"]:checked').value,
      windowScope: document.querySelector('input[name="windowScope"]:checked').value,
      chkInterval: document.getElementById('chkInterval').checked,
      intervalSecs: parseFloat(document.getElementById('intervalSecs').value) || 0,
      chkScheduled: document.getElementById('chkScheduled').checked,
      scheduledTimes: scheduledTimes,
      chkCountdown: document.getElementById('chkCountdown').checked,
      chkLatency: document.getElementById('chkLatency').checked
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['draftConfig', 'measuredLatency'], (data) => {
    if (data.draftConfig) {
      document.getElementById('pingHost').value = data.draftConfig.pingHost || '';
      if (data.draftConfig.tabScope) document.querySelector(`input[name="tabScope"][value="${data.draftConfig.tabScope}"]`).checked = true;
      if (data.draftConfig.windowScope) document.querySelector(`input[name="windowScope"][value="${data.draftConfig.windowScope}"]`).checked = true;
      document.getElementById('chkInterval').checked = data.draftConfig.chkInterval || false;
      document.getElementById('intervalSecs').value = data.draftConfig.intervalSecs || '';
      document.getElementById('chkScheduled').checked = data.draftConfig.chkScheduled || false;
      document.getElementById('chkCountdown').checked = data.draftConfig.chkCountdown !== false;
      document.getElementById('chkLatency').checked = data.draftConfig.chkLatency || false;
      
      scheduledTimes = data.draftConfig.scheduledTimes || [];
      renderTimeList();
      ['chkInterval', 'chkScheduled'].forEach(id => document.getElementById(id).dispatchEvent(new Event('change')));
    }
    if (data.measuredLatency) {
      document.getElementById('pingResult').textContent = `${data.measuredLatency} ms`;
    }
  });
});

['pingHost', 'chkInterval', 'chkScheduled', 'intervalSecs', 'chkCountdown', 'chkLatency'].forEach(id => {
  document.getElementById(id).addEventListener('change', saveDraftState);
});
document.querySelectorAll('input[type="radio"]').forEach(radio => radio.addEventListener('change', saveDraftState));

document.getElementById('chkInterval').addEventListener('change', (e) => document.getElementById('intervalGroup').classList.toggle('hidden', !e.target.checked));
document.getElementById('chkScheduled').addEventListener('change', (e) => document.getElementById('scheduledGroup').classList.toggle('hidden', !e.target.checked));

const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/;

document.getElementById('addTimeBtn').addEventListener('click', () => {
  const t = document.getElementById('timeInput').value.trim();
  if (timeRegex.test(t) && !scheduledTimes.includes(t)) {
    scheduledTimes.push(t);
    document.getElementById('timeInput').value = '';
    renderTimeList();
    saveDraftState();
  }
});

function renderTimeList() {
  const list = document.getElementById('timeList');
  list.innerHTML = '';
  scheduledTimes.forEach((t, index) => {
    const li = document.createElement('li');
    li.textContent = t;
    const del = document.createElement('button');
    del.textContent = 'X';
    del.onclick = () => { scheduledTimes.splice(index, 1); renderTimeList(); saveDraftState(); };
    li.appendChild(del);
    list.appendChild(li);
  });
}

// Test Server Latency
document.getElementById('testPingBtn').addEventListener('click', async () => {
  const hostInput = document.getElementById('pingHost').value.trim();
  if (!hostInput) return alert('Enter a URL or IP to ping (e.g., example.com)');
  
  const targetUrl = hostInput.startsWith('http') ? hostInput : `https://${hostInput}`;
  const resultSpan = document.getElementById('pingResult');
  resultSpan.textContent = '...';
  
  try {
    const start = performance.now();
    await fetch(targetUrl, { method: 'HEAD', cache: 'no-store' });
    const end = performance.now();
    const latency = Math.round(end - start);
    
    resultSpan.textContent = `${latency} ms`;
    chrome.storage.local.set({ measuredLatency: latency });
  } catch (error) {
    resultSpan.textContent = 'Fail';
    chrome.storage.local.set({ measuredLatency: 0 });
    alert("Could not reach the server. Ensure the address is valid.");
  }
});

document.getElementById('startBtn').addEventListener('click', () => {
  saveDraftState();
  chrome.storage.local.get(['draftConfig'], (data) => {
    chrome.storage.local.set({ config: data.draftConfig, isRunning: true }, () => {
      chrome.runtime.sendMessage({ action: "start_engine" });
    });
  });
});

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.storage.local.set({ isRunning: false, nextReloadTime: null }, () => {
    chrome.runtime.sendMessage({ action: "stop_engine" });
  });
});

setInterval(() => {
  chrome.storage.local.get(['isRunning', 'nextReloadTime'], (data) => {
    const display = document.getElementById('countdownContainer');
    if (data.isRunning && data.nextReloadTime) {
      let diffMs = Math.max(0, data.nextReloadTime - Date.now());
      const hrs = Math.floor(diffMs / 3600000);
      diffMs %= 3600000;
      const mins = Math.floor(diffMs / 60000);
      diffMs %= 60000;
      const secs = Math.floor(diffMs / 1000);
      const ms = diffMs % 1000;
      display.textContent = (hrs > 0 ? hrs + ':' : '') + mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0') + '.' + ms.toString().padStart(3, '0');
    } else {
      display.textContent = "--:--:--.---";
    }
  });
}, 45);