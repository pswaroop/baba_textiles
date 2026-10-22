/*
 * Resizes/compresses image files in the browser before Django admin's form
 * submits them. Raw phone-camera photos (often 4-8MB) take minutes to
 * transmit over a slow mobile uplink even though server-side processing is
 * fast — shrinking them client-side is the only thing that helps with
 * upload transfer time itself.
 *
 * NOTE ON PATHS: this file must stay at
 *   products/static/products/admin/compress_before_upload.js
 * because every ModelAdmin.Media in products/admin.py references it as
 * "products/admin/compress_before_upload.js". It used to live at
 * products/static/compress_before_upload.js, which collectstatic published
 * as /static/compress_before_upload.js — so the admin's <script> tag 404'd
 * and none of this ever ran. Moving or renaming it again without updating
 * admin.py silently reverts uploads to sending full-size originals.
 */
(function () {
  "use strict";

  // Must stay comfortably above every server-side target (product main:
  // 1000px, thumbnail: 800px, hero: 1000px) — capping at or below those
  // means the server has nothing left to downscale from and just re-encodes
  // an already-lossy, already-shrunk JPEG straight to WEBP, which is what
  // caused the visible quality drop on both product photos and thumbnails.
  var MAX_DIMENSION = 1600;
  // The server re-encodes to WEBP at 1000px or less, so JPEG artifacts at
  // this quality are downscaled away before anything reaches the site. 0.82
  // is ~20% fewer bytes on the wire than 0.85 with no visible difference in
  // the final asset.
  var JPEG_QUALITY = 0.82;
  var SKIP_UNDER_BYTES = 400 * 1024;

  var pending = 0;

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + "MB";
    return Math.round(bytes / 1024) + "KB";
  }

  function getBadge(input, create) {
    var wrapper =
      input.closest(".field-box, .form-row, td, .field-image") ||
      input.parentElement;
    if (!wrapper) return null;
    var badge = wrapper.querySelector(".compress-badge");
    if (!badge && create) {
      badge = document.createElement("span");
      badge.className = "compress-badge";
      badge.style.cssText =
        "display:inline-block;color:#b45309;font-size:12px;margin-left:6px;";
      wrapper.appendChild(badge);
    }
    return badge;
  }

  function setBadge(input, text, color) {
    var badge = getBadge(input, !!text);
    if (!badge) return;
    if (!text) {
      badge.remove();
      return;
    }
    badge.textContent = text;
    badge.style.color = color || "#b45309";
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

  // Downscale off the main thread where the browser supports it. Canvas
  // drawImage of a 12MP bitmap blocks the UI thread for a noticeable beat on
  // a mid-range phone; createImageBitmap's own resampler does not, and it
  // lets us release the full-size bitmap before allocating the canvas, which
  // is what keeps mobile Safari from dropping the tab on large photos.
  function resizeBitmap(bitmap, targetW, targetH) {
    if (!window.createImageBitmap || bitmap.width === targetW) {
      return Promise.resolve(bitmap);
    }
    return createImageBitmap(bitmap, {
      resizeWidth: targetW,
      resizeHeight: targetH,
      resizeQuality: "high",
    })
      .then(function (small) {
        if (bitmap.close) bitmap.close();
        return small;
      })
      .catch(function () {
        return bitmap;
      });
  }

  function compressFile(file) {
    return loadBitmap(file).then(function (bitmap) {
      var scale = Math.min(
        1,
        MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
      );
      var targetW = Math.max(1, Math.round(bitmap.width * scale));
      var targetH = Math.max(1, Math.round(bitmap.height * scale));

      return resizeBitmap(bitmap, targetW, targetH).then(function (source) {
        var canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(source, 0, 0, targetW, targetH);

        if (source.close) source.close();

        return new Promise(function (resolve) {
          canvas.toBlob(
            function (blob) {
              // Free the backing store immediately — a 1600px canvas is
              // ~10MB of RGBA and several inline rows add up fast.
              canvas.width = 0;
              canvas.height = 0;

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
    });
  }

  function shouldCompress(file) {
    if (!file || file.type.indexOf("image/") !== 0) return false;
    if (file.type === "image/webp" || file.type === "image/gif") return false;
    return file.size >= SKIP_UNDER_BYTES;
  }

  function canCompress() {
    return (
      typeof HTMLCanvasElement !== "undefined" &&
      !!HTMLCanvasElement.prototype.toBlob &&
      typeof DataTransfer !== "undefined"
    );
  }

  function handleChange(e) {
    var input = e.target;
    if (!input || input.tagName !== "INPUT" || input.type !== "file") return;
    if (!input.files || !input.files.length) return;
    if (!canCompress()) return;

    // Django's ImageField widget is single-file, but `multiple` inputs are
    // legal here too. Rebuilding input.files from only files[0] would have
    // silently discarded every other selected photo.
    var files = Array.prototype.slice.call(input.files);
    if (!files.some(shouldCompress)) return;

    var originalBytes = files.reduce(function (sum, f) {
      return sum + f.size;
    }, 0);

    setBadge(input, "Compressing image…");
    beginWork();

    // Sequential, not Promise.all: decoding several multi-megapixel photos
    // at once is what makes a phone stall or kill the tab.
    var results = [];
    var chain = files.reduce(function (prev, file) {
      return prev.then(function () {
        if (!shouldCompress(file)) {
          results.push(file);
          return;
        }
        return compressFile(file)
          .then(function (compressed) {
            results.push(compressed);
          })
          .catch(function () {
            // Compression failed for any reason — fall back to uploading the
            // original file rather than blocking the admin from saving.
            results.push(file);
          });
      });
    }, Promise.resolve());

    chain
      .then(function () {
        var dt = new DataTransfer();
        results.forEach(function (f) {
          dt.items.add(f);
        });
        input.files = dt.files;

        var newBytes = results.reduce(function (sum, f) {
          return sum + f.size;
        }, 0);
        if (newBytes < originalBytes) {
          setBadge(
            input,
            "Ready — " +
              formatSize(originalBytes) +
              " → " +
              formatSize(newBytes),
            "#15803d"
          );
        } else {
          setBadge(input, "");
        }
      })
      .catch(function () {
        setBadge(input, "");
      })
      .finally(function () {
        endWork();
      });
  }

  // Without this the admin sees a frozen page for the whole upload and
  // assumes it has hung — on a slow uplink a multi-image product save is
  // genuinely tens of seconds of transfer with no browser feedback at all.
  function handleSubmit(e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;
    if (!form.querySelector('input[type="file"]')) return;

    var hasFile = Array.prototype.some.call(
      form.querySelectorAll('input[type="file"]'),
      function (input) {
        return input.files && input.files.length;
      }
    );
    if (!hasFile) return;

    var row = form.querySelector(".submit-row");
    if (!row || row.querySelector(".upload-notice")) return;

    var notice = document.createElement("p");
    notice.className = "upload-notice";
    notice.textContent =
      "Uploading images… keep this page open until it finishes.";
    notice.style.cssText = "margin:8px 0 0;color:#b45309;font-size:13px;";
    row.appendChild(notice);
  }

  document.addEventListener("change", handleChange, true);
  document.addEventListener("submit", handleSubmit, true);
})();
