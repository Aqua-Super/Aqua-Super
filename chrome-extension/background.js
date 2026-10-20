"use strict";

const WA_URL_PATTERN = "https://web.whatsapp.com/*";
const WA_ORIGIN = "https://web.whatsapp.com/";

function bringWindowForward(windowId) {
  if (!Number.isInteger(windowId)) return;
  chrome.windows.update(windowId, { state: "normal", focused: true }, () => {
    void chrome.runtime.lastError;
  });
}

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
      console.info("[Aqua WA test] Trying SPA navigation in existing WhatsApp tab.");
      chrome.tabs.update(existing.id, { active: true }, () => {
        if (chrome.runtime.lastError) return;
        chrome.scripting.executeScript({
          target: { tabId: existing.id },
          func: (targetUrl) => {
            // Experimental: ask WhatsApp's single-page app to handle the route
            // without navigating the whole document.
            const target = new URL(targetUrl);
            history.pushState({}, "", target.pathname + target.search);
            window.dispatchEvent(new PopStateEvent("popstate"));
          },
          args: [url]
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn("[Aqua WA test] SPA navigation could not be injected.");
          } else {
            console.info("[Aqua WA test] SPA navigation request sent; verify the correct chat opens.");
          }
        });
        bringWindowForward(existing.windowId);
      });
    } else {
      console.info("[Aqua WA test] No WhatsApp tab found; opening a new tab normally.");
      chrome.tabs.create({ url: url, active: true }, (newTab) => {
        if (chrome.runtime.lastError || !newTab) return;
        bringWindowForward(newTab.windowId);
      });
    }
  });
});
