// import React, { useState, useEffect } from 'react';
// import { useParams, Link } from 'react-router-dom';
// import { useShop } from '../context/ShopContext';
// import type { ProductColor } from '../context/ShopContext';
// import {
//   ShoppingBag,
//   ChevronRight,
//   ShieldCheck,
//   Truck,
//   Heart,
//   ChevronDown
// } from 'lucide-react';
// import { motion, AnimatePresence } from 'framer-motion';

// export default function ProductDetail() {
//   const { id } = useParams();

//   const {
//     products,
//     addToCart,
//     addToWishlist,
//     removeFromWishlist,
//     isInWishlist
//   } = useShop();

//   // ✅ Define product correctly
//   const product = products.find((p) => p.id === id);

//   // Wishlist safe check
//   const wishlisted = product ? isInWishlist(product.id) : false;

//   const [selectedColor, setSelectedColor] =
//     useState<ProductColor | null>(null);
//   const [quantity, setQuantity] = useState(1);

//   useEffect(() => {
//     if (product && product.colors.length > 0) {
//       setSelectedColor(product.colors[0]);
//       setQuantity(1);
//     }
//   }, [product]);

//   if (!product || !selectedColor) {
//     return (
//       <div className="min-h-[60vh] flex items-center justify-center text-xl">
//         Product not found
//       </div>
//     );
//   }

//   const isOutOfStock = selectedColor.stock === 0;

//   const handleAddToCart = () => {
//     if (!isOutOfStock) {
//       addToCart(product, selectedColor, quantity);
//     }
//   };

//   return (
//     <div className="bg-baba-background min-h-screen py-10">
//       <div className="container mx-auto px-4">

//         {/* Breadcrumb */}
//         <nav className="flex items-center text-sm text-baba-textdark/60 mb-8">
//           <Link to="/" className="hover:text-baba-accent transition-colors">
//             Home
//           </Link>
//           <ChevronRight className="w-4 h-4 mx-2" />
//           <Link
//             to={`/shop?category=${product.category}`}
//             className="hover:text-baba-accent transition-colors"
//           >
//             {product.category}
//           </Link>
//           <ChevronRight className="w-4 h-4 mx-2" />
//           <span className="text-baba-primary font-medium truncate">
//             {product.name}
//           </span>
//         </nav>

//         <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
//           <div className="grid grid-cols-1 lg:grid-cols-2">

//             {/* IMAGE SECTION */}
//             <div className="relative bg-baba-softbg p-8 flex items-center justify-center min-h-[500px]">
//               <AnimatePresence mode="wait">
//                 <motion.img
//                   key={selectedColor.image}
//                   initial={{ opacity: 0, scale: 0.95 }}
//                   animate={{ opacity: 1, scale: 1 }}
//                   exit={{ opacity: 0, scale: 1.05 }}
//                   transition={{ duration: 0.4 }}
//                   src={selectedColor.image}
//                   alt={`${product.name} in ${selectedColor.name}`}
//                   className="max-h-[700px] w-full object-contain rounded-xl shadow-2xl"
//                 />
//               </AnimatePresence>

//               {isOutOfStock && (
//                 <div className="absolute top-8 right-8 bg-red-500 text-white font-bold px-4 py-2 rounded shadow-lg uppercase tracking-widest">
//                   Out of Stock
//                 </div>
//               )}

//               <span className="hidden" data-code={product.code}>
//                 {product.code}
//               </span>
//             </div>

//             {/* DETAILS SECTION */}
//             <div className="p-8 lg:p-12 flex flex-col justify-center">

//               <div className="mb-2 flex items-center justify-between">
//                 <span className="text-sm font-medium tracking-widest text-baba-accent uppercase">
//                   {product.category}
//                 </span>
//                 <span className="text-xs text-gray-400 font-mono">
//                   Ref: {product.code}
//                 </span>
//               </div>

//               {/* TITLE + WISHLIST */}
//               <div className="flex items-start justify-between mb-4">
//                 <h1 className="font-serif text-3xl md:text-5xl text-baba-primary font-bold leading-tight">
//                   {product.name}
//                 </h1>

//                 <button
//                   onClick={() =>
//                     wishlisted
//                       ? removeFromWishlist(product.id)
//                       : addToWishlist(product)
//                   }
//                   className="ml-4 p-3 rounded-full bg-baba-softbg hover:scale-110 transition"
//                 >
//                   <Heart
//                     size={22}
//                     className={`transition ${
//                       wishlisted
//                         ? "fill-red-500 text-red-500"
//                         : "text-baba-primary"
//                     }`}
//                   />
//                 </button>
//               </div>

//               <p className="text-2xl text-baba-primary font-medium mb-6">
//                 ₹{product.price.toLocaleString('en-IN')}
//                 <span className="text-sm text-gray-500 font-normal ml-2">
//                   Wholesale Rate
//                 </span>
//               </p>

//               <p className="text-baba-textdark/70 leading-relaxed mb-8">
//                 {product.description}
//               </p>

//               {/* COLOR SELECTOR */}
//               <div className="mb-8">
//                 <h3 className="text-sm font-semibold text-baba-primary uppercase tracking-wider mb-3">
//                   Color: {selectedColor.name}
//                 </h3>

//                 <div className="flex gap-3">
//                   {product.colors.map((color) => (
//                     <button
//                       key={color.name}
//                       onClick={() => {
//                         setSelectedColor(color);
//                         setQuantity(1);
//                       }}
//                       className={`w-12 h-12 rounded-full border-2 ${
//                         selectedColor.name === color.name
//                           ? 'border-baba-primary scale-110'
//                           : 'border-gray-200 hover:border-baba-accent'
//                       }`}
//                     >
//                       <span
//                         className="block w-full h-full rounded-full"
//                         style={{ backgroundColor: color.hex }}
//                       />
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               {/* ACTIONS */}
//               <div className="flex flex-col sm:flex-row gap-4 mb-8">
//                 <div className="relative">
//                   <select
//                     value={quantity}
//                     onChange={(e) =>
//                       setQuantity(Number(e.target.value))
//                     }
//                     disabled={isOutOfStock}
//                     className="h-14 px-6 border border-gray-300 rounded-sm bg-white text-lg appearance-none"
//                   >
//                     {Array.from(
//                       { length: selectedColor.stock },
//                       (_, i) => i + 1
//                     ).map((num) => (
//                       <option key={num} value={num}>
//                         {num}
//                       </option>
//                     ))}
//                   </select>
//                   <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
//                 </div>

//                 <button
//                   onClick={handleAddToCart}
//                   disabled={isOutOfStock}
//                   className="flex-1 h-14 flex items-center justify-center gap-3 bg-baba-primary text-white text-lg font-semibold rounded-sm hover:bg-baba-accent transition-colors disabled:bg-gray-300"
//                 >
//                   <ShoppingBag className="w-5 h-5" />
//                   {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
//                 </button>
//               </div>

//               <div className="border-t pt-6 grid grid-cols-2 gap-4">
//                 <div className="flex items-center gap-3 text-sm">
//                   <ShieldCheck className="w-5 h-5 text-baba-accent" />
//                   Premium Quality Assurance
//                 </div>
//                 <div className="flex items-center gap-3 text-sm">
//                   <Truck className="w-5 h-5 text-baba-accent" />
//                   Secure Wholesale Shipping
//                 </div>
//               </div>

//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import type { ProductColor, ProductVariant } from "../context/ShopContext";
import {
  ShoppingBag,
  ChevronRight,
  ChevronDown,
  Heart
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProductDetail() {
  const { id } = useParams();
  const {
  products,
  addToCart,
  addToWishlist,
  removeFromWishlist,
  isInWishlist
} = useShop();

  const product = useMemo(
  () => products.find((p) => p.id === id),
  [products, id]
);
  const hasSizes = product?.has_sizes ?? false;

const wishlisted = product ? isInWishlist(product.id) : false;

  const [selectedColor, setSelectedColor] =
    useState<ProductColor | null>(null);

  const [selectedSize, setSelectedSize] =
    useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string>("");

  /* ================= INITIAL LOAD ================= */

  useEffect(() => {
    if (product && product.colors.length > 0) {
      const firstColor = product.colors[0];
      setSelectedColor(firstColor);

      const firstImage =
        firstColor.images?.[0]?.image || "";

      setActiveImage(firstImage);
      setSelectedSize(null);
      setQuantity(1);
    }
  }, [product]);

  /* ================= SAFE MEMOS (ALWAYS ABOVE RETURN) ================= */

  const availableVariants = useMemo(() => {
  if (!product || !selectedColor) return [];

  return (
    product.variants?.filter(
      (variant: ProductVariant) =>
        variant.color === selectedColor.name &&
        variant.stock > 0
    ) || []
  );
}, [product, selectedColor]);


  //   return (
  //     product.variants?.filter(
  //       (variant: ProductVariant) =>
  //         variant.color === selectedColor.name &&
  //         variant.stock > 0
  //     ) || []
  //   );
  // }, [product, selectedColor]);

  const selectedVariant = useMemo(() => {
    if (!product || !selectedColor || !selectedSize) return undefined;

    return product.variants?.find(
      (variant: ProductVariant) =>
        variant.color === selectedColor.name &&
        variant.size === selectedSize
    );
  }, [product, selectedColor, selectedSize]);

  /* ================= EARLY RETURN AFTER ALL HOOKS ================= */

  if (!product || !selectedColor) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xl">
        Product not found
      </div>
    );
  }

  const isOutOfStock = hasSizes
  ? !selectedSize || !selectedVariant || selectedVariant.stock === 0
  : false;

  /* ================= HANDLE ADD TO CART ================= */

  const handleAddToCart = () => {
    if (hasSizes && !selectedSize) {
  alert("Please select size");
  return;
}

    if (hasSizes) {
  if (selectedVariant && selectedVariant.stock > 0) {
    addToCart(product, selectedColor, selectedSize!, quantity);
  }
} else {
  addToCart(product, selectedColor, "", quantity);
}
  };

  /* ================= COLOR IMAGES ================= */

  const colorImages =
    selectedColor.images?.length > 0
      ? selectedColor.images.map((img) => img.image)
      : [];

  return (
    <div className="bg-baba-background min-h-screen py-10">
      <div className="container mx-auto px-4">

        {/* ================= BREADCRUMB ================= */}
        <nav className="flex items-center text-sm text-gray-500 mb-8">
          <Link to="/">Home</Link>
          <ChevronRight className="w-4 h-4 mx-2" />
          <Link to={`/shop?category=${product.category}`}>
            {product.category}
          </Link>
          <ChevronRight className="w-4 h-4 mx-2" />
          <span>{product.name}</span>
        </nav>

        <div className="bg-white rounded-2xl shadow border overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">

            {/* ================= IMAGE SECTION ================= */}
            <div className="bg-gray-50 p-8">

              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImage}
                  src={activeImage || "/placeholder.png"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-h-[600px] object-contain rounded-xl"
                />
              </AnimatePresence>

              {/* THUMBNAILS */}
              {colorImages.length > 1 && (
                <div className="flex gap-3 mt-6 overflow-x-auto">
                  {colorImages.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      onClick={() => setActiveImage(img)}
                      className={`w-20 h-20 object-cover rounded cursor-pointer border ${
                        activeImage === img
                          ? "border-black"
                          : "border-gray-200"
                      }`}
                    />
                  ))}
                </div>
              )}

            </div>
            

            {/* ================= DETAILS SECTION ================= */}
            <div className="p-10">

              <div className="flex items-start justify-between mb-4">
  <h1 className="text-3xl font-serif font-bold">
    {product.name}
  </h1>

  <button
    onClick={() =>
      wishlisted
        ? removeFromWishlist(product.id)
        : addToWishlist(product)
    }
    className="p-3 rounded-full bg-gray-100 hover:scale-110 transition"
  >
    <Heart
      size={22}
      className={`transition ${
        wishlisted
          ? "fill-red-500 text-red-500"
          : "text-black"
      }`}
    />
  </button>
</div>
              <div className="flex items-center gap-3 mb-6">
  <p className="text-2xl font-semibold">
    ₹{product.price.toLocaleString("en-IN")}
  </p>

  {product.discount_percentage > 0 && (
    <>
      <p className="text-gray-500 line-through">
        ₹{product.original_price.toLocaleString("en-IN")}
      </p>

      <span className="text-green-600 font-medium text-sm">
        {product.discount_percentage}% OFF
      </span>
    </>
  )}
</div>

              <p className="mb-6">
                {product.description}
              </p>

              {/* ================= COLOR SELECTOR ================= */}
              <div className="mb-6">
                <h3 className="mb-3 font-semibold">
                  Color
                </h3>

                <div className="flex gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => {
                        setSelectedColor(color);
                        setSelectedSize(null);
                        setQuantity(1);
                        const firstImage =
                          color.images?.[0]?.image || "";
                        setActiveImage(firstImage);
                      }}
                      className={`w-10 h-10 rounded-full border-2 ${
                        selectedColor.id === color.id
                          ? "border-black scale-110"
                          : "border-gray-200"
                      }`}
                      style={{ backgroundColor: color.color }}
                    />
                  ))}
                </div>
              </div>

              {/* ================= SIZE SELECTOR ================= */}
              {hasSizes && (
  <div className="mb-6">
    <h3 className="mb-3 font-semibold">Size</h3>

    {availableVariants.length === 0 ? (
      <p className="text-sm text-red-500">
        No sizes available for this color
      </p>
    ) : (
      <div className="flex gap-3 flex-wrap">
        {availableVariants.map((variant) => (
          <button
            key={variant.id}
            onClick={() => setSelectedSize(variant.size)}
            className={`px-4 py-2 border ${
              selectedSize === variant.size
                ? "border-black bg-gray-100"
                : "border-gray-300"
            }`}
          >
            {variant.size}
          </button>
        ))}
      </div>
    )}
  </div>
)}

              {/* ================= QUANTITY ================= */}
              {selectedVariant && (
                <div className="mb-6 relative w-32">
                  <select
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Number(e.target.value))
                    }
                    disabled={isOutOfStock}
                    className="w-full border px-4 py-2 appearance-none"
                  >
                    {Array.from(
                      { length: selectedVariant.stock },
                      (_, i) => i + 1
                    ).map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                </div>
              )}

              {/* ================= ADD TO CART ================= */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="w-full py-3 bg-black text-white disabled:bg-gray-400"
              >
                {hasSizes
  ? !selectedSize
    ? "Select Size"
    : selectedVariant?.stock === 0
    ? "Out of Stock"
    : "Add to Cart"
  : "Add to Cart"}
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}