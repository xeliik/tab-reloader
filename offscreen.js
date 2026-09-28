let intervalId = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "start_timer") {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      chrome.runtime.sendMessage({ action: "tick" });
    }, msg.interval * 1000);
  } else if (msg.action === "stop_timer") {
    clearInterval(intervalId);
    intervalId = null;
  }
});