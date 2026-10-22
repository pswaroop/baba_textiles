import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ExternalLink, X } from "lucide-react";
import { useShop } from "../context/ShopContext";
import { checkoutHandoffUrl, isInAppBrowser, openInExternalBrowser } from "../utils/checkout";

const DISMISSED_KEY = "inAppNoticeDismissed";

// Suggests leaving Instagram's built-in browser before paying.
// Payments can still be made here, so the notice can be dismissed.
export default function InAppBrowserNotice() {
  const location = useLocation();
  const { cart } = useShop();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed || !isInAppBrowser()) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Hidden for this page view only.
    }
  };

  // From the cart or checkout, go straight to checkout in the browser with the
  // cart carried over; elsewhere just reopen this page.
  const targetUrl = () =>
    /^\/(cart|checkout)/.test(location.pathname) && cart.length
      ? checkoutHandoffUrl(
          cart.map((item) => ({
            productId: item.product.id,
            variantId: item.variantId,
            quantity: item.quantity,
          }))
        )
      : window.location.href;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
      <div className="container mx-auto px-4 py-3 flex items-start gap-3">
        <ExternalLink size={16} className="mt-0.5 shrink-0" />
        <div className="flex-grow">
          <p className="font-medium">For a smoother payment, open this page in Chrome.</p>
          <button
            type="button"
            onClick={() => openInExternalBrowser(targetUrl())}
            className="mt-2 px-3 py-1.5 bg-amber-900 text-white rounded-md text-xs font-semibold"
          >
            Open in Chrome
          </button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 text-amber-700 hover:text-amber-900 shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
