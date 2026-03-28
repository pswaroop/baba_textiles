import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import { CheckCircle, ShieldCheck, FileText, MapPin } from "lucide-react";
import { toast } from "react-toastify";

export default function Checkout() {
  const { cart, cartTotal, shippingTotal, orderTotal, clearCart, user } =
    useShop();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);

  // ✅ State-based form control to allow "Quick Select" to fill inputs
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    pincode: "",
    state: "",
    phone: "",
  });

  // ✅ Fetch saved addresses on component load
  useEffect(() => {
    const fetchAddresses = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(
          "https://api.babatextiles.com/api/auth/addresses/",
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
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

  // ✅ Helper to fill form when a saved address is clicked
  const handleSelectAddress = (addr: any) => {
    // const nameParts = addr.name.split(" ");
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

  // if (cart.length === 0) {
  //   navigate('/cart');
  //   return null;
  // }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const token = localStorage.getItem("token");

      // 1️⃣ Create Razorpay order
      const safeAmount = Number(orderTotal);

      if (!safeAmount || isNaN(safeAmount)) {
        toast.error("Invalid order amount");
        setIsProcessing(false);
        return;
      }

      const paymentRes = await fetch(
        "https://api.babatextiles.com/api/create-payment/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: safeAmount }),
        },
      );

      if (!paymentRes.ok) {
        toast.error("Failed to initiate payment");
        setIsProcessing(false);
        return;
      }

      const paymentData = await paymentRes.json();

      const options = {
        key: paymentData.key,
        amount: paymentData.amount,
        currency: "INR",
        name: "Baba Textiles",
        description: "Wholesale Order Payment",
        order_id: paymentData.razorpay_order_id,
        handler: async function (response: any) {
          // 2️⃣ Verify payment
          const verifyRes = await fetch(
            "https://api.babatextiles.com/api/verify-payment/",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            },
          );

          const verifyData = await verifyRes.json();
          if (verifyData.status !== "success") {
            toast.error("Payment verification failed");
            setIsProcessing(false);
            return;
          }

          // ✅ OPTIONAL: Save address to profile if checkbox is checked
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
                state: form.state, // You can update this to a state field if needed
                pincode: form.pincode,
              }),
            });
          }

          // 3️⃣ Create Django order
          const orderData = {
            items: cart
              ?.map((item) => {
                if (!item || !item.product || !item.product.variants?.length) {
                  console.error("Invalid cart item:", item);
                  return null;
                }

                let variant;

                if (item.selectedSize) {
                  variant = item.product.variants.find(
                    (v) =>
                      v.size === item.selectedSize &&
                      v.color === item.selectedColor?.name,
                  );
                } else {
                  variant = item.product.variants[0];
                }

                if (!variant) {
                  console.error("Variant not found:", item);
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
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          };

          const orderRes = await fetch(
            "https://api.babatextiles.com/api/create-order/",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` }),
              },
              body: JSON.stringify(orderData),
            },
          );

          const order = await orderRes.json();
          clearCart();
          navigate("/order-success", {
            state: { orderNumber: order.order_number },
          });
          toast.success("Payment Successful!");
          setIsProcessing(false);
        },
        prefill: {
          name: user?.name || "Customer",
          email: user?.email || "",
        },
        theme: { color: "#0f766e" },
      };

      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        toast.error("Payment gateway failed to load");
        setIsProcessing(false);
        return;
      }
      const rzp = new Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error(error);
      toast.error("Payment failed");
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-baba-softbg min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif text-baba-primary font-bold">
            Secure Checkout
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-500">
            <ShieldCheck className="w-4 h-4 text-green-600" /> 256-bit Encrypted
            Connection
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="lg:w-2/3">
            {/* ✅ QUICK SELECT SAVED ADDRESSES */}
            {savedAddresses.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MapPin size={14} className="text-baba-accent" /> Use a Saved
                  Address
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handleSelectAddress(addr)}
                      className="text-left p-4 border border-gray-100 rounded-lg hover:border-baba-accent hover:bg-baba-softbg transition group"
                    >
                      <p className="font-bold text-baba-primary text-sm">
                        {addr.name}
                      </p>
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
                <h2 className="text-xl font-medium text-baba-primary mb-6">
                  Shipping Information
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      required
                      type="text"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address *
                    </label>
                    <input
                      required
                      type="text"
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      required
                      type="text"
                      value={form.city}
                      onChange={(e) =>
                        setForm({ ...form, city: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PIN Code *
                    </label>
                    <input
                      required
                      type="text"
                      value={form.pincode}
                      onChange={(e) =>
                        setForm({ ...form, pincode: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State *
                    </label>
                    <input
                      required
                      type="text"
                      value={form.state}
                      onChange={(e) =>
                        setForm({ ...form, state: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 focus:ring-baba-accent focus:border-baba-accent"
                      placeholder="e.g. Andhra Pradesh"
                    />
                  </div>
                </div>

                {/* ✅ SAVE ADDRESS OPTION */}
                <div className="flex items-center gap-2 mb-8 bg-gray-50 p-3 rounded-md border border-gray-100">
                  <input
                    type="checkbox"
                    id="save-to-profile"
                    checked={saveAddressToProfile}
                    onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                    className="w-4 h-4 accent-baba-primary"
                  />
                  <label
                    htmlFor="save-to-profile"
                    className="text-sm text-gray-600 cursor-pointer"
                  >
                    Save this address to my profile for future orders
                  </label>
                </div>

                <h2 className="text-xl font-medium text-baba-primary mb-6">
                  Payment Method
                </h2>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked
                      readOnly
                      className="w-4 h-4 text-baba-accent focus:ring-baba-accent border-gray-300"
                    />
                    <span className="font-medium text-gray-900">
                      Online Payment (Razorpay)
                    </span>
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
              <h2 className="text-xl font-medium text-baba-primary mb-6 border-b pb-4">
                Order Summary
              </h2>

              <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <img
                      src={
                        item.selectedColor.images?.[0]?.image ||
                        "/placeholder.png"
                      }
                      alt=""
                      className="w-16 h-16 object-cover rounded-md border border-gray-100"
                    />
                    <div className="flex-grow">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.selectedColor.name} | Qty: {item.quantity}
                      </p>
                      <p className="text-sm font-semibold text-baba-primary mt-1">
                        ₹
                        {(item.product.price * item.quantity).toLocaleString(
                          "en-IN",
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Items Subtotal</span>
                  <span>₹{cartTotal.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    Wholesale Shipping
                  </span>
                  <span>₹{shippingTotal.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex justify-between text-xl font-bold text-baba-primary pt-3 border-t border-gray-200 mt-2">
                  <span>Grand Total</span>
                  <span className="text-baba-accent">
                    ₹{orderTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                form="checkout-form"
                disabled={isProcessing}
                className="w-full bg-baba-primary text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-baba-accent transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isProcessing ? "Processing..." : "Pay & Place Order"}
              </button>

              <p className="text-[10px] text-center text-gray-400 mt-4 uppercase tracking-tighter">
                By placing order you agree to wholesale terms
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
