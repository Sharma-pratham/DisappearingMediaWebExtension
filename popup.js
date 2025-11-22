document.addEventListener("DOMContentLoaded", () => {
  const ttlInput = document.getElementById("ttlInput");
  const armNextCheckbox = document.getElementById("armNext");
  const applyBtn = document.getElementById("applyBtn");
  const statusEl = document.getElementById("status");

  // Load stored config
  chrome.storage.sync.get(["ttlSeconds"], (data) => {
    if (Number.isFinite(data.ttlSeconds)) {
      ttlInput.value = data.ttlSeconds;
    }
  });

  applyBtn.addEventListener("click", () => {
    const ttl = parseInt(ttlInput.value, 10);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      statusEl.textContent = "Enter a positive TTL (seconds).";
      statusEl.style.color = "#c0392b";
      return;
    }

    const armNext = armNextCheckbox.checked;

    chrome.storage.sync.set({ ttlSeconds: ttl }, () => {
      statusEl.textContent = armNext
        ? `Armed: next photo will have TTL = ${ttl}s.`
        : `TTL set to ${ttl}s.`;

      statusEl.style.color = "#2a7a1f";

      // Notify active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id) return;
        chrome.tabs.sendMessage(tab.id, {
          type: "ARM_DISAPPEARING_PHOTO",
          payload: {
            ttlSeconds: ttl,
            armNext: armNext
          }
        });
      });
    });
  });
});