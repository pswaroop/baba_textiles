import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { isAndroid, isInAppBrowser, openInChrome } from "../utils/checkout";

const DISMISSED_KEY = "inAppNoticeDismissed";

// Suggests leaving Instagram/Facebook's built-in browser before paying.
// Payments can still be made here, so the notice can be dismissed.
export default function InAppBrowserNotice() {
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

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
      <div className="container mx-auto px-4 py-3 flex items-start gap-3">
        <ExternalLink size={16} className="mt-0.5 shrink-0" />
        <div className="flex-grow">
          <p className="font-medium">For a smoother payment, open this page in your browser.</p>
          {isAndroid() ? (
            <button
              type="button"
              onClick={openInChrome}
              className="mt-2 px-3 py-1.5 bg-amber-900 text-white rounded-md text-xs font-semibold"
            >
              Open in Chrome
            </button>
          ) : (
            <p className="text-xs mt-1">
              Tap <span className="font-semibold">•••</span> at the top right, then{" "}
              <span className="font-semibold">Open in external browser</span>.
            </p>
          )}
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
