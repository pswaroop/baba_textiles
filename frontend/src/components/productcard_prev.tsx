import React, { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Product } from "../context/ShopContext";
import { ShoppingBag, Heart, Image as ImageIcon } from "lucide-react";
import { useShop } from "../context/ShopContext";

type ProductCardProps = {
  product: Product;
  priority?: boolean;
};

const ProductCard = ({ product, priority = false }: ProductCardProps) => {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useShop();

  const image = useMemo(() => {
    const firstValidImage = product.images?.find((img) => img?.image)?.image;
    return firstValidImage || "/placeholder.png";
  }, [product.images]);

  const isOutOfStock =
    product.variants?.every((variant) => Number(variant.stock) === 0) || false;

  const wishlisted = isInWishlist(product.id);


  return (
    <div
  className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-sm 
             hover:shadow-md transition-all duration-300 border border-black/5 
             h-full animate-fadeIn"  // use a single CSS keyframe instead
>
      <Link
        to={`/product/${product.id}`}
        className="relative aspect-[3/4] overflow-hidden bg-gray-50 flex items-center justify-center"
      >
        <div className="absolute inset-0 flex items-center justify-center text-gray-200 z-0">
          <ImageIcon className="w-10 h-10 opacity-40" />
        </div>

        <img
  src={image}
  srcSet={`
    ${image}?w=400 400w,
    ${image}?w=600 600w,
    ${image}?w=800 800w
  `}
  alt={product.name}
  width={400}
  height={533}
  loading={priority ? "eager" : "lazy"}
  fetchPriority={priority ? "high" : "auto"}
  decoding="async"
  // Actual rendered widths at each breakpoint:
  // mobile: ~50vw - 1rem gap ≈ 45vw
  // md (2-col): ~50vw - sidebar - gap ≈ 33vw  
  // lg (3-col): ~33vw - sidebar - gap ≈ 22vw
  sizes="(max-width: 768px) 45vw, (max-width: 1024px) 33vw, 22vw"
  className="absolute inset-0 h-full w-full object-cover z-10 transition-transform duration-500 group-hover:scale-[1.03]"
/>

        <button
          onClick={(e) => {
            e.preventDefault();
            wishlisted ? removeFromWishlist(product.id) : addToWishlist(product);
          }}
          className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur p-2 rounded-full shadow-sm hover:scale-110 transition"
          aria-label={
            wishlisted ? "Remove from wishlist" : "Add to wishlist"
          }
          type="button"
        >
          <Heart
            size={18}
            className={`transition-colors ${
              wishlisted
                ? "fill-red-500 text-red-500"
                : "text-gray-500 hover:text-red-500"
            }`}
          />
        </button>

        <div className="absolute inset-x-0 bottom-0 z-20 p-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-gradient-to-t from-black/60 to-transparent">
          <div className="w-full bg-white/95 backdrop-blur text-baba-primary font-medium py-2 rounded-lg shadow-sm flex items-center justify-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            View Details
          </div>
        </div>
      </Link>

      <div className="p-4 md:p-5 flex flex-col flex-grow relative z-10 bg-white">
        <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          {product.category_name}
        </p>

        <Link
          to={`/product/${product.id}`}
          className="group-hover:text-baba-primary transition-colors"
        >
          <h3 className="font-serif font-medium text-base md:text-lg text-gray-900 leading-tight mb-2 line-clamp-2">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-gray-900 text-sm md:text-base">
              ₹{Number(product.price).toLocaleString("en-IN")}
            </p>

            {Number(product.discount_percentage) > 0 && (
              <p className="text-xs md:text-sm text-gray-400 line-through">
                ₹{Number(product.original_price).toLocaleString("en-IN")}
              </p>
            )}

            {Number(product.discount_percentage) > 0 && (
              <span className="text-[10px] md:text-xs bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded border border-green-100">
                {Math.round(Number(product.discount_percentage))}% OFF
              </span>
            )}
          </div>

          {isOutOfStock && (
            <span className="px-2 py-0.5 text-[10px] md:text-xs font-bold bg-red-50 text-red-600 rounded border border-red-100 whitespace-nowrap">
              SOLD OUT
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
