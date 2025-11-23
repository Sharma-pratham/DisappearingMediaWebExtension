// content.js — runs inside Telegram Web tab

console.log("Content: loaded on", location.href);

// ------------------------------------------------------------
// 1) Inject injected.js
// ------------------------------------------------------------
(function inject() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = () => {
    console.log("Content: injected.js added to page");
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
})();

// ------------------------------------------------------------
// 2) Detect current chat ID from URL hash (#123456)
// ------------------------------------------------------------
function getChatId() {
  const hash = location.hash.replace("#", "");
  if (!hash) return null;
  return hash;
}

// ------------------------------------------------------------
// 3) Identify message list container
// ------------------------------------------------------------
function findMessageList() {
  return document.querySelector(
    ".MessageList, .messages-container, div.messages-container"
  );
}

// ------------------------------------------------------------
// 4) Detect media messages in the DOM
// ------------------------------------------------------------
function isMediaMessage(msgEl) {
  // Telegram marks media messages with:
  //   .media OR <img> inside .media-inner
  if (msgEl.querySelector(".media-inner img, img.full-media")) return true;
  return false;
}

// ------------------------------------------------------------
// 5) Observe new messages and schedule deletion
// ------------------------------------------------------------
function startMessageObserver() {
  console.log("Content: attempting to locate message list…");

  const list = findMessageList();
  if (!list) {
    console.log("Content: MessageList not found, retrying…");
    setTimeout(startMessageObserver, 500);
    return;
  }

  console.log("Content: MessageList found, starting observer…", list);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (!node.matches(".Message")) continue;

        const msgId = node.dataset.messageId;
        const chatId = getChatId();

        console.log("Content: new message detected", { chatId, msgId });

        if (!chatId || !msgId) continue;

        if (isMediaMessage(node)) {
          console.log("Content: NEW MEDIA message detected", {
            chatId,
            msgId,
          });

          chrome.storage.sync.get(
            { enableGlobal: true, timeout: 10 },
            (cfg) => {
              console.log("Content: loaded config", cfg);

              if (!cfg.enableGlobal) {
                console.log("Content: global disabling active, skipping media");
                return;
              }

              console.log("Content: sending SCHEDULE_DELETE_MEDIA", {
                chatId,
                msgId,
                timeout: cfg.timeout,
              });

              chrome.runtime.sendMessage({
                type: "SCHEDULE_DELETE_MEDIA",
                payload: { chatId, msgId, timeout: cfg.timeout },
              });
            }
          );
        }
      }
    }
  });

  observer.observe(list, {
    childList: true,
    subtree: true,
  });

  console.log("Content: observer active");
}

// ------------------------------------------------------------
// 6) Listen for background → delete request
// ------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "DELETE_MESSAGE_UI") {
    console.log(
      "Content: forwarding deletion to injected.js for messageId",
      msg.messageId
    );

    window.postMessage(
      {
        type: "DELETE_MESSAGE",
        messageId: msg.messageId,
      },
      "*"
    );
  }
});

// ------------------------------------------------------------
// 7) Start the whole process
// ------------------------------------------------------------
startMessageObserver();