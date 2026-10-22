import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Instagram } from "lucide-react";
import { useShop } from "../context/ShopContext";
import ProductCard from "../components/ProductCard";
import { categorySrcSet, heroSrcSet } from "../utils/images";
import { AnimatePresence, motion } from "framer-motion";

const API_BASE = "https://api.babatextiles.com/api/products";

// ================= SKELETON LOADERS =================
const SkeletonCard = () => (
  <div className="flex flex-col bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 h-full animate-pulse">
    <div className="aspect-[3/4] bg-gray-200"></div>
    <div className="p-4 md:p-5 flex flex-col flex-grow">
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="mt-auto pt-3 flex justify-between">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      </div>
    </div>
  </div>
);

const CategorySkeleton = () => (
  <div className="flex-shrink-0 text-center animate-pulse">
    <div className="w-32 h-32 md:w-52 md:h-52 rounded-full bg-gray-200"></div>
    <div className="mt-4 h-4 bg-gray-200 rounded w-20 mx-auto"></div>
  </div>
);

export default function Home() {
  const { latestProducts, popularProducts, isLoading: isShopLoading } = useShop();

  const [categories, setCategories] = useState<any[]>([]);
  // Hero images are shown at 100-160 CSS px: `heroImages` holds the 320px
  // copies (the src), `heroSrcSets` both sizes for higher-density screens.
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [heroSrcSets, setHeroSrcSets] = useState<(string | undefined)[]>([]);
  const [current, setCurrent] = useState(0);
  
  // Independent loading states so one slow API doesn't block the whole page
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isHeroLoading, setIsHeroLoading] = useState(true);

  // ================= FETCH CATEGORIES (Independent) =================
  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE}/categories/`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setCategories(data);
          setIsCategoriesLoading(false);
        }
      })
      .catch((err) => {
        console.error("Category fetch error:", err);
        if (isMounted) setIsCategoriesLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // ================= FETCH HERO IMAGES (Independent) =================
  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE}/hero/`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        
        const images = data.map((item: any) => item.image_small || item.image);
        setHeroImages(images);
        setHeroSrcSets(data.map((item: any) => heroSrcSet(item.image, item.image_small)));
        setIsHeroLoading(false);
        if (images[0]) {
    const existing = document.querySelector('link[data-hero-preload]');
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = images[0];
      link.setAttribute('fetchpriority', 'high');
      link.setAttribute('data-hero-preload', '1');
      document.head.appendChild(link);
    }
  }
        setTimeout(() => {
    images.slice(1).forEach((src: string) => {
      const img = new Image();
      img.src = src;
    });
  }, 1000);
})
      .catch((err) => {
        console.error("Hero fetch error:", err);
        if (isMounted) setIsHeroLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // ================= AUTO SLIDER =================
  useEffect(() => {
    if (!heroImages.length) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 3500); 
    return () => clearInterval(interval);
  }, [heroImages]);

  return (
    <div className="w-full bg-[#F8F6F1]">
      
      {/* ================= HERO MOBILE ================= */}
      <section className="bg-[#0B1C2D] text-white md:hidden relative py-10">
        <div className="flex items-center px-6">
          <div className="w-3/5">
            <h1 className="font-serif text-2xl font-bold text-[#C6A75E]">
              Baba Textiles
            </h1>
            <p className="mt-3 text-xs italic">
              "Best rates and best quality is our motto."
            </p>
          </div>

          <div className="w-2/5 relative flex justify-center">
            {isHeroLoading ? (
               <div className="w-[100px] h-[140px] rounded shadow-xl bg-gray-800 animate-pulse"></div>
            ) : heroImages.length > 0 ? (
              <div className="w-[100px] h-[140px] relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <Link to="/shop">
                    <motion.img
                      key={current}
                      src={heroImages[current]}
                      srcSet={heroSrcSets[current]}
                      sizes="100px"
                      fetchPriority={current === 0 ? "high" : "auto"}
                      loading={current === 0 ? "eager" : "lazy"} 
                      initial={{ opacity: 0, x: 60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -60 }}
                      transition={{ duration: 0.4 }}
                      className="absolute w-full h-full object-cover rounded shadow-xl bg-gray-800"
                      alt="Baba Textiles Featured"
                    />
                  </Link>
                </AnimatePresence>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ================= HERO DESKTOP ================= */}
      <section className="bg-[#0B1C2D] text-white py-20 hidden md:block">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="font-serif text-6xl font-bold">Baba Textiles</h1>
            <p className="italic mt-4 text-lg text-gray-300">
              "Best rates and best quality is our motto."
            </p>
          </div>

          <div className="flex gap-5">
            {isHeroLoading ? (
               Array.from({ length: 3 }).map((_, i) => (
                 <div key={i} className="w-40 h-60 rounded shadow-xl bg-gray-800 animate-pulse"></div>
               ))
            ) : heroImages.map((img, i) => (
              <Link key={i} to="/shop">
                <div className="w-40 h-60 overflow-hidden rounded shadow-xl bg-gray-800">
                  <img
                    src={img}
                    srcSet={heroSrcSets[i]}
                    sizes="160px"
                    // Lazy: this desktop section is hidden on phones, and
                    // lazy images in hidden sections are never fetched. On
                    // desktop they are on screen, so they load immediately.
                    loading="lazy"
                    className="w-full h-full object-cover hover:scale-110 transition duration-500"
                    alt={`Hero showcase ${i + 1}`}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CATEGORIES ================= */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center font-serif text-3xl font-semibold mb-12">
            Shop By Category
          </h2>

          <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
            {isCategoriesLoading
              ? Array.from({ length: 6 }).map((_, i) => <CategorySkeleton key={i} />)
              : categories.map((category) => (
                  <div key={category.id} className="flex-shrink-0 text-center group">
                    <Link to={`/shop?category=${category.slug}`}>
                      <div className="w-32 h-32 md:w-52 md:h-52 rounded-full overflow-hidden shadow-sm border border-gray-200 group-hover:border-[#C6A75E] transition-colors">
                        <img
                          src={category.image_small || category.image}
                          srcSet={categorySrcSet(category.image, category.image_small)}
                          sizes="(min-width: 768px) 208px, 128px"
                          alt={category.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <p className="mt-4 uppercase text-sm font-semibold text-gray-800 group-hover:text-[#C6A75E] transition-colors">
                        {category.name}
                      </p>
                    </Link>
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* ================= LATEST ================= */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-between mb-8 items-end">
            <h2 className="font-serif text-3xl font-bold">Latest Arrivals</h2>
            <Link to="/shop?tag=latest" className="flex items-center gap-1 text-[#C6A75E] hover:text-[#a88a44] transition-colors font-medium">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {isShopLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : latestProducts.slice(0, 4).map((p, index) => (
                  <ProductCard key={p.id} product={p} priority={index < 2} />
                ))}
          </div>
        </div>
      </section>

      {/* ================= POPULAR ================= */}
      <section className="py-12 bg-[#EFE8DC]/50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between mb-8 items-end">
            <h2 className="font-serif text-3xl font-bold">Popular Collection</h2>
            <Link to="/shop?tag=popular" className="flex items-center gap-1 text-[#C6A75E] hover:text-[#a88a44] transition-colors font-medium">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {isShopLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : popularProducts.slice(0, 4).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
          </div>
        </div>
      </section>
    </div>
  );
}
