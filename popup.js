// popup.js — UI logic with logging

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup: DOMContentLoaded');
  const enableGlobal = document.getElementById('enableGlobal');
  const timeoutInput = document.getElementById('timeout');
  const saveBtn = document.getElementById('save');

  chrome.storage.sync.get({ enableGlobal: true, timeout: 30 }, items => {
    console.log('Popup: loaded settings', items);
    enableGlobal.checked = items.enableGlobal;
    timeoutInput.value = items.timeout;
  });

  saveBtn.addEventListener('click', () => {
    const enableVal = enableGlobal.checked;
    const timeoutVal = parseInt(timeoutInput.value, 10) || 30;
    chrome.storage.sync.set({ enableGlobal: enableVal, timeout: timeoutVal }, () => {
      console.log('Popup: saved settings', { enableGlobal: enableVal, timeout: timeoutVal });
      alert('Settings saved');
    });
  });
});