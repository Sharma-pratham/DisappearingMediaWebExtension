// Runs in the main world of web.telegram.org/a
(function () {
  console.log("[TG Disappear] injected into page.");

  // Shared config in page context
  window.__tgDisappearConfig = {
    ttlSeconds: 10,
    armNext: false
  };

  // Listen for config updates from content script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "tg-disappear-ext") return;

    if (data.type === "CONFIG" && data.payload) {
      const { ttlSeconds, armNext } = data.payload;
      if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
        window.__tgDisappearConfig.ttlSeconds = ttlSeconds;
      }
      if (typeof armNext === "boolean") {
        window.__tgDisappearConfig.armNext = armNext;
      }
      console.log("[TG Disappear] config updated:", window.__tgDisappearConfig);
    }
  });

  // Utility: find the uploadMedia function by scanning window objects
  function findUploadMediaFunction() {
    const visited = new Set();

    function scan(obj, depth) {
      if (!obj || depth > 6) return null; // avoid going too deep
      if (typeof obj !== "object" && typeof obj !== "function") return null;
      if (visited.has(obj)) return null;
      visited.add(obj);

      for (const key in obj) {
        let val;
        try {
          val = obj[key];
        } catch (e) {
          continue;
        }

        if (typeof val === "function") {
          let src;
          try {
            src = Function.prototype.toString.call(val);
          } catch (e) {
            continue;
          }

          // Heuristic: look for the signature of uploadMedia from messages.ts
          if (
            src.includes("INPUT_WAVEFORM_LENGTH") &&
            src.includes("InputMediaUploadedDocument") &&
            src.includes("ttlSeconds")
          ) {
            console.log("[TG Disappear] Found uploadMedia candidate:", key);
            return { owner: obj, key, fn: val };
          }
        } else if (val && (typeof val === "object" || typeof val === "function")) {
          const result = scan(val, depth + 1);
          if (result) return result;
        }
      }

      return null;
    }

    return scan(window, 0);
  }

  function isImageOrVideoMime(mimeType) {
    if (typeof mimeType !== "string") return false;
    return mimeType.startsWith("image/") || mimeType.startsWith("video/");
  }

  function patchUploadMedia() {
    const found = findUploadMediaFunction();
    if (!found) {
      console.warn("[TG Disappear] uploadMedia not found yet, retrying…");
      setTimeout(patchUploadMedia, 2000);
      return;
    }

    const { owner, key, fn: originalUploadMedia } = found;

    if (owner.__tgPatchedUploadMedia) {
      console.log("[TG Disappear] uploadMedia already patched.");
      return;
    }

    owner.__tgPatchedUploadMedia = true;

    owner[key] = async function patchedUploadMedia(message, attachment, onProgress) {
      try {
        const cfg = window.__tgDisappearConfig;
        if (
          cfg &&
          cfg.armNext &&
          attachment &&
          isImageOrVideoMime(attachment.mimeType)
        ) {
          const ttl = cfg.ttlSeconds;
          if (Number.isFinite(ttl) && ttl > 0) {
            console.log(
              "[TG Disappear] Applying TTL",
              ttl,
              "seconds to attachment:",
              attachment
            );

            // Force as document so uploadMedia uses InputMediaUploadedDocument with ttlSeconds
            attachment = Object.assign({}, attachment, {
              ttlSeconds: ttl,
              shouldSendAsFile: true
            });

            // Consume armNext so only the next photo is affected
            cfg.armNext = false;
          }
        }
      } catch (e) {
        console.error("[TG Disappear] Error modifying attachment:", e);
      }

      // Call original uploadMedia
      return originalUploadMedia.call(this, message, attachment, onProgress);
    };

    console.log("[TG Disappear] uploadMedia patched successfully.");
  }

  // Try patching after a short delay to let Telegram init
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(patchUploadMedia, 1000);
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(patchUploadMedia, 1000);
    });
  }
})();