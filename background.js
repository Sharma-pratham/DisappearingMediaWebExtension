// background.js - scheduling deletion for Telegram Web (DOM automation via content script)

console.log("Background: service worker loaded");

// Listen for scheduling requests from injected/content
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background: received message", message, sender);

  if (message.type === "SCHEDULE_DELETE_MEDIA") {
    const { chatId, msgId, timeout } = message.payload;

    console.log(
      `Background: scheduling deletion for chatId=${chatId}, msgId=${msgId}, timeout=${timeout}s`
    );

    const when = Date.now() + timeout * 1000;
    const alarmName = `del-${chatId}-${msgId}`;

    chrome.alarms.create(alarmName, { when });

    chrome.storage.local.set(
      { [alarmName]: { chatId, msgId } },
      () => console.log("Background: stored alarm info", alarmName)
    );
  }
});

// When a timer fires
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log("Background: alarm triggered", alarm.name);

  chrome.storage.local.get(alarm.name, (obj) => {
    const info = obj[alarm.name];
    if (!info) {
      console.warn("Background: no stored info for alarm", alarm.name);
      return;
    }

    console.log("Background: retrieved alarm info", info);

    // send DOM-based deletion request to the tab
    triggerDeleteInPage(info.msgId);

    chrome.storage.local.remove(alarm.name, () => {
      console.log("Background: removed alarm storage", alarm.name);
    });
  });
});

// Send a message to the Telegram tab; content.js will forward it into the page
function triggerDeleteInPage(messageId) {
  console.log("Background: triggering UI deletion for", messageId);

  chrome.tabs.query({ url: "https://web.telegram.org/*" }, (tabs) => {
    console.log("Background: tabs", tabs);

    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: "DELETE_MESSAGE_UI",
        messageId,
      });
    }
  });
}