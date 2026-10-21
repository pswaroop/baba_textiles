import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import type { ProductVariant } from "../context/ShopContext";
import { ShieldCheck, MapPin, X, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
import {
  clearPendingPayment,
  isMobileDevice,
  loadPendingPayment,
  loadRazorpay,
  savePendingPayment,
} from "../utils/checkout";

const API_BASE = "https://api.babatextiles.com/api";

// States and union territories, as sent to India Post on the shipment booking.
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

type FormField =
  | "firstName" | "lastName" | "phone" | "address" | "city" | "state" | "pincode";

type CheckoutForm = Record<FormField, string>;

const NAME_PATTERN = /^[A-Za-z][A-Za-z\s.'-]*$/;

// Match a saved address's free-text state against the canonical list so the
// dropdown does not come up blank for addresses saved before this existed.
const normalizeState = (value: string) => {
  if (!value) return "";
  const cleaned = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  return (
    INDIAN_STATES.find(
      (state) => state.toLowerCase().replace(/[^a-z]/g, "") === cleaned
    ) || ""
  );
};

// India Post truncates the phone to 10 digits and the PIN to 6 when booking a
// shipment, so anything that does not match exactly ships to the wrong place.
const validateField = (field: FormField, rawValue: string): string => {
  const value = rawValue.trim();

  switch (field) {
    case "firstName":
      if (!value) return "First name is required.";
      if (value.length < 2) return "Please enter at least 2 characters.";
      if (!NAME_PATTERN.test(value)) return "Use letters only — no digits or symbols.";
      return "";

    case "lastName":
      if (value && !NAME_PATTERN.test(value))
        return "Use letters only — no digits or symbols.";
      return "";

    case "phone":
      if (!value) return "Phone number is required.";
      if (value.length !== 10) return "Enter a 10-digit mobile number.";
      if (!/^[6-9]/.test(value))
        return "Indian mobile numbers start with 6, 7, 8 or 9.";
      return "";

    case "address":
      if (!value) return "Address is required.";
      if (value.length < 10)
        return "Please enter the full address — house/shop number, street and area.";
      return "";

    case "city":
      if (!value) return "City is required.";
      if (value.length < 2) return "Please enter a valid city.";
      if (!NAME_PATTERN.test(value)) return "Use letters only — no digits or symbols.";
      return "";

    case "state":
      if (!value) return "Please select your state.";
      if (!INDIAN_STATES.includes(value)) return "Please pick a state from the list.";
      return "";

    case "pincode":
      if (!value) return "PIN code is required.";
      if (value.length !== 6) return "Enter a 6-digit PIN code.";
      if (value.startsWith("0")) return "A PIN code cannot start with 0.";
      return "";

    default:
      return "";
  }
};

// Order matters — it decides which field gets focused when submit is blocked.
const FIELD_ORDER: FormField[] = [
  "firstName", "lastName", "phone", "address", "city", "state", "pincode",
];

function FieldError({ id, message }: { id: string; message: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs text-red-600 mt-1.5">
      <AlertCircle size={13} className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export default function Checkout() {
  const { cart, cartTotal, shippingTotal, orderTotal, clearCart, user } = useShop();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);
  
  // ✅ Modal state for Wholesale Terms
  const [showTermsModal, setShowTermsModal] = useState(false);

  // ✅ Synchronous lock so a payment is only ever completed once
  const hasProcessedPayment = useRef(false);

  // ✅ State-based form control
  const [form, setForm] = useState<CheckoutForm>({
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    pincode: "",
    state: "",
    phone: "",
  });

  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  // A field only shows its error once the customer has left it (or tried to
  // submit), so the form does not turn red while they are still typing.
  const [touched, setTouched] = useState<Partial<Record<FormField, boolean>>>({});

  const setField = (field: FormField, rawValue: string) => {
    let value = rawValue;

    // Keep the digit-only fields digit-only at the source rather than
    // rejecting them afterwards — pasted numbers with spaces or +91 still work.
    if (field === "phone") value = rawValue.replace(/\D/g, "").slice(-10);
    if (field === "pincode") value = rawValue.replace(/\D/g, "").slice(0, 6);

    setForm((prev) => ({ ...prev, [field]: value }));

    // Once a field is showing an error, re-check on every keystroke so it
    // clears the moment it becomes valid.
    if (touched[field] || errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field: FormField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }));
  };

  const showError = (field: FormField) =>
    touched[field] && errors[field] ? errors[field] : "";

  // Only counts errors the customer can already see, so the summary never
  // scolds them about fields they have not reached yet.
  const pendingFieldCount = FIELD_ORDER.filter(
    (field) => touched[field] && errors[field]
  ).length;

  const inputClass = (field: FormField) =>
    `w-full border rounded-md px-4 py-2.5 transition-colors ${
      showError(field)
        ? "border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400"
        : "border-gray-300 focus:ring-baba-accent focus:border-baba-accent"
    }`;

  // Fetch saved addresses on component load
  useEffect(() => {
    const fetchAddresses = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/auth/addresses/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSavedAddresses(data);
        }
      } catch (err) {
        console.error("Failed to fetch addresses", err);
      }
    };
    fetchAddresses();
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      navigate("/cart");
    }
  }, [cart, navigate]);

  // Helper to fill form when a saved address is clicked
  const handleSelectAddress = (addr: any) => {
    const nameParts = addr.name?.trim().split(/\s+/) || [""];
    const first = nameParts[0] || "";
    const last = nameParts.slice(1).join(" ");

    const filled: CheckoutForm = {
      firstName: first,
      lastName: last,
      address: addr.street || "",
      city: addr.city || "",
      state: normalizeState(addr.state || ""),
      pincode: (addr.pincode || "").replace(/\D/g, "").slice(0, 6),
      phone: (addr.phone || "").replace(/\D/g, "").slice(-10),
    };

    setForm(filled);

    // Saved addresses predate these rules, so surface anything that no longer
    // passes instead of letting it fail at submit.
    const filledErrors: Partial<Record<FormField, string>> = {};
    const filledTouched: Partial<Record<FormField, boolean>> = {};
    FIELD_ORDER.forEach((field) => {
      const error = validateField(field, filled[field]);
      if (error) {
        filledErrors[field] = error;
        filledTouched[field] = true;
      }
    });
    setErrors(filledErrors);
    setTouched(filledTouched);

    if (Object.keys(filledErrors).length) {
      toast.warn("Address selected — please complete the highlighted fields.");
    } else {
      toast.info("Address selected!");
    }
  };

  // Ask the server what really happened to a payment. Used whenever the
  // browser loses track of it — the modal was dismissed, or the page was
  // reloaded while the customer was in their UPI app.
  const resolvePaymentOutcome = async (razorpayOrderId: string, attempts = 3) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetch(
          `${API_BASE}/payment-status/?razorpay_order_id=${encodeURIComponent(razorpayOrderId)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.payment_status !== "pending") return data.payment_status;
        }
      } catch (err) {
        console.error("Payment status check failed", err);
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    return "pending";
  };

  // Release an abandoned attempt's stock now rather than when the cleanup job
  // runs. The server checks with Razorpay first, so a payment that actually
  // went through is recorded as paid instead.
  const reportAbandonedAttempt = async (razorpayOrderId: string, reason: string) => {
    try {
      const res = await fetch(`${API_BASE}/payment-failed/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razorpay_order_id: razorpayOrderId, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.payment_status as string;
      }
    } catch (err) {
      console.error("Could not report abandoned payment", err);
    }
    return "pending";
  };

  const completeOrder = (orderNumber: string) => {
    if (hasProcessedPayment.current) return;
    hasProcessedPayment.current = true;
    clearPendingPayment();
    clearCart();
    navigate(`/order-success?order=${encodeURIComponent(orderNumber)}`, {
      state: { orderNumber },
      replace: true,
    });
    toast.success("Payment Successful!");
  };

  // Coming back to Checkout: either Razorpay's redirect reported a failure,
  // or the page was reloaded mid-payment (in-app browsers do this while the
  // customer is in their UPI app). Find out what happened to that attempt.
  useEffect(() => {
    const paymentFailed = searchParams.get("payment") === "failed";
    if (paymentFailed) {
      toast.error(
        "Payment could not be completed. If money was deducted, it will be " +
          "confirmed automatically or refunded within 5–7 working days."
      );
      setSearchParams({}, { replace: true });
    }

    const pending = loadPendingPayment();
    if (!pending) return;

    let cancelled = false;
    setIsProcessing(true);
    resolvePaymentOutcome(pending.razorpayOrderId, 1)
      .then((status) => {
        if (cancelled) return;
        if (status === "paid") {
          completeOrder(pending.orderNumber);
        } else if (status !== "pending") {
          clearPendingPayment();
        }
        // Still pending: keep it — the next attempt sends it along so the
        // server can release its stock.
      })
      .finally(() => {
        if (!cancelled) setIsProcessing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAddress = async (token: string) => {
    // Never let this block or fail the payment — it is a convenience only.
    try {
      await fetch(`${API_BASE}/auth/addresses/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          phone: form.phone,
          street: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
          pincode: form.pincode,
        }),
      });
    } catch (err) {
      console.error("Could not save address", err);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    // ==========================================
    // ✅ 0. VALIDATE THE FORM (BEFORE RESERVING STOCK)
    // ==========================================
    const formErrors: Partial<Record<FormField, string>> = {};
    FIELD_ORDER.forEach((field) => {
      const error = validateField(field, form[field]);
      if (error) formErrors[field] = error;
    });

    setErrors(formErrors);
    setTouched(
      FIELD_ORDER.reduce((acc, field) => ({ ...acc, [field]: true }), {})
    );

    const firstInvalid = FIELD_ORDER.find((field) => formErrors[field]);
    if (firstInvalid) {
      const el = document.getElementById(`checkout-${firstInvalid}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      toast.error(formErrors[firstInvalid]);
      return;
    }

    setIsProcessing(true);
    hasProcessedPayment.current = false; // Reset lock on new attempt

    // Checked before any stock is reserved.
    if (!(await loadRazorpay())) {
      toast.error("Payment gateway failed to load. Please check your connection and try again.");
      setIsProcessing(false);
      return;
    }
    const Razorpay = (window as any).Razorpay;

    try {
      const token = localStorage.getItem("token");

      // Saved before payment: in redirect mode the page is gone by the time
      // the payment completes.
      if (saveAddressToProfile && token) {
        await saveAddress(token);
      }

      // ==========================================
      // ✅ 1. CREATE ORDER & GET RAZORPAY ID
      // ==========================================
      // create_order checks and reserves stock inside a transaction, so no
      // separate stock check is made first — every extra round trip before
      // rzp.open() makes in-app browsers more likely to block the payment.
      const orderData = {
        items: cart
          .map((item) => {
            let variant: ProductVariant | undefined;

            if (item.variantId) {
              variant = item.product.variants.find((v) => v.id === item.variantId);
            } else if (item.selectedSize && item.selectedColor?.name) {
              variant = item.product.variants.find(
                (v) =>
                  v.size === item.selectedSize &&
                  v.color?.name === item.selectedColor?.name
              );
            } else if (item.selectedColor?.name) {
              variant = item.product.variants.find(
                (v) => v.color?.name === item.selectedColor?.name
              );
            }

            if (!variant) {
              console.error("Variant not found for cart item:", item);
              return null;
            }

            return {
              variant: variant.id,
              quantity: item.quantity,
            };
          })
          .filter(Boolean),

        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode,
        phone: form.phone,
        // Lets the server release the stock still held by an earlier,
        // abandoned attempt from this browser before reserving again.
        previous_razorpay_order_id: loadPendingPayment()?.razorpayOrderId || null,
      };

      const orderRes = await fetch(`${API_BASE}/create-order/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(orderData),
      });

      const orderResponseData = await orderRes.json();

      if (!orderRes.ok) {
        toast.error(orderResponseData.error || "Order creation failed");
        setIsProcessing(false);
        return;
      }

      const razorpayOrderId: string = orderResponseData.razorpay_order_id;
      const orderNumber: string = orderResponseData.order_number;

      savePendingPayment({ razorpayOrderId, orderNumber, createdAt: Date.now() });

      // ==========================================
      // ✅ 2. OPEN RAZORPAY
      // ==========================================
      const options: Record<string, any> = {
        key: orderResponseData.key,
        amount: orderResponseData.amount,
        currency: "INR",
        name: "Baba Textiles",
        description: "Wholesale Order Payment",
        order_id: razorpayOrderId,

        // Redirect mode: Razorpay posts the result to our server, which records
        // it and sends the customer back to /order-success or /checkout. Bank
        // pages open in the same tab instead of a popup, and the outcome no
        // longer depends on this page surviving — both of which break in
        // Instagram/Facebook in-app browsers.
        callback_url: `${API_BASE}/payment-callback/`,
        redirect: true,

        prefill: {
          name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim() || user?.name || "Customer",
          contact: form.phone,
          email: user?.email || "",
        },
        notes: { order_number: orderNumber },
        // One Razorpay order = one attempt. A failed attempt releases the stock
        // reservation straight away, so an in-session retry would be paying
        // for items that are no longer held. The customer presses Pay again
        // and gets a fresh order with a fresh stock check.
        retry: { enabled: false },
        // Razorpay allows roughly 12 minutes to complete a payment, and the
        // cleanup job expires unpaid orders at 18 — giving up here first means
        // Checkout is never left open against an order that has been cancelled.
        timeout: 12 * 60,
        theme: { color: "#0f766e" },
        modal: {
          ondismiss: async function () {
            // The customer closed Checkout — but they may have paid in their
            // UPI app first. The server checks with Razorpay before releasing
            // anything, and reports "paid" if the money did arrive.
            const finalStatus = await reportAbandonedAttempt(
              razorpayOrderId,
              "Customer closed the payment window"
            );
            if (finalStatus === "paid") {
              completeOrder(orderNumber);
            } else {
              if (finalStatus !== "pending") clearPendingPayment();
              toast.warn("Payment window closed. Your order was not placed.");
            }
            setIsProcessing(false);
          },
        },
      };

      // UPI apps are only offered on phones. List them explicitly so PhonePe
      // comes first and Amazon Pay (whose UPI hand-off was timing out) is not
      // offered; every other method still appears below.
      if (isMobileDevice()) {
        options.config = {
          display: {
            blocks: {
              upi_apps: {
                name: "Pay using UPI",
                instruments: [
                  { method: "upi", flows: ["intent"], apps: ["phonepe", "google_pay", "paytm"] },
                ],
              },
            },
            sequence: ["block.upi_apps"],
            preferences: { show_default_blocks: true },
          },
        };
      }

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", async function (response: any) {
        const description =
          response?.error?.description || response?.error?.reason || "Payment failed";
        console.error("Razorpay payment.failed:", response?.error);

        const finalStatus = await reportAbandonedAttempt(razorpayOrderId, description);
        if (finalStatus === "paid") {
          completeOrder(orderNumber);
        } else {
          if (finalStatus !== "pending") clearPendingPayment();
          toast.error(`${description} — please try again.`);
        }
        setIsProcessing(false);
      });

      rzp.open();
    } catch (error) {
      console.error(error);
      toast.error("Checkout failed. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-baba-softbg min-h-screen py-10 relative">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif text-baba-primary font-bold">Secure Checkout</h1>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-500">
            <ShieldCheck className="w-4 h-4 text-green-600" /> 256-bit Encrypted Connection
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="lg:w-2/3">
            {/* QUICK SELECT SAVED ADDRESSES */}
            {savedAddresses.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MapPin size={14} className="text-baba-accent" /> Use a Saved Address
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handleSelectAddress(addr)}
                      className="text-left p-4 border border-gray-100 rounded-lg hover:border-baba-accent hover:bg-baba-softbg transition group"
                    >
                      <p className="font-bold text-baba-primary text-sm">{addr.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {addr.street}, {addr.city}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
              <form id="checkout-form" onSubmit={handlePlaceOrder} noValidate>
                <h2 className="text-xl font-medium text-baba-primary mb-1">Shipping Information</h2>
                <p className="text-sm text-gray-500 mb-6">
                  We hand these details straight to the courier, so please check the
                  phone number and PIN code carefully.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="checkout-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      id="checkout-firstName"
                      type="text"
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={(e) => setField("firstName", e.target.value)}
                      onBlur={() => handleBlur("firstName")}
                      aria-invalid={!!showError("firstName")}
                      aria-describedby={showError("firstName") ? "error-firstName" : undefined}
                      className={inputClass("firstName")}
                    />
                    <FieldError id="error-firstName" message={showError("firstName")} />
                  </div>

                  <div>
                    <label htmlFor="checkout-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      id="checkout-lastName"
                      type="text"
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={(e) => setField("lastName", e.target.value)}
                      onBlur={() => handleBlur("lastName")}
                      aria-invalid={!!showError("lastName")}
                      aria-describedby={showError("lastName") ? "error-lastName" : undefined}
                      className={inputClass("lastName")}
                    />
                    <FieldError id="error-lastName" message={showError("lastName")} />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="checkout-phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 text-sm pointer-events-none">
                        +91
                      </span>
                      <input
                        id="checkout-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        placeholder="10-digit mobile number"
                        value={form.phone}
                        onChange={(e) => setField("phone", e.target.value)}
                        onBlur={() => handleBlur("phone")}
                        aria-invalid={!!showError("phone")}
                        aria-describedby={showError("phone") ? "error-phone" : "hint-phone"}
                        className={`${inputClass("phone")} pl-14`}
                      />
                    </div>
                    {showError("phone") ? (
                      <FieldError id="error-phone" message={showError("phone")} />
                    ) : (
                      <p id="hint-phone" className="text-xs text-gray-500 mt-1.5">
                        Used for your payment confirmation and delivery updates.
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="checkout-address" className="block text-sm font-medium text-gray-700 mb-1">
                      Address *
                    </label>
                    <textarea
                      id="checkout-address"
                      rows={2}
                      autoComplete="street-address"
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                      onBlur={() => handleBlur("address")}
                      aria-invalid={!!showError("address")}
                      aria-describedby={showError("address") ? "error-address" : undefined}
                      className={`${inputClass("address")} resize-none`}
                      placeholder="House / shop number, street, area, landmark"
                    />
                    <FieldError id="error-address" message={showError("address")} />
                  </div>

                  <div>
                    <label htmlFor="checkout-city" className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      id="checkout-city"
                      type="text"
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={(e) => setField("city", e.target.value)}
                      onBlur={() => handleBlur("city")}
                      aria-invalid={!!showError("city")}
                      aria-describedby={showError("city") ? "error-city" : undefined}
                      className={inputClass("city")}
                    />
                    <FieldError id="error-city" message={showError("city")} />
                  </div>

                  <div>
                    <label htmlFor="checkout-pincode" className="block text-sm font-medium text-gray-700 mb-1">
                      PIN Code *
                    </label>
                    <input
                      id="checkout-pincode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      placeholder="6 digits"
                      value={form.pincode}
                      onChange={(e) => setField("pincode", e.target.value)}
                      onBlur={() => handleBlur("pincode")}
                      aria-invalid={!!showError("pincode")}
                      aria-describedby={showError("pincode") ? "error-pincode" : undefined}
                      className={inputClass("pincode")}
                    />
                    <FieldError id="error-pincode" message={showError("pincode")} />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="checkout-state" className="block text-sm font-medium text-gray-700 mb-1">
                      State *
                    </label>
                    <select
                      id="checkout-state"
                      autoComplete="address-level1"
                      value={form.state}
                      onChange={(e) => setField("state", e.target.value)}
                      onBlur={() => handleBlur("state")}
                      aria-invalid={!!showError("state")}
                      aria-describedby={showError("state") ? "error-state" : undefined}
                      className={`${inputClass("state")} bg-white ${
                        form.state ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      <option value="">Select your state</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state} className="text-gray-900">
                          {state}
                        </option>
                      ))}
                    </select>
                    <FieldError id="error-state" message={showError("state")} />
                  </div>
                </div>

                {/* SAVE ADDRESS OPTION */}
                <div className="flex items-start gap-3 mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    id="save-to-profile"
                    checked={saveAddressToProfile}
                    onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-baba-primary cursor-pointer shrink-0"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="save-to-profile" className="text-sm font-medium text-gray-800 cursor-pointer">
                      Save this address to my profile for future orders
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Addresses are saved for logged-in users.{" "}
                      <Link to="/auth" className="text-baba-primary font-medium hover:underline">
                        Login here
                      </Link>
                    </p>
                  </div>
                </div>

                <h2 className="text-xl font-medium text-baba-primary mb-6">Payment Method</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked
                      readOnly
                      className="w-4 h-4 text-baba-accent focus:ring-baba-accent border-gray-300"
                    />
                    <span className="font-medium text-gray-900">Online Payment (Razorpay)</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2 ml-7">
                    Secure payment via Cards, UPI, Netbanking, or Wallets.
                  </p>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:w-1/3">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-28">
              <h2 className="text-xl font-medium text-baba-primary mb-6 border-b pb-4">Order Summary</h2>

              <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
                {cart.map((item) => {
                  const image = item.selectedImageUrl || item.product.images?.[0]?.thumbnail || item.product.images?.[0]?.image || "/placeholder.png";

                  return (
                    <div key={item.id} className="flex gap-4">
                      <img
                        src={image}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded-md border border-gray-200 bg-gray-50 flex-shrink-0"
                      />
                      <div className="flex-grow">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.product.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.selectedColor?.name} {item.selectedSize ? `| Size: ${item.selectedSize}` : ""} | Qty: {item.quantity}
                        </p>
                        <p className="text-sm font-semibold text-baba-primary mt-1">
                          ₹{(item.product.price * item.quantity).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Items Subtotal</span>
                  <span>₹{cartTotal.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">Wholesale Shipping</span>
                  <span>₹{shippingTotal.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex justify-between text-xl font-bold text-baba-primary pt-3 border-t border-gray-200 mt-2">
                  <span>Grand Total</span>
                  <span className="text-baba-accent">₹{orderTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {pendingFieldCount > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-red-600 mb-3">
                  <AlertCircle size={13} className="mt-px shrink-0" />
                  <span>
                    {pendingFieldCount} shipping{" "}
                    {pendingFieldCount === 1 ? "field needs" : "fields need"} your
                    attention before payment.
                  </span>
                </p>
              )}

              <button
                type="submit"
                form="checkout-form"
                disabled={isProcessing}
                className="w-full bg-black text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-800 shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isProcessing ? "Processing..." : "Pay & Place Order"}
              </button>

              <div className="text-[10px] text-center text-gray-400 mt-4 uppercase tracking-tighter">
                By placing order you agree to our{" "}
                <button 
                  type="button" 
                  onClick={() => setShowTermsModal(true)} 
                  className="text-baba-primary hover:underline font-bold"
                >
                  Wholesale Terms
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          ✅ WHOLESALE TERMS MODAL
          ========================================== */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-serif font-bold text-baba-primary">Wholesale Terms & Conditions</h2>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto text-sm text-gray-600 space-y-4">
              <p>Welcome to Baba Textiles. By completing this wholesale purchase, you agree to the following terms and conditions:</p>
              
              <h3 className="font-bold text-gray-800 text-base mt-6">1. Minimum Order Requirements</h3>
              <p>All wholesale orders must meet the minimum order quantities or values specified on the product pages. Mixed variants are allowed unless explicitly stated otherwise.</p>

              <h3 className="font-bold text-gray-800 text-base mt-6">2. Resale and Pricing (MSRP)</h3>
              <p>Products purchased at wholesale prices are intended for resale. Retailers are encouraged to follow our Manufacturer's Suggested Retail Price (MSRP). Extreme undercutting of our MSRP may result in termination of your wholesale account.</p>

              <h3 className="font-bold text-gray-800 text-base mt-6">3. Shipping & Delivery</h3>
              <p>Wholesale shipping rates are calculated based on bulk weight and dimensions. Delivery timelines are estimates. We are not responsible for delays caused by third-party logistics partners once the shipment has left our warehouse.</p>

              <h3 className="font-bold text-gray-800 text-base mt-6">4. Returns & Damaged Goods</h3>
              <p>Due to the nature of wholesale pricing, we do not accept returns for unsold inventory. Claims for damaged, defective, or missing items must be made within 3 days of delivery with photographic evidence.</p>

              <h3 className="font-bold text-gray-800 text-base mt-6">5. Payment Terms</h3>
              <p>All orders must be paid in full prior to dispatch. We accept major credit/debit cards, UPI, and net banking via our secure payment gateway.</p>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setShowTermsModal(false)}
                className="bg-black text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
