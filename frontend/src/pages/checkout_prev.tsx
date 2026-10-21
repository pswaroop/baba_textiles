import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import { ShieldCheck, MapPin, X } from "lucide-react";
import { toast } from "react-toastify";

export default function Checkout() {
  const { cart, cartTotal, shippingTotal, orderTotal, clearCart, user } = useShop();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);
  
  // ✅ Modal state for Wholesale Terms
  const [showTermsModal, setShowTermsModal] = useState(false);

  // ✅ Synchronous lock to prevent React from firing the success callback twice
  const hasProcessedPayment = useRef(false);

  // ✅ State-based form control
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    pincode: "",
    state: "",
    phone: "",
  });

  // Fetch saved addresses on component load
  useEffect(() => {
    const fetchAddresses = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch("https://api.babatextiles.com/api/auth/addresses/", {
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
    const nameParts = addr.name?.split(" ") || [""];
    const first = nameParts[0];
    const last = nameParts.slice(1).join(" ");

    setForm({
      firstName: first,
      lastName: last,
      address: addr.street,
      city: addr.city,
      state: addr.state || "",
      pincode: addr.pincode,
      phone: addr.phone,
    });
    toast.info("Address selected!");
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    
    setIsProcessing(true);
    hasProcessedPayment.current = false; // Reset lock on new attempt

    try {
      const token = localStorage.getItem("token");

      // ==========================================
      // ✅ 1. API STOCK VALIDATION (BEFORE ANYTHING ELSE)
      // ==========================================
      const validationPayload = cart
  .map((item) => {
    let variant = null;

    if (item.selectedSize) {
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

    if (!variant) return null;

    return {
      variant_id: variant.id,
      quantity: item.quantity,
      product_name: item.product.name,
      color: item.selectedColor?.name,
      size: item.selectedSize,
    };
  })
  .filter(Boolean);      

      const stockCheckRes = await fetch("https://api.babatextiles.com/api/products/validate-stock/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ items: validationPayload }),
      });

      const stockCheckData = await stockCheckRes.json();

      if (!stockCheckRes.ok || stockCheckData.status === "error") {
        toast.error(
          stockCheckData.message || 
          "Some items in your cart exceed available stock. Please adjust quantities."
        );
        setIsProcessing(false);
        return;
      }

      // ==========================================
      // ✅ 2. CREATE ORDER & GET RAZORPAY ID
      // ==========================================
const orderData = {
  items: cart
    .map((item) => {
      let variant = null;

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

  name: `${form.firstName} ${form.lastName}`,
  address: form.address,
  city: form.city,
  state: form.state,
  pincode: form.pincode,
  phone: form.phone,
};

      const orderRes = await fetch("https://api.babatextiles.com/api/create-order/", {
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

      // ==========================================
      // ✅ 3. OPEN RAZORPAY
      // ==========================================
      const options = {
        key: orderResponseData.key,
        amount: orderResponseData.amount,
        currency: "INR",
        name: "Baba Textiles",
        description: "Wholesale Order Payment",
        order_id: orderResponseData.razorpay_order_id,
        
        handler: async function (response: any) {
          // Prevent double-firing from Razorpay
          if (hasProcessedPayment.current) return;
          hasProcessedPayment.current = true;

          try {
            // ==========================================
            // ✅ 4. VERIFY PAYMENT (Marks order as "paid")
            // ==========================================
            const verifyRes = await fetch("https://api.babatextiles.com/api/verify-payment/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.status !== "success") {
              toast.error("Payment verification failed");
              setIsProcessing(false);
              return;
            }

            // Save address to profile if checked
            if (saveAddressToProfile && token) {
              await fetch("https://api.babatextiles.com/api/auth/addresses/", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  name: `${form.firstName} ${form.lastName}`,
                  phone: form.phone,
                  street: form.address,
                  city: form.city,
                  state: form.state,
                  pincode: form.pincode,
                }),
              });
            }

            clearCart();
            navigate("/order-success", {
              state: { orderNumber: orderResponseData.order_number },
              replace: true
            });
            toast.success("Payment Successful!");
            setIsProcessing(false);

          } catch (err: any) {
            console.error("Verification error:", err);
            toast.error("Payment verification failed. Please contact support.");
            setIsProcessing(false);
          }
        },
        prefill: {
          name: user?.name || "Customer",
          email: user?.email || "",
        },
        theme: { color: "#0f766e" },
        modal: {
          ondismiss: function() {
            toast.warn("Payment window closed. Your order is pending.");
            setIsProcessing(false);
          }
        }
      };

      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        toast.error("Payment gateway failed to load");
        setIsProcessing(false);
        return;
      }
      
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function () {
        toast.error("Payment was not completed.");
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
              <form id="checkout-form" onSubmit={handlePlaceOrder}>
                <h2 className="text-xl font-medium text-baba-primary mb-6">Shipping Information</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      required
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                    <input
                      required
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                    <input
                      required
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      required
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code *</label>
                    <input
                      required
                      type="text"
                      value={form.pincode}
                      onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <input
                      required
                      type="text"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                      placeholder="e.g. Andhra Pradesh"
                    />
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
