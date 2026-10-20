"use strict";

const WA_URL_PATTERN = "https://web.whatsapp.com/*";
const WA_ORIGIN = "https://web.whatsapp.com/";
const pendingNavigations = new Map();

function bringWindowForward(windowId) {
  if (!Number.isInteger(windowId)) return;
  chrome.windows.update(windowId, { state: "normal", focused: true }, () => {
    void chrome.runtime.lastError;
  });
}

// Diagnostic only: records navigation timing without logging customer numbers or message text.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const startedAt = pendingNavigations.get(tabId);
  if (!startedAt) return;

  if (changeInfo.status === "loading") {
    console.info("[Aqua WA test] WhatsApp navigation started.");
  }

  if (changeInfo.status === "complete") {
    console.info("[Aqua WA test] WhatsApp page completed in", Date.now() - startedAt, "ms.");
    pendingNavigations.delete(tabId);
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (!request || request.type !== "AQUA_WA_OPEN_SINGLE_TAB") return;

  const phone = String(request.phone || "").replace(/[^0-9]/g, "");
  if (!phone) return;

  const message = String(request.message || "");
  const url = WA_ORIGIN + "send?phone=" +
    encodeURIComponent(phone) + "&text=" + encodeURIComponent(message);

  chrome.tabs.query({ url: WA_URL_PATTERN }, (tabs) => {
    if (chrome.runtime.lastError) return;

    const existing = tabs && tabs.length ? tabs[0] : null;
    if (existing && Number.isInteger(existing.id)) {
      pendingNavigations.set(existing.id, Date.now());
      console.info("[Aqua WA test] Reusing existing WhatsApp tab.");
      chrome.tabs.update(existing.id, { url: url, active: true }, (updatedTab) => {
        if (chrome.runtime.lastError) {
          pendingNavigations.delete(existing.id);
          return;
        }
        bringWindowForward((updatedTab && updatedTab.windowId) || existing.windowId);
      });
    } else {
      console.info("[Aqua WA test] No WhatsApp tab found; opening one.");
      chrome.tabs.create({ url: url, active: true }, (newTab) => {
        if (chrome.runtime.lastError) return;
        if (newTab) {
          pendingNavigations.set(newTab.id, Date.now());
          bringWindowForward(newTab.windowId);
        }
      });
    }
  });
});
