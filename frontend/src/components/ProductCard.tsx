// import React, { useState } from 'react';
// import { Link } from 'react-router-dom';
// import { motion } from 'framer-motion';
// import type { Product } from '../context/ShopContext';
// import { ShoppingBag, Heart } from 'lucide-react';
// import { useShop } from '../context/ShopContext';

// const ProductCard = ({ product }: { product: Product }) => {
//   const [activeColorIdx, setActiveColorIdx] = useState(0);
//   const { addToWishlist, removeFromWishlist, isInWishlist } = useShop();

//   const activeColor = product.colors[activeColorIdx];
//   const isOutOfStock = activeColor.stock === 0;
//   const wishlisted = isInWishlist(product.id);

//   return (
//     <motion.div
//       whileHover={{ y: -8 }}
//       className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-black/5"
//     >
//       {/* Image Container */}
//       <Link
//         to={`/product/${product.id}`}
//         className="relative aspect-[3/4] overflow-hidden bg-baba-softbg"
//       >
//         {/* Product Image */}
//         <motion.img
//           key={activeColor.image}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 0.3 }}
//           src={activeColor.image}
//           alt={product.name}
//           className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
//         />

//         {/* ❤️ Wishlist Button */}
//         <button
//           onClick={(e) => {
//             e.preventDefault();
//             wishlisted
//               ? removeFromWishlist(product.id)
//               : addToWishlist(product);
//           }}
//           className="absolute top-3 right-3 bg-white/90 backdrop-blur p-2 rounded-full shadow-md hover:scale-110 transition"
//         >
//           <Heart
//             size={18}
//             className={`transition ${
//               wishlisted
//                 ? "fill-red-500 text-red-500"
//                 : "text-baba-primary"
//             }`}
//           />
//         </button>

//         {/* Sold Out Badge */}
//         {isOutOfStock && (
//           <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm shadow-md">
//             Sold Out
//           </div>
//         )}

//         {/* Quick Action Overlay */}
//         <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 bg-gradient-to-t from-black/60 to-transparent">
//           <button className="w-full bg-white/90 backdrop-blur text-baba-primary font-medium py-2 rounded flex items-center justify-center gap-2 hover:bg-baba-accent hover:text-white transition-colors">
//             <ShoppingBag className="w-4 h-4" /> View Details
//           </button>
//         </div>
//       </Link>

//       {/* Content */}
//       <div className="p-5 flex flex-col flex-grow">
//         <div className="flex justify-between items-start mb-2">
//           <p className="text-xs text-baba-primary/60 uppercase tracking-wider">
//             {product.category}
//           </p>
//           <span className="hidden" data-code={product.code}>
//             {product.code}
//           </span>
//         </div>

//         <Link
//           to={`/product/${product.id}`}
//           className="group-hover:text-baba-accent transition-colors"
//         >
//           <h3 className="font-serif font-medium text-lg text-baba-textdark leading-tight mb-2 line-clamp-1">
//             {product.name}
//           </h3>
//         </Link>

//         <div className="mt-auto pt-4 flex items-center justify-between">
//           <p className="font-medium text-baba-primary">
//             ₹{product.price.toLocaleString('en-IN')}
//           </p>

//           {/* Color Selectors */}
//           {product.colors.length > 1 && (
//             <div className="flex items-center gap-1.5">
//               {product.colors.map((color, idx) => (
//                 <button
//                   key={color.name}
//                   onClick={(e) => {
//                     e.preventDefault();
//                     setActiveColorIdx(idx);
//                   }}
//                   className={`w-4 h-4 rounded-full border-2 transition-all ${
//                     activeColorIdx === idx
//                       ? 'border-baba-primary scale-110 shadow-sm'
//                       : 'border-transparent hover:scale-110 shadow-sm'
//                   }`}
//                   style={{ backgroundColor: color.hex }}
//                   title={color.name}
//                   aria-label={`Select color ${color.name}`}
//                 />
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </motion.div>
//   );
// };

// export default ProductCard;

// import React, { useState, useMemo } from "react";
// import { Link } from "react-router-dom";
// import { motion } from "framer-motion";
// import type { Product } from "../context/ShopContext";
// import { ShoppingBag, Heart } from "lucide-react";
// import { useShop } from "../context/ShopContext";

// const ProductCard = ({ product }: { product: Product }) => {
//   const { addToWishlist, removeFromWishlist, isInWishlist } = useShop();

//   const [activeColorIdx, setActiveColorIdx] = useState(0);

//   /* ================= SAFE COLOR ================= */
//   const activeColor =
//     product.colors?.[activeColorIdx] || product.colors?.[0];

//   /* ================= SAFE IMAGE ================= */
//   const firstImage =
//     activeColor?.images?.[0]?.image || "/placeholder.png";

//   /* ================= STOCK CHECK ================= */
//   const isOutOfStock = useMemo(() => {
//     if (!activeColor || !product.variants?.length) return false;

//     return !product.variants.some(
//       (variant) =>
//         variant.color === activeColor.name &&
//         variant.stock > 0
//     );
//   }, [product.variants, activeColor]);

//   const wishlisted = isInWishlist(product.id);

//   return (
//     <motion.div
//       whileHover={{ y: -8 }}
//       className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-black/5"
//     >
//       {/* ================= IMAGE ================= */}
//       <Link
//         to={`/product/${product.id}`}
//         className="relative aspect-[3/4] overflow-hidden bg-baba-softbg"
//       >
//         <motion.img
//           key={firstImage}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 0.3 }}
//           src={firstImage}
//           alt={product.name}
//           className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
//         />

//         {/* ❤️ Wishlist */}
//         <button
//           onClick={(e) => {
//             e.preventDefault();
//             wishlisted
//               ? removeFromWishlist(product.id)
//               : addToWishlist(product);
//           }}
//           className="absolute top-3 right-3 bg-white/90 backdrop-blur p-2 rounded-full shadow-md hover:scale-110 transition"
//         >
//           <Heart
//             size={18}
//             className={`transition ${
//               wishlisted
//                 ? "fill-red-500 text-red-500"
//                 : "text-baba-primary"
//             }`}
//           />
//         </button>

//         {/* Sold Out Badge */}
//         {/* {isOutOfStock && (
//           <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm shadow-md">
//             Sold Out
//           </div>
//         )} */}

//         {/* Hover Overlay */}
//         <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 bg-gradient-to-t from-black/60 to-transparent">
//           <button className="w-full bg-white/90 backdrop-blur text-baba-primary font-medium py-2 rounded flex items-center justify-center gap-2 hover:bg-baba-accent hover:text-white transition-colors">
//             <ShoppingBag className="w-4 h-4" /> View Details
//           </button>
//         </div>
//       </Link>

//       {/* ================= CONTENT ================= */}
//       <div className="p-5 flex flex-col flex-grow">
//         <p className="text-xs text-baba-primary/60 uppercase tracking-wider mb-2">
//           {product.category}
//         </p>

//         <Link
//           to={`/product/${product.id}`}
//           className="group-hover:text-baba-accent transition-colors"
//         >
//           <h3 className="font-serif font-medium text-lg text-baba-textdark leading-tight mb-2 line-clamp-1">
//             {product.name}
//           </h3>
//         </Link>

//         <div className="mt-auto pt-4 flex items-center justify-between">
//           <p className="font-medium text-baba-primary">
//             ₹{product.price.toLocaleString("en-IN")}
//           </p>

//           {/* Color Selector */}
//           {product.colors?.length > 1 && (
//             <div className="flex items-center gap-1.5">
//               {product.colors.map((color, idx) => (
//                 <button
//                   key={color.id}
//                   onClick={(e) => {
//                     e.preventDefault();
//                     setActiveColorIdx(idx);
//                   }}
//                   className={`w-4 h-4 rounded-full border-2 transition-all ${
//                     activeColorIdx === idx
//                       ? "border-baba-primary scale-110 shadow-sm"
//                       : "border-transparent hover:scale-110 shadow-sm"
//                   }`}
//                   style={{ backgroundColor: color.hex }}
//                 />
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </motion.div>
//   );
// };

// export default ProductCard;

import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Product } from "../context/ShopContext";
import { ShoppingBag, Heart } from "lucide-react";
import { useShop } from "../context/ShopContext";

const ProductCard = ({ product }: { product: Product }) => {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useShop();

  const [activeColorIdx, setActiveColorIdx] = useState(0);

  /* ================= SAFE COLOR ================= */
  const activeColor =
    product.colors?.[activeColorIdx] || product.colors?.[0];

  /* ================= SAFE IMAGE ================= */
  const firstImage =
    activeColor?.images?.[0]?.image || "/placeholder.png";

  /* ================= STOCK CHECK ================= */
  const isOutOfStock = useMemo(() => {
    if (!activeColor || !product.variants?.length) return false;

    return !product.variants.some(
      (variant) =>
        variant.color === activeColor.name &&
        variant.stock > 0
    );
  }, [product.variants, activeColor]);

  const wishlisted = isInWishlist(product.id);

  return (
    <motion.div
      whileHover={{ y: -8 }}
      className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-black/5"
    >
      {/* ================= IMAGE ================= */}
      <Link
        to={`/product/${product.id}`}
        className="relative aspect-[3/4] overflow-hidden bg-baba-softbg"
      >
        <motion.img
          key={firstImage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          src={firstImage}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* ❤️ Wishlist */}
        <button
          onClick={(e) => {
            e.preventDefault();
            wishlisted
              ? removeFromWishlist(product.id)
              : addToWishlist(product);
          }}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur p-2 rounded-full shadow-md hover:scale-110 transition"
        >
          <Heart
            size={18}
            className={`transition ${
              wishlisted
                ? "fill-red-500 text-red-500"
                : "text-baba-primary"
            }`}
          />
        </button>

        {/* Hover Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 bg-gradient-to-t from-black/60 to-transparent">
          <button className="w-full bg-white/90 backdrop-blur text-baba-primary font-medium py-2 rounded flex items-center justify-center gap-2 hover:bg-baba-accent hover:text-white transition-colors">
            <ShoppingBag className="w-4 h-4" /> View Details
          </button>
        </div>
      </Link>

      {/* ================= CONTENT ================= */}
      <div className="p-5 flex flex-col flex-grow">
        <p className="text-xs text-baba-primary/60 uppercase tracking-wider mb-2">
          {product.category}
        </p>

        <Link
          to={`/product/${product.id}`}
          className="group-hover:text-baba-accent transition-colors"
        >
          <h3 className="font-serif font-medium text-lg text-baba-textdark leading-tight mb-2 line-clamp-1">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto pt-4 flex items-center justify-between">

          {/* ================= PRICE ================= */}
          <div className="flex items-center gap-2">
            {/* Final Price */}
            <p className="font-semibold text-baba-primary">
              ₹{product.price.toLocaleString("en-IN")}
            </p>

            {/* Original Price */}
            {product.discount_percentage > 0 && (
              <p className="text-sm text-gray-500 line-through">
                ₹{product.original_price.toLocaleString("en-IN")}
              </p>
            )}

            {/* Discount Badge */}
            {product.discount_percentage > 0 && (
              <span className="text-xs text-green-600 font-medium">
                {product.discount_percentage}% OFF
              </span>
            )}
          </div>

          {/* ================= COLOR SELECTOR ================= */}
          {product.colors?.length > 1 && (
            <div className="flex items-center gap-1.5">
              {product.colors.map((color, idx) => (
                <button
                  key={color.id}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveColorIdx(idx);
                  }}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    activeColorIdx === idx
                      ? "border-baba-primary scale-110 shadow-sm"
                      : "border-transparent hover:scale-110 shadow-sm"
                  }`}
                  style={{ backgroundColor: color.color }}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;