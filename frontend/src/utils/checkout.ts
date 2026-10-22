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
// Instagram opens links in its own WebView, which handles UPI app hand-offs
// poorly. Only Instagram gets the "Open in Chrome" prompts.

const IN_APP_BROWSER_PATTERN = /Instagram/i;

export function isInAppBrowser(): boolean {
  return typeof navigator !== "undefined" && IN_APP_BROWSER_PATTERN.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function isMobileDevice(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Android only: hands a page to Chrome. iOS has no equivalent, so iPhone users
// are told to use the "Open in external browser" menu instead. Without Chrome
// the fallback reloads the page where it is.
export function openInChrome(url: string = window.location.href) {
  const target = url.replace(/^https?:\/\//, "");
  const fallback = encodeURIComponent(url);
  window.location.href =
    `intent://${target}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

// Instagram on Android is where UPI apps most often fail to open (29% of UPI
// attempts vs 13-14% elsewhere), so the experiments below target only it.
export function isInstagramAndroid(): boolean {
  return isInAppBrowser() && isAndroid();
}

/* ============ CHECKOUT MODE EXPERIMENT (Instagram on Android) ============ */
// Razorpay Checkout opened as a redirect (the page moves to Razorpay) or as a
// popup over our page. Instagram may let UPI apps open from one more than the
// other; each phone is assigned one at random and keeps it, and every order
// records which was used (see the checkout_mode_report command).

export type CheckoutMode = "redirect" | "popup";
const CHECKOUT_MODE_KEY = "rzpCheckoutMode";

export function checkoutMode(): CheckoutMode {
  if (!isInstagramAndroid()) return "redirect";
  try {
    const saved = localStorage.getItem(CHECKOUT_MODE_KEY);
    if (saved === "redirect" || saved === "popup") return saved;
    const assigned: CheckoutMode = Math.random() < 0.5 ? "redirect" : "popup";
    localStorage.setItem(CHECKOUT_MODE_KEY, assigned);
    return assigned;
  } catch {
    return "redirect";
  }
}

/* ============ FAILED-ATTEMPT MEMORY (Instagram on Android) ============ */
// Survives the redirect back from Razorpay and page reloads, so the next Pay
// press can suggest Chrome. Forgotten after two hours or a successful order.

const IG_FAILED_KEY = "igPaymentFailedAt";
const IG_FAILED_MEMORY_MS = 2 * 60 * 60 * 1000;

export function rememberInstagramPaymentFailure() {
  if (!isInstagramAndroid()) return;
  try {
    localStorage.setItem(IG_FAILED_KEY, String(Date.now()));
  } catch {
    // The card on the checkout page still offers Chrome.
  }
}

export function hadRecentInstagramPaymentFailure(): boolean {
  if (!isInstagramAndroid()) return false;
  try {
    const at = Number(localStorage.getItem(IG_FAILED_KEY) || 0);
    return at > 0 && Date.now() - at < IG_FAILED_MEMORY_MS;
  } catch {
    return false;
  }
}

export function forgetInstagramPaymentFailure() {
  try {
    localStorage.removeItem(IG_FAILED_KEY);
  } catch {
    // Nothing to do.
  }
}

export function isIOS(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Opens `url` outside the in-app browser in one tap. Android: straight into
// Chrome. iPhone: Chrome if it is installed, otherwise Safari (the
// x-safari-https scheme opens Safari directly from Instagram/Facebook).
export function openInExternalBrowser(url: string = window.location.href) {
  if (!isIOS()) {
    openInChrome(url);
    return;
  }

  const target = url.replace(/^https?:\/\//, "");
  let left = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") left = true;
  };
  document.addEventListener("visibilitychange", onHide);

  window.location.href = `googlechromes://${target}`;
  // Chrome took over if this page went to the background; otherwise use Safari.
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!left) window.location.href = `x-safari-https://${target}`;
  }, 1500);
}

/* ================= CART HAND-OFF ================= */
// Instagram's browser and Chrome do not share storage, so the cart travels in
// the checkout link as "productId.variantId.quantity" entries. Only ids and
// quantities: nothing personal ends up in browser history or server logs.

export const CART_HANDOFF_PARAM = "cart";

export type CartHandoffEntry = {
  productId: string;
  variantId: number;
  quantity: number;
};

export function encodeCartHandoff(entries: CartHandoffEntry[]): string {
  return entries.map((e) => `${e.productId}.${e.variantId}.${e.quantity}`).join(",");
}

export function decodeCartHandoff(value: string | null): CartHandoffEntry[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.split("."))
    .filter((bits) => bits.length === 3)
    .map(([productId, variantId, quantity]) => ({
      productId,
      variantId: Number(variantId),
      quantity: Number(quantity),
    }))
    .filter(
      (e) =>
        /^\d+$/.test(e.productId) &&
        Number.isInteger(e.variantId) &&
        Number.isInteger(e.quantity) &&
        e.quantity > 0 &&
        e.quantity <= 999
    );
}

export function checkoutHandoffUrl(entries: CartHandoffEntry[]): string {
  const url = new URL("/checkout", window.location.origin);
  url.searchParams.set(CART_HANDOFF_PARAM, encodeCartHandoff(entries));
  return url.toString();
}

/* ================= RAZORPAY SCRIPT ================= */
// Loaded only on the checkout page (not site-wide): Checkout starts it as soon
// as the page opens, and Pay waits for it if it has not arrived yet.

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let razorpayLoading: Promise<boolean> | null = null;

export function loadRazorpay(timeoutMs = 10000): Promise<boolean> {
  if ((window as any).Razorpay) return Promise.resolve(true);
  // One script tag at a time: the page preload and Pay can both ask for it.
  if (razorpayLoading) return razorpayLoading;

  razorpayLoading = new Promise<boolean>((resolve) => {
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
  }).then((ok) => {
    if (!ok) razorpayLoading = null; // let a later attempt retry
    return ok;
  });
  return razorpayLoading;
}
