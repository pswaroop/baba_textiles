import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-toastify";

const API_BASE = "https://api.babatextiles.com/api/products";
const AUTH_BASE = "https://api.babatextiles.com/api/auth";

/* ================= TYPES ================= */

export type ProductColorImage = {
  id: number;
  image: string;
};

export type ProductColor = {
  id: number;
  name: string;
  color: string;
  images: ProductColorImage[];
};

export type ProductVariant = {
  id: number;
  size: string;
  stock: number;
  color: string;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  price: number;
  original_price: number;
  discount_percentage: number;
  shipping_charge: number; // ✅ Add this line
  has_sizes: boolean;
  category: string;
  description: string;
  tags: string[];
  colors: ProductColor[];
  variants: ProductVariant[];
};

export type CartItem = {
  id: string;
  product: Product;
  selectedColor: ProductColor;
  selectedSize: string;
  quantity: number;
};

export type User = {
  id: number;
  name: string;
  email: string;
};

type ShopContextType = {
  products: Product[];
  latestProducts: Product[];
  popularProducts: Product[];
  budgetProducts: Product[];

  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>; // Add this line
  logout: () => void;

  cart: CartItem[];
  addToCart: (
    product: Product,
    color: ProductColor,
    size: string,
    quantity: number,
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  cartTotal: number;
  shippingTotal: number; // ✅ Add this
  orderTotal: number; // ✅ Add this
  clearCart: () => void;

  wishlist: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
};

const ShopContext = createContext<ShopContextType | undefined>(undefined);

/* ================= PROVIDER ================= */

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [latestProducts, setLatestProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [budgetProducts, setBudgetProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const [wishlist, setWishlist] = useState<Product[]>(() => {
    const stored = localStorage.getItem("wishlist");
    return stored ? JSON.parse(stored) : [];
  });

  /* ================= LOGOUT ================= */

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  /* ================= MAP PRODUCTS ================= */

  const mapProducts = (data: any[]): Product[] =>
    data.map((item: any) => ({
      id: String(item.id),
      code: item.code,
      name: item.name,
      price: Number(item.price),
      original_price: Number(item.original_price),
      discount_percentage: Number(item.discount_percentage),
      shipping_charge: Number(item.shipping_charge) || 0, // ✅ Add this line
      has_sizes: item.has_sizes,
      category: item.category_name,
      description: item.description,
      tags: item.tag_names || [],
      colors: item.colors.map((color: any) => ({
        id: color.id,
        name: color.name,
        color: color.color,
        images: color.images || [],
      })),
      // variants: item.variants || [],
      variants: Array.isArray(item.variants) ? item.variants : [],
    }));

  /* ================= FETCH PRODUCTS ================= */

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const [latestRes, popularRes, budgetRes] = await Promise.all([
          fetch(`${API_BASE}/tag/latest/`),
          fetch(`${API_BASE}/tag/popular/`),
          fetch(`${API_BASE}/tag/budget/`),
        ]);

        const latestMapped = mapProducts(await latestRes.json());
        const popularMapped = mapProducts(await popularRes.json());
        const budgetMapped = mapProducts(await budgetRes.json());

        setLatestProducts(latestMapped);
        setPopularProducts(popularMapped);
        setBudgetProducts(budgetMapped);

        const combinedMap = new Map<string, Product>();

        [...latestMapped, ...popularMapped, ...budgetMapped].forEach(
          (product) => {
            if (combinedMap.has(product.id)) {
              const existing = combinedMap.get(product.id)!;

              existing.tags = Array.from(
                new Set([...existing.tags, ...product.tags]),
              );
            } else {
              combinedMap.set(product.id, product);
            }
          },
        );

        setProducts(Array.from(combinedMap.values()));
      } catch (error) {
        console.error("Product fetch error:", error);
      }
    };

    fetchProducts();
  }, []);

  /* ================= FETCH USER ================= */

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");

      if (!token) return;

      try {
        const res = await fetch(`${AUTH_BASE}/me/`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          localStorage.removeItem("token");
          setUser(null);
          return;
        }

        const data = await res.json();
        setUser(data);
      } catch (error) {
        console.error("User fetch error:", error);
      }
    };

    fetchUser();
  }, []);

  /* ================= CART ================= */

  const addToCart = (
    product: Product,
    color: ProductColor,
    size: string,
    quantity: number,
  ) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          item.selectedColor.id === color.id &&
          item.selectedSize === size,
      );

      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [
        ...prev,
        {
          // id: Math.random().toString(36).substring(2, 9),
          id: crypto.randomUUID(),
          product,
          // selectedColor: color,
          // selectedSize: size,
          selectedColor: color || null,
          selectedSize: size || "",
          quantity,
        },
      ];
    });
  };

  const removeFromCart = (cartItemId: string) =>
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));

  const updateCartQuantity = (cartItemId: string, quantity: number) =>
    setCart((prev) =>
      prev.map((item) =>
        item.id === cartItemId ? { ...item, quantity } : item,
      ),
    );

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  // ✅ Add this calculation for cumulative shipping
  // const shippingTotal = cart.reduce(
  //   (total, item) => total + (item.product.shipping_charge * item.quantity),
  //   0
  // );
  const shippingTotal = cart.reduce(
    (total, item) =>
      total + Number(item.product.shipping_charge || 0) * item.quantity,
    0,
  );

  // ✅ Add this for the Grand Total
  // const orderTotal = cartTotal + shippingTotal;
  const orderTotal = Number(cartTotal) + Number(shippingTotal);

  /* ================= WISHLIST ================= */

  useEffect(() => {
    localStorage.setItem("wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  const addToWishlist = (product: Product) => {
    if (!wishlist.find((p) => p.id === product.id)) {
      toast.success("Added to wishlist");
      setWishlist([...wishlist, product]);
    }
  };

  const removeFromWishlist = (productId: string) =>
    setWishlist(wishlist.filter((item) => item.id !== productId));

  const isInWishlist = (productId: string) =>
    wishlist.some((item) => item.id === productId);

  return (
    <ShopContext.Provider
      value={{
        products,
        latestProducts,
        popularProducts,
        budgetProducts,

        user,
        setUser,
        logout,
        shippingTotal, // ✅ Add this
        orderTotal,

        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        cartTotal,
        clearCart,

        wishlist,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);

  if (!context) {
    throw new Error("useShop must be used within a ShopProvider");
  }

  return context;
};
