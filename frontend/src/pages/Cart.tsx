import React, { useState } from "react";
import { usePageMeta } from "../utils/pageMeta";
import { smallestProductImage } from "../utils/images";
import { Link, useNavigate } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import { Trash2, ArrowRight, Minus, Plus, Info } from "lucide-react";

export default function Cart() {
  usePageMeta({ title: "Your Cart", noindex: true });
  const { cart, removeFromCart, updateCartQuantity, cartTotal } = useShop();
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const navigate = useNavigate();

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.toUpperCase() === "FESTIVE20" && cartTotal >= 50000) {
      setDiscount(cartTotal * 0.2);
    } else if (promoCode.toUpperCase() === "FESTIVE20") {
      alert("Minimum order value of ₹50,000 required.");
      setDiscount(0);
    } else {
      alert("Invalid promo code.");
      setDiscount(0);
    }
  };

  // Note: We use cartTotal - discount here. 
  // Shipping is NOT added here per your requirement.
  const finalSubtotal = cartTotal - discount;

  if (cart.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-baba-softbg">
        <h2 className="text-3xl font-serif text-baba-primary">Your cart is empty</h2>
        <Link to="/shop" className="mt-6 bg-baba-primary text-white px-8 py-3 rounded-sm hover:bg-baba-accent transition shadow-md">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 bg-baba-softbg">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-3xl font-serif font-bold mb-8 text-baba-primary">Shopping Cart</h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* CART ITEMS */}
          <div className="lg:w-2/3 space-y-4">
            {cart.map((item) => {
              // Same lookup order as Checkout: the stored variant id first.
              const variant =
                item.product.variants.find((v) => v.id === item.variantId) ||
                item.product.variants.find(
                  (v) =>
                    v.size === item.selectedSize &&
                    v.color?.name === item.selectedColor?.name
                );

              // Unsized products have no size to match, which used to leave
              // them uncapped and fail later at payment with a stock error.
              const isAtStockLimit = !!variant && item.quantity >= variant.stock;
              
              // FIXED: Read image from product.images instead of selectedColor
              // Fallback to the first product image if nothing is found
              const image = item.selectedImageUrl || smallestProductImage(item.product.images?.[0]);

              return (
                <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex gap-6 relative">
                  <div className="w-28 h-28 flex-shrink-0 bg-gray-50 rounded-md border border-gray-200 overflow-hidden">
                    <img
                      src={image}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-grow flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link to={`/product/${item.product.id}`} className="font-serif font-bold text-lg text-baba-primary hover:text-baba-accent transition">
                          {item.product.name}
                        </Link>
                        
                        {item.selectedColor && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm text-gray-500">Color:</span>
                            <span className="text-sm font-medium">{item.selectedColor.name}</span>
                            <div 
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: item.selectedColor.color }}
                            />
                          </div>
                        )}
                        
                        {item.selectedSize && (
                          <p className="text-sm text-gray-500 mt-1">
                            Size: <span className="font-medium text-black">{item.selectedSize}</span>
                          </p>
                        )}
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.id)} 
                        className="text-red-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-full"
                        title="Remove item"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="flex justify-between items-end mt-4">
                      <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
                        <button
                          onClick={() => updateCartQuantity(item.id, Math.max(1, item.quantity - 1))}
                          className="p-2.5 hover:bg-gray-100 transition-colors text-gray-600"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center font-medium text-sm">{item.quantity}</span>
                        <button
                          disabled={isAtStockLimit}
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          className="p-2.5 hover:bg-gray-100 transition-colors text-gray-600 disabled:opacity-30 disabled:hover:bg-white"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-xl text-baba-primary">
                          ₹{(item.product.price * item.quantity).toLocaleString("en-IN")}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-gray-400 mt-1">
                            ₹{item.product.price.toLocaleString("en-IN")} each
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SUMMARY */}
          <div className="lg:w-1/3">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 sticky top-28">
              <h2 className="text-xl font-serif font-bold mb-6 text-baba-primary border-b pb-4">Order Summary</h2>

              <div className="space-y-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({cart.reduce((acc, item) => acc + item.quantity, 0)} items)</span>
                  <span className="font-medium">₹{cartTotal.toLocaleString("en-IN")}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Promo Discount</span>
                    <span>-₹{discount.toLocaleString("en-IN")}</span>
                  </div>
                )}

                <div className="pt-4 mt-2 border-t border-gray-100 flex justify-between items-end">
                  <div>
                      <span className="text-lg font-serif font-bold text-baba-primary">Total Amount</span>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Excluding Shipping</p>
                  </div>
                  <span className="text-2xl font-serif font-bold text-baba-accent">
                      ₹{finalSubtotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg flex gap-3 items-start text-blue-800 text-xs leading-relaxed border border-blue-100">
                  <Info size={18} className="shrink-0 text-blue-500" />
                  <p>Wholesale shipping charges are calculated based on item categories and will be displayed on the final checkout page.</p>
              </div>

              <button
                onClick={() => navigate("/checkout")}
                className="w-full bg-black text-white py-4 mt-8 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-gray-800 transition-colors shadow-lg flex justify-center items-center gap-2"
              >
                Proceed to Checkout <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
