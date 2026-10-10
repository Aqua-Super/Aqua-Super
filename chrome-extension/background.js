"use strict";

function bringWindowForward(windowId) {
  if (!Number.isInteger(windowId)) return;
  chrome.windows.update(windowId, { state: "normal", focused: true }, () => {
    // Read lastError so expected browser restrictions do not become uncaught errors.
    void chrome.runtime.lastError;
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (!request || request.type !== "AQUA_WA_OPEN_SINGLE_TAB") return;

  const phone = String(request.phone || "").replace(/[^0-9]/g, "");
  if (!phone) return;

  const message = String(request.message || "");
  const url = "https://web.whatsapp.com/send?phone=" +
    encodeURIComponent(phone) + "&text=" + encodeURIComponent(message);

  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
    if (chrome.runtime.lastError) return;

    // Prefer an existing WhatsApp Web tab, including a tab in an installed app window.
    const existing = tabs && tabs.length ? tabs[0] : null;
    if (existing && Number.isInteger(existing.id)) {
      chrome.tabs.update(existing.id, { url: url, active: true }, (updatedTab) => {
        if (chrome.runtime.lastError) return;
        bringWindowForward((updatedTab && updatedTab.windowId) || existing.windowId);
      });
    } else {
      chrome.tabs.create({ url: url, active: true }, (newTab) => {
        if (chrome.runtime.lastError) return;
        if (newTab) bringWindowForward(newTab.windowId);
      });
    }
  });
});
