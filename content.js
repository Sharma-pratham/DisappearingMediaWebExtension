console.log("[TG Disappear] content script loaded.");

function injectPageScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.async = false;
  (document.documentElement || document.head || document.body).appendChild(script);
  script.remove();
}

// Inject as soon as possible
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectPageScript);
} else {
  injectPageScript();
}

// Forward config from extension → page via postMessage
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ARM_DISAPPEARING_PHOTO") {
    window.postMessage(
      {
        source: "tg-disappear-ext",
        type: "CONFIG",
        payload: msg.payload
      },
      "*"
    );
  }
});