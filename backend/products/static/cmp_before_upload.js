/*
 * Resizes/compresses image files in the browser before Django admin's form
 * submits them. Raw phone-camera photos (often 4-8MB) take minutes to
 * transmit over a slow mobile uplink even though server-side processing is
 * fast — shrinking them client-side is the only thing that helps with
 * upload transfer time itself.
 */
(function () {
  "use strict";

  // Must stay comfortably above every server-side target (product main:
  // 800px, hero: 1000px) — capping at or below those means the server has
  // nothing left to downscale from and just re-encodes an already-lossy,
  // already-shrunk JPEG straight to WEBP, which is what caused the visible
  // quality drop on both product photos and thumbnails.
  var MAX_DIMENSION = 1600;
  var JPEG_QUALITY = 0.85;
  var SKIP_UNDER_BYTES = 400 * 1024;

  var pending = 0;

  function setBusy(input, busy) {
    var wrapper =
      input.closest(".field-box, .form-row, td, .field-image") ||
      input.parentElement;
    if (!wrapper) return;
    var badge = wrapper.querySelector(".compress-badge");
    if (busy) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "compress-badge";
        badge.textContent = " Compressing image…";
        badge.style.cssText =
          "color:#b45309;font-size:12px;margin-left:6px;white-space:nowrap;";
        wrapper.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  }

  function toggleSubmitButtons(disabled) {
    document
      .querySelectorAll(
        '.submit-row input[type="submit"], .submit-row button[type="submit"]'
      )
      .forEach(function (btn) {
        btn.disabled = disabled;
      });
  }

  function beginWork() {
    pending++;
    toggleSubmitButtons(true);
  }

  function endWork() {
    pending = Math.max(0, pending - 1);
    if (pending === 0) toggleSubmitButtons(false);
  }

  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(
        function () {
          return createImageBitmap(file);
        }
      );
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function (e) {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  function compressFile(file) {
    return loadBitmap(file).then(function (bitmap) {
      var width = bitmap.width;
      var height = bitmap.height;
      var scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
      var targetW = Math.max(1, Math.round(width * scale));
      var targetH = Math.max(1, Math.round(height * scale));

      var canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);

      if (bitmap.close) bitmap.close();

      return new Promise(function (resolve) {
        canvas.toBlob(
          function (blob) {
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            var newName = file.name.replace(/\.\w+$/, "") + ".jpg";
            resolve(new File([blob], newName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          JPEG_QUALITY
        );
      });
    });
  }

  function handleChange(e) {
    var input = e.target;
    if (!input || input.tagName !== "INPUT" || input.type !== "file") return;
    if (!input.files || !input.files.length) return;

    var file = input.files[0];
    if (!file || file.type.indexOf("image/") !== 0) return;
    if (file.type === "image/webp" || file.type === "image/gif") return;
    if (file.size < SKIP_UNDER_BYTES) return;
    if (
      typeof HTMLCanvasElement === "undefined" ||
      !HTMLCanvasElement.prototype.toBlob ||
      typeof DataTransfer === "undefined"
    ) {
      return;
    }

    setBusy(input, true);
    beginWork();

    compressFile(file)
      .then(function (compressed) {
        var dt = new DataTransfer();
        dt.items.add(compressed);
        input.files = dt.files;
      })
      .catch(function () {
        // Compression failed for any reason — fall back to uploading the
        // original file rather than blocking the admin from saving.
      })
      .finally(function () {
        setBusy(input, false);
        endWork();
      });
  }

  document.addEventListener("change", handleChange, true);
})();
