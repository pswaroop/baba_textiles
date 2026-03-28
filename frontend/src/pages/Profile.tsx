import React, { useEffect, useState } from "react";
import { useShop } from "../context/ShopContext";
import { useNavigate } from "react-router-dom";
import {
  Package,
  MapPin,
  LogOut,
  ChevronRight,
  Clock,
  Tag,
} from "lucide-react";
import { motion } from "framer-motion";

/* ✅ Types */
interface OrderItem {
  variant_name: string;
  quantity: number;
}

interface Order {
  id: number;
  order_number: string;
  created_at: string;
  items: OrderItem[];
  status?: string; // ✅ optional for safety
}

export default function Profile() {
  const { user, logout } = useShop();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const token = localStorage.getItem("token");
      // ✅ CORRECT

      if (!token) {
        console.error("No token found");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          "https://api.babatextiles.com/api/auth/orders/",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        // 🚨 Handle unauthorized
        if (res.status === 401) {
          console.error("Unauthorized - login again");
          logout();
          navigate("/login");
          return;
        }

        if (!res.ok) {
          console.error("Failed response:", res.status);
          setLoading(false);
          return;
        }

        const data = await res.json();
        console.log("ORDERS:", data); // DEBUG

        setOrders(data);
      } catch (err) {
        console.error("Failed to fetch orders", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchOrders();
  }, [user, navigate, logout]);

  if (!user) return null;

  return (
    <div className="bg-white min-h-screen">
      {/* 🔹 Header */}
      <div className="bg-baba-softbg py-20 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-baba-primary text-white rounded-full flex items-center justify-center text-3xl font-serif shadow-inner">
              {user.name ? user.name[0] : "U"}
            </div>
            <div>
              <h1 className="text-4xl font-serif font-bold text-baba-primary">
                {user.name}
              </h1>
              <p className="text-gray-500 tracking-widest uppercase text-xs mt-1">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* 🔹 Left Menu */}
          <div className="lg:col-span-4">
            <nav className="space-y-1">
              <button
                onClick={() => navigate("/addresses")}
                className="w-full flex items-center justify-between py-4 text-gray-600 hover:text-baba-accent transition border-b"
              >
                <span className="flex items-center gap-3 font-medium">
                  <MapPin size={18} /> Manage Addresses
                </span>
                <ChevronRight size={14} />
              </button>

              <button
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="w-full flex items-center gap-3 py-4 text-red-400 hover:text-red-600 font-medium"
              >
                <LogOut size={18} /> Sign Out
              </button>
            </nav>
          </div>

          {/* 🔹 Orders */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 mb-8">
              <Package size={20} className="text-baba-accent" />
              <h2 className="text-2xl font-serif font-bold text-baba-primary">
                Order History
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 text-gray-400 italic">
                <div className="w-4 h-4 border-2 border-baba-accent border-t-transparent rounded-full animate-spin" />
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center bg-gray-50 rounded-xl border border-dashed">
                <p className="text-gray-400">No orders found yet.</p>
                <button
                  onClick={() => navigate("/shop")}
                  className="text-baba-accent mt-2 hover:underline"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {orders.map((order) => {
                  const status = order.status || "processed";

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      className="py-8"
                    >
                      <div className="flex justify-between mb-4">
                        <div>
                          {/* ✅ STATUS */}
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${
                              status === "delivered"
                                ? "text-green-600"
                                : status === "shipped"
                                  ? "text-blue-600"
                                  : status === "cancelled"
                                    ? "text-red-600"
                                    : status === "confirmed"
                                      ? "text-purple-600"
                                      : "text-yellow-600"
                            }`}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>

                          <h3 className="text-lg font-mono font-bold text-baba-primary">
                            #{order.order_number}
                          </h3>

                          <p className="text-sm text-gray-400 flex items-center gap-1">
                            <Clock size={14} />
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-gray-400">ITEMS</p>
                          <p className="font-bold">{order.items.length}</p>
                        </div>
                      </div>

                      {/* 🔹 Items */}
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="bg-baba-softbg text-baba-primary text-xs px-3 py-1 rounded-full border flex items-center gap-1"
                          >
                            <Tag size={10} />
                            {item.variant_name} x{item.quantity}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
