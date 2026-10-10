(function () {
  "use strict";
  const APP_ORIGIN = "https://aqua-super.github.io";

  // Let the PWA know the extension is installed and active.
  window.postMessage({ type: "AQUA_WA_EXTENSION_READY" }, APP_ORIGIN);

  window.addEventListener("message", function (event) {
    if (event.source !== window || event.origin !== APP_ORIGIN) return;
    const data = event.data;
    if (!data || data.type !== "AQUA_WA_OPEN_SINGLE_TAB") return;

    const phone = String(data.phone || "").replace(/[^0-9]/g, "");
    const message = String(data.message || "");
    if (!phone) return;

    chrome.runtime.sendMessage({
      type: "AQUA_WA_OPEN_SINGLE_TAB",
      phone: phone,
      message: message
    });
  });
})();
