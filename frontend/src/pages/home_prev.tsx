import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useShop } from "../context/ShopContext";
import ProductCard from "../components/ProductCard";
import { AnimatePresence, motion } from "framer-motion";

const API_BASE = "https://api.babatextiles.com/api/products";

export default function Home() {
  const { latestProducts, popularProducts } = useShop();

  const [categories, setCategories] = useState<any[]>([]);
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);

  // ================= FETCH CATEGORIES =================
  useEffect(() => {
    fetch(`${API_BASE}/categories/`)
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch((err) => console.error("Category fetch error:", err));
  }, []);

  // ================= FETCH HERO IMAGES =================
  useEffect(() => {
    fetch(`${API_BASE}/hero/`)
      .then((res) => res.json())
      .then((data) => {
        setHeroImages(data.map((item: any) => item.image));
      })
      .catch((err) => console.error("Hero fetch error:", err));
  }, []);

  // Auto slider
  useEffect(() => {
    if (!heroImages.length) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 3000);
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
            {heroImages.length > 0 && (
              <div className="w-[100px] h-[140px] relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <Link to="/shop">
                    <motion.img
                      key={current}
                      src={heroImages[current]}
                      initial={{ opacity: 0, x: 60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -60 }}
                      transition={{ duration: 0.4 }}
                      className="absolute w-full h-full object-cover rounded shadow-xl"
                    />
                  </Link>
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= HERO DESKTOP ================= */}
      <section className="bg-[#0B1C2D] text-white py-20 hidden md:block">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="font-serif text-6xl font-bold">Baba Textiles</h1>
            <p className="italic mt-4">
              "Best rates and best quality is our motto."
            </p>
          </div>

          <div className="flex gap-5">
            {heroImages.map((img, i) => (
              <Link key={i} to="/shop">
                <div className="w-40 h-60 overflow-hidden rounded shadow-xl">
                  <img
                    src={img}
                    className="w-full h-full object-cover hover:scale-110 transition"
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

          <div className="flex gap-6 overflow-x-auto">
            {categories.map((category) => (
              <div key={category.id} className="flex-shrink-0 text-center">
                <Link to={`/shop?category=${category.slug}`}>
                  <div className="w-32 h-32 md:w-52 md:h-52 rounded-full overflow-hidden shadow-md border">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <p className="mt-4 uppercase text-sm font-semibold">
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
          <div className="flex justify-between mb-8">
            <h2 className="font-serif text-3xl font-bold">Latest Arrivals</h2>
            <Link to="/shop" className="flex items-center gap-1 text-[#C6A75E]">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {latestProducts.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= POPULAR ================= */}
      <section className="py-12 bg-[#EFE8DC]/50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between mb-8">
            <h2 className="font-serif text-3xl font-bold">
              Popular Collection
            </h2>
            <Link to="/shop" className="flex items-center gap-1 text-[#C6A75E]">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {popularProducts.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
