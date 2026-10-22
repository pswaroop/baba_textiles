import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import type { CartHandoffEntry } from "../utils/checkout";

const API_BASE = "https://api.babatextiles.com/api/products";
const AUTH_BASE = "https://api.babatextiles.com/api/auth";

/* ================= TYPES ================= */

export type ProductImage = {
  id: number;
  image: string;
  // Small (~400px) variant for grid/list tiles (cards, cart, checkout).
  // Falls back to `image` when absent (e.g. older rows not yet backfilled).
  thumbnail: string | null;
  // Smallest stored width (300px): cart/checkout tiles and srcset.
  small?: string | null;
  // 400px: shop cards on 2x-density phones.
  medium?: string | null;
  color: number | null;
};

export type ProductColor = {
  id: number;
  name: string;
  color: string;
};

export type ProductVariant = {
  id: number;
  size: string;
  stock: number;
  color: ProductColor;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  price: number;
  original_price: number;
  discount_percentage: number;
  shipping_charge: number;
  has_sizes: boolean;
  category: number | string;
  category_name: string;
  description: string;
  tag_names: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  available_colors: ProductColor[];
};

export type CartItem = {
  id: string;
  product: Product;
  selectedColor: ProductColor | null;
  selectedSize: string;
  quantity: number;
  variantId: number;
  selectedImageUrl: string;
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
  isLoading: boolean; // Tells the UI if we are currently fetching products
  fetchProductById: (productId: string) => Promise<Product | null>;

  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  logout: () => void;

  cart: CartItem[];
  addToCart: (
    product: Product,
    color: ProductColor | null,
    size: string,
    quantity: number,
    variantId: number,
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  cartTotal: number;
  shippingTotal: number;
  orderTotal: number;
  clearCart: () => void;
  // Rebuilds the cart from a checkout hand-off link; returns how many items
  // could be restored.
  restoreCart: (entries: CartHandoffEntry[]) => Promise<number>;
  // Drops cart items whose product or size no longer exists; returns their names.
  pruneCart: () => Promise<string[]>;

  wishlist: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
};

const ShopContext = createContext<ShopContextType | undefined>(undefined);

/* ================= HELPERS ================= */

function resolveImageForColor(
  images: ProductImage[],
  color: ProductColor | null,
): string {
  if (!images?.length) return "/placeholder.png";

  // Cart/checkout only ever show this at thumbnail size, so prefer the
  // small variant over the full detail-page image.
  if (color) {
    const colorId = color.id;
    const matched = images.find(
      (img) => img.color !== null && img.color === colorId,
    );
    if (matched) return matched.small || matched.thumbnail || matched.image;
  }

  return images[0].small || images[0].thumbnail || images[0].image || "/placeholder.png";
}

// crypto.randomUUID() is missing on older Android WebViews and iOS < 15.4
// (common in Instagram/Facebook in-app browsers), where it crashed Add to Cart.
function createCartItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// The cart survives reloads: in-app browsers often reload the page while the
// customer is away in their UPI app, and Razorpay's redirect mode leaves the
// page entirely.
const CART_STORAGE_KEY = "cart";

function loadStoredCart(): CartItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((item) => item && item.id && item.product && item.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

/* ================= PROVIDER ================= */

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [latestProducts, setLatestProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [budgetProducts, setBudgetProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoriesFromAPI, setCategoriesFromAPI] = useState<string[]>([]);  
  const [cart, setCart] = useState<CartItem[]>(loadStoredCart);
  const [user, setUser] = useState<User | null>(null);

  const [wishlist, setWishlist] = useState<Product[]>(() => {
    try {
      const stored = localStorage.getItem("wishlist");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  /* ================= LOGOUT ================= */
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  /* ================= MAP PRODUCTS ================= */
  const mapProducts = useCallback((data: any[]): Product[] =>
    Array.isArray(data)
      ? data.map((item: any) => ({
          id: String(item.id),
          code: item.code || "",
          name: item.name || "",
          price: Number(item.price) || 0,
          original_price: Number(item.original_price) || 0,
          discount_percentage: Number(item.discount_percentage) || 0,
          shipping_charge: Number(item.shipping_charge) || 0,
          has_sizes: Boolean(item.has_sizes),
          category: item.category,
          category_name: item.category_name || "",
          description: item.description || "",
          tag_names: Array.isArray(item.tag_names) ? item.tag_names : [],
          images: Array.isArray(item.images)
            ? item.images.map((img: any) => ({
                id: img.id,
                image: img.image,
                thumbnail: img.thumbnail ?? null,
                small: img.small ?? null,
                medium: img.medium ?? null,
                color: img.color ?? null,
              }))
            : [],
          available_colors: Array.isArray(item.available_colors)
            ? item.available_colors.map((c: any) => ({
                id: c.id,
                name: c.name,
                color: c.color,
              }))
            : [],
          variants: Array.isArray(item.variants)
            ? item.variants.map((v: any) => ({
                id: v.id,
                size: v.size,
                stock: Number(v.stock) || 0,
                color: {
                  id: v.color?.id,
                  name: v.color?.name || "",
                  color: v.color?.color || "#000000",
                },
              }))
            : [],
        }))
      : [], []);

  /* ================= FETCH PRODUCTS ================= */
  
  // ShopContext.tsx — replace the fetchProducts useEffect

useEffect(() => {
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/all-tagged/`);
      const data = await res.json();

      const latest  = mapProducts(data.latest  ?? []);
      const popular = mapProducts(data.popular ?? []);
      const budget  = mapProducts(data.budget  ?? []);

      // ✅ Merge all three into one Map — single setState, single re-render
      const map = new Map<string, Product>();
      const merge = (items: Product[]) => {
        for (const item of items) {
          const existing = map.get(item.id);
          if (existing) {
            existing.tag_names = Array.from(new Set([...existing.tag_names, ...item.tag_names]));
          } else {
            map.set(item.id, item);
          }
        }
      };
      merge(latest);
      merge(popular);
      merge(budget);

      // ✅ Also expose categories derived from products
      const categoryMap = new Map<string, string>();
      for (const p of map.values()) {
        if (p.category && p.category_name) {
          categoryMap.set(String(p.category), p.category_name);
        }
      }

      // Single batched update — React 18 auto-batches these anyway,
      // but being explicit avoids any edge-case flush in older React.
      setLatestProducts(latest);
      setPopularProducts(popular);
      setBudgetProducts(budget);
      setProducts(Array.from(map.values()));
      setCategoriesFromAPI(Array.from(categoryMap.values()));
    } catch (e) {
      console.error("Product fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  fetchProducts();
}, [mapProducts]);
  /* ================= FETCH USER ================= */
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${AUTH_BASE}/me/`, {
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
  const addToCart = useCallback((
    product: Product,
    color: ProductColor | null,
    size: string,
    quantity: number,
    variantId: number,
  ) => {
    const selectedImageUrl = resolveImageForColor(product.images, color);

    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          item.selectedColor?.id === color?.id &&
          item.selectedSize === (size || "") &&
          item.variantId === variantId,
      );

      if (existing) {
        // Adding the same size again must not go past what is in stock, or
        // the order is rejected at payment.
        const available = product.variants.find((v) => v.id === variantId)?.stock;
        let next = existing.quantity + quantity;
        if (available !== undefined && available > 0 && next > available) {
          next = available;
          toast.warn(`Only ${available} in stock. Your cart has ${available} of this item.`);
        }
        return prev.map((item) =>
          item.id === existing.id ? { ...item, quantity: next } : item,
        );
      }

      return [
        ...prev,
        {
          id: createCartItemId(),
          product,
          selectedColor: color,
          selectedSize: size || "",
          quantity,
          variantId,
          selectedImageUrl,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  }, []);

  const updateCartQuantity = useCallback((cartItemId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === cartItemId ? { ...item, quantity } : item,
      ),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage full or blocked — the cart still works for this page view.
    }
  }, [cart]);

  // A stored cart carries a snapshot of each product. Swap in the fresh copy
  // once products load so prices and stock shown at checkout are current.
  useEffect(() => {
    if (!products.length) return;
    const freshById = new Map(products.map((p) => [p.id, p]));
    setCart((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const fresh = freshById.get(item.product.id);
        if (!fresh || fresh === item.product) return item;
        changed = true;
        return { ...item, product: fresh };
      });
      return changed ? next : prev;
    });
  }, [products]);

  /* ================= FETCH SINGLE PRODUCT ================= */
  // Only tagged products are preloaded; a shared link to any other product
  // falls back to fetching it on its own.
  const fetchProductById = useCallback(async (productId: string): Promise<Product | null> => {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(productId)}/`);
      if (!res.ok) return null;
      return mapProducts([await res.json()])[0] ?? null;
    } catch (e) {
      console.error("Product fetch error:", e);
      return null;
    }
  }, [mapProducts]);

  const restoreCart = useCallback(async (entries: CartHandoffEntry[]) => {
    const items: CartItem[] = [];

    for (const entry of entries) {
      const product = await fetchProductById(entry.productId);
      const variant = product?.variants.find((v) => v.id === entry.variantId);
      if (!product || !variant) continue;

      const color =
        product.available_colors.find((c) => c.id === variant.color?.id) ||
        (variant.color?.id ? variant.color : null);

      items.push({
        id: createCartItemId(),
        product,
        selectedColor: color,
        selectedSize: product.has_sizes ? variant.size : "",
        quantity: entry.quantity,
        variantId: variant.id,
        selectedImageUrl: resolveImageForColor(product.images, color),
      });
    }

    if (items.length) setCart(items);
    return items.length;
  }, [fetchProductById]);

  const pruneCart = useCallback(async () => {
    const productIds = Array.from(new Set(cart.map((item) => item.product.id)));
    const gone = new Set<string>();
    const variantsById = new Map<string, Set<number>>();

    await Promise.all(
      productIds.map(async (productId) => {
        try {
          const res = await fetch(`${API_BASE}/${encodeURIComponent(productId)}/`);
          // Only a definite "not found" removes anything; a network blip must not.
          if (res.status === 404) {
            gone.add(productId);
          } else if (res.ok) {
            const [fresh] = mapProducts([await res.json()]);
            if (fresh) variantsById.set(productId, new Set(fresh.variants.map((v) => v.id)));
          }
        } catch {
          // Keep the item; the server still checks it at payment.
        }
      })
    );

    const removed: string[] = [];
    const isStale = (item: CartItem) =>
      gone.has(item.product.id) ||
      (variantsById.has(item.product.id) && !variantsById.get(item.product.id)!.has(item.variantId));
    for (const item of cart) {
      if (isStale(item) && !removed.includes(item.product.name)) removed.push(item.product.name);
    }
    if (removed.length) setCart((prev) => prev.filter((item) => !isStale(item)));
    return removed;
  }, [cart, mapProducts]);

  /* ================= DERIVED CART TOTALS ================= */
  const cartTotal = useMemo(() => 
    cart.reduce((total, item) => total + item.product.price * item.quantity, 0), 
  [cart]);

  const shippingTotal = useMemo(() => 
    cart.reduce((total, item) => total + Number(item.product.shipping_charge || 0) * item.quantity, 0), 
  [cart]);
  
  const orderTotal = useMemo(() => cartTotal + shippingTotal, [cartTotal, shippingTotal]);

  /* ================= WISHLIST ================= */
  useEffect(() => {
    localStorage.setItem("wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  const addToWishlist = useCallback((product: Product) => {
    setWishlist((prev) => {
      if (!prev.find((p) => p.id === product.id)) {
        toast.success("Added to wishlist");
        return [...prev, product];
      }
      return prev;
    });
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    setWishlist((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const isInWishlist = useCallback((productId: string) => {
    return wishlist.some((item) => item.id === productId);
  }, [wishlist]);


  /* ================= MEMOIZE THE PROVIDER VALUE ================= */
  // This is the critical step to prevent unnecessary re-renders across the app
  const contextValue = useMemo(() => ({
    products,
    latestProducts,
    popularProducts,
    budgetProducts,
    isLoading,
    fetchProductById,
    user,
    setUser,
    logout,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    cartTotal,
    shippingTotal,
    orderTotal,
    clearCart,
    restoreCart,
    pruneCart,
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  }), [
    products,
    latestProducts,
    popularProducts,
    budgetProducts,
    isLoading,
    fetchProductById,
    user,
    cart,
    cartTotal,
    shippingTotal,
    orderTotal,
    wishlist,
    logout,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    restoreCart,
    pruneCart,
    addToWishlist,
    removeFromWishlist,
    isInWishlist
  ]);

  return (
    <ShopContext.Provider value={contextValue}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within ShopProvider");
  }
  return context;
};
