// Helpers shared by Checkout and OrderSuccess.

/* ================= PENDING PAYMENT ================= */
// The Razorpay order of the attempt in progress. It survives reloads and the
// redirect to Razorpay, so a reloaded Checkout can find out whether that
// attempt was paid, and a retry can release the stock it is still holding.

export type PendingPayment = {
  razorpayOrderId: string;
  orderNumber: string;
  createdAt: number;
};

const PENDING_PAYMENT_KEY = "pendingPayment";

// Matches the server's cleanup window; anything older has been settled there.
const PENDING_PAYMENT_MAX_AGE_MS = 30 * 60 * 1000;

export function savePendingPayment(payment: PendingPayment) {
  try {
    localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment));
  } catch {
    // Without storage the server's cleanup job still releases the stock.
  }
}

export function loadPendingPayment(): PendingPayment | null {
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_PAYMENT_KEY) || "null");
    if (!stored?.razorpayOrderId) return null;
    if (Date.now() - (stored.createdAt || 0) > PENDING_PAYMENT_MAX_AGE_MS) {
      clearPendingPayment();
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    localStorage.removeItem(PENDING_PAYMENT_KEY);
  } catch {
    // Nothing to do.
  }
}

/* ================= IN-APP BROWSERS ================= */
// Instagram and Facebook open links in their own WebView, which blocks
// Checkout's popups and handles UPI app hand-offs poorly.

const IN_APP_BROWSER_PATTERN = /Instagram|FBAN|FBAV|FB_IAB|FBIOS/i;

export function isInAppBrowser(): boolean {
  return typeof navigator !== "undefined" && IN_APP_BROWSER_PATTERN.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function isMobileDevice(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Android only: hands the current page to Chrome. iOS has no equivalent, so
// iPhone users are told to use the "Open in external browser" menu instead.
export function openInChrome() {
  const target = window.location.href.replace(/^https?:\/\//, "");
  window.location.href = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
}

/* ================= RAZORPAY SCRIPT ================= */
// index.html loads Checkout asynchronously so a slow Razorpay CDN never blocks
// the page. If it has not arrived (or failed on a flaky mobile connection)
// by the time the customer pays, load it again here.

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpay(timeoutMs = 10000): Promise<boolean> {
  if ((window as any).Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;

    const timer = window.setTimeout(() => resolve(!!(window as any).Razorpay), timeoutMs);
    const finish = () => {
      window.clearTimeout(timer);
      resolve(!!(window as any).Razorpay);
    };
    script.onload = finish;
    script.onerror = finish;
    document.body.appendChild(script);
  });
}
