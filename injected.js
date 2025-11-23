// injected.js - runs in page context, automates Telegram UI

console.log("Injected.js: Loaded");

// --- Helpers ---
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function waitForSelector(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el2 = document.querySelector(selector);
      if (el2) {
        observer.disconnect();
        resolve(el2);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for: ${selector}`));
    }, timeout);
  });
}

// --- Step 1: Open context menu for a message ---
// --- Step 1: Open context menu via right-click ---
async function openMenuForMessage(messageEl) {
  console.log("Injected.js: right-clicking message to open menu…");

  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 2, // right-click
  });

  messageEl.dispatchEvent(event);

  // Wait for the bubble menu to appear
  const menu = await waitForSelector('.bubble.menu-container.open');
  return menu;
}

// --- Step 2: Click the 'Delete' option ---
async function clickDeleteInMenu(menu) {
  const deleteBtn = [...menu.querySelectorAll(".MenuItem")].find((el) =>
    /delete/i.test(el.textContent)
  );

  if (!deleteBtn) {
    console.error("Injected.js: Delete button not found in context menu");
    return;
  }

  deleteBtn.click();
}

// --- Step 3: Delete Dialog ---
async function confirmDeleteForEveryone() {
  const dialog = await waitForSelector(".Modal.open");

  // Tick checkbox: "Also delete for Telegram"
  const checkbox = dialog.querySelector(
    'label.Checkbox.dialog-checkbox input[type="checkbox"]'
  );
  if (checkbox && !checkbox.checked) {
    checkbox.click();
  }

  await sleep(50);

  // Click final Delete button
  const deleteBtn = [...dialog.querySelectorAll("button")].find((el) =>
    /delete/i.test(el.textContent)
  );

  if (deleteBtn) deleteBtn.click();
}

// --- Full pipeline ---
async function deleteMessageById(messageId) {

  // Fix fractional IDs like 145.000001 → 145
  const normalizedId = String(messageId).split('.')[0];

  const selector = `[data-message-id="${normalizedId}"], #message-${normalizedId}`;
  const messageEl = document.querySelector(selector);

  if (!messageEl) {
    console.warn("Injected.js: Message not found", normalizedId);
    return;
  }

  console.log("Injected.js: Deleting message", normalizedId);

  const menu = await openMenuForMessage(messageEl);
  if (!menu) return;

  await clickDeleteInMenu(menu);
  await sleep(50);

  await confirmDeleteForEveryone();

  console.log("Injected.js: Message deleted:", normalizedId);
}

// --- Listen for messages from content.js ---
window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  if (e.data?.type === "DELETE_MESSAGE") {
    deleteMessageById(e.data.messageId);
  }
});