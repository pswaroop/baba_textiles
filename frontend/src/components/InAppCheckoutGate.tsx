import { useState } from "react";
import { Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { isAndroid, openInChrome } from "../utils/checkout";

// Shown at checkout inside Instagram/Facebook's built-in browser, which often
// blocks the hand-off to UPI apps (PhonePe gets stuck on "please wait").
// `handoffUrl` carries the cart, so the customer lands in Chrome/Safari on the
// same checkout with the same items.
export default function InAppCheckoutGate({
  handoffUrl,
  onContinue,
}: {
  handoffUrl: string;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const android = isAndroid();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(handoffUrl);
      setCopied(true);
    } catch {
      // Clipboard is often blocked in in-app browsers; the link is selectable below.
      setCopied(false);
    }
  };

  return (
    <div className="bg-baba-softbg min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-lg">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-7 h-7 text-amber-700" />
          </div>

          <h1 className="text-2xl font-serif text-baba-primary font-bold mb-2">
            Open in {android ? "Chrome" : "Safari"} to pay
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            PhonePe, Google Pay and other UPI apps often don't open from inside
            Instagram or Facebook. Your cart comes with you.
          </p>

          {android ? (
            <button
              type="button"
              onClick={() => openInChrome(handoffUrl)}
              className="w-full bg-baba-primary text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-baba-accent transition-colors"
            >
              Open in Chrome
            </button>
          ) : (
            <div className="text-left bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-700 space-y-2">
              <p>
                1. Tap <span className="font-semibold">•••</span> at the top right.
              </p>
              <p>
                2. Choose <span className="font-semibold">Open in external browser</span>.
              </p>
              <p className="text-xs text-gray-500 pt-1">Or copy the link and paste it into Safari:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={handoffUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-grow min-w-0 border border-gray-300 rounded-md px-3 py-2 text-xs bg-white"
                  aria-label="Checkout link"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 px-3 py-2 bg-baba-primary text-white rounded-md text-xs font-semibold flex items-center gap-1"
                >
                  <Copy size={13} /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onContinue}
            className="mt-5 text-sm text-gray-500 underline underline-offset-2 hover:text-baba-primary"
          >
            Continue here instead
          </button>
          <p className="text-xs text-gray-400 mt-1">
            Here you can pay by UPI ID, card or netbanking.
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Secure payment by Razorpay
          </div>
        </div>
      </div>
    </div>
  );
}
