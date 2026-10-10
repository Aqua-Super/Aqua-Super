"use strict";

chrome.runtime.onMessage.addListener((request) => {
  if (!request || request.type !== "AQUA_WA_OPEN_SINGLE_TAB") return;

  const phone = String(request.phone || "").replace(/[^0-9]/g, "");
  if (!phone) return;

  const message = String(request.message || "");
  const url = "https://web.whatsapp.com/send?phone=" +
    encodeURIComponent(phone) + "&text=" + encodeURIComponent(message);

  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
    if (chrome.runtime.lastError) return;

    // Reuse an existing WhatsApp Web tab; do not create a new one for each customer.
    const existing = tabs && tabs.length ? tabs[0] : null;
    if (existing && Number.isInteger(existing.id)) {
      chrome.tabs.update(existing.id, { url: url, active: true }, () => {
        void chrome.runtime.lastError;
      });
    } else {
      chrome.tabs.create({ url: url, active: true }, () => {
        void chrome.runtime.lastError;
      });
    }
  });
});
