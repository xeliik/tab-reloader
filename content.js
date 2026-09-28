// Create the floating timer element
const timerDiv = document.createElement('div');
timerDiv.id = 'smart-reloader-floating-timer';
Object.assign(timerDiv.style, {
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  padding: '10px 15px',
  background: 'rgba(0, 0, 0, 0.8)',
  color: '#ff5252',
  fontSize: '24px',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  borderRadius: '8px',
  zIndex: '9999999',
  pointerEvents: 'none', // Lets you click through it
  display: 'none',
  fontVariantNumeric: 'tabular-nums'
});
document.body.appendChild(timerDiv);

// Loop to update the floating timer continuously
const intervalId = setInterval(() => {
  try {
    // If the context is invalidated, calling chrome.storage.local will throw an error immediately
    chrome.storage.local.get(['isRunning', 'nextReloadTime', 'config'], (data) => {
      
      // Safety check for asynchronous Chrome API errors
      if (chrome.runtime.lastError) return;

      // Only show if running, timer exists, AND the checkbox is ticked
      if (data.isRunning && data.nextReloadTime && data.config?.chkCountdown) {
        let diffMs = Math.max(0, data.nextReloadTime - Date.now());
        
        const hrs = Math.floor(diffMs / 3600000);
        diffMs %= 3600000;
        const mins = Math.floor(diffMs / 60000);
        diffMs %= 60000;
        const secs = Math.floor(diffMs / 1000);
        const ms = diffMs % 1000;
        
        timerDiv.textContent = (hrs > 0 ? hrs + ':' : '') + 
                               mins.toString().padStart(2, '0') + ':' + 
                               secs.toString().padStart(2, '0') + '.' +
                               ms.toString().padStart(3, '0');
        timerDiv.style.display = 'block';
      } else {
        timerDiv.style.display = 'none';
      }
    });
  } catch (error) {
    // Catch the invalidation error, stop the loop, and clean up the DOM
    if (error.message.includes('Extension context invalidated')) {
      clearInterval(intervalId);
      if (timerDiv.parentNode) {
        timerDiv.parentNode.removeChild(timerDiv);
      }
    } else {
      console.error("Smart Reloader Error:", error);
    }
  }
}, 45);
