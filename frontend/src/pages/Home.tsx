// // import React from 'react';
// import { Link } from 'react-router-dom';
// // import { motion } from 'framer-motion';
// import { ArrowRight } from 'lucide-react';
// import { useShop } from '../context/ShopContext';
// import ProductCard from '../components/ProductCard';
// import womenImage from '../assets/navysaree.png';
// import React, { useState, useEffect } from "react";
// import { AnimatePresence, motion } from "framer-motion";
// import { ChevronLeft, ChevronRight } from "lucide-react";
// import { useNavigate } from "react-router-dom";
// export default function Home() {
//   const { latestProducts, popularProducts } = useShop();
//   const navigate = useNavigate();

//   const categories = [
//     { name: 'sarees', image: womenImage, link: '/shop?category=sarees' },
//     { name: '3 piece sets', image: 'https://i.pinimg.com/736x/54/c2/98/54c298bf3a4ceb06e8a9b485b4b0fc71.jpg', link: '/shop?category=3%20piece%20sets' },
//     { name: 'frocks', image: 'https://i.pinimg.com/736x/8d/e6/6b/8de66b42cdb88eb24e478ea4b2aed7dd.jpg', link: '/shop?category=frocks' },
//     { name: 'dress materials', image: 'https://i.pinimg.com/736x/32/e9/90/32e990019081da31ad9b01067fa80934.jpg', link: '/shop?category=dress%20materials' },
//   ];
//   const images = [
//   "https://i.pinimg.com/736x/ac/01/f0/ac01f018c68baad485921f3be55ff704.jpg",
//   "https://i.pinimg.com/736x/43/a0/06/43a00620483bf24332775c4cac882b0c.jpg",
//   "https://i.pinimg.com/1200x/06/01/e8/0601e8c940d1f807d87012d928014afc.jpg",
// ];

// const [current, setCurrent] = useState(0);

// useEffect(() => {
//   const interval = setInterval(() => {
//     setCurrent((prev) => (prev + 1) % images.length);
//   }, 3000);

//   return () => clearInterval(interval);
// }, [images.length]);

//   return (
//     <div className="w-full bg-[#F8F6F1]">
//       {/* 1. MOBILE HERO SECTION */}
//      <section className="bg-[#0B1C2D] text-white md:hidden overflow-hidden relative border-b-2 border-[#C6A75E]">
//   <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#C6A75E 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }}></div>
//   <div className="relative flex items-center px-6 py-10 min-h-[240px] z-10">
//     <div className="w-3/5 pr-2">
//       <h1 className="font-serif text-2xl font-bold leading-tight tracking-wide text-[#C6A75E]">Baba Textiles</h1>
//       <div className="w-8 h-[2px] bg-[#C6A75E] mt-2 mb-3"></div>
//       <p className="text-[#F8F6F1] text-[12px] leading-relaxed font-medium italic">"Best rates and best quality is our motto."</p>
//       <div className="flex flex-col gap-2 mt-6">
//         <a href="tel:8328030460" className="bg-[#C6A75E] text-[#0B1C2D] px-4 py-2 rounded-sm text-[11px] font-bold text-center shadow-md">CALL NOW</a>
//       </div>
//     </div>
//     <div className="w-2/5 flex justify-end items-center h-[160px] relative">
//       {/* LEFT ARROW */}
//       <button onClick={() => setCurrent((prev) => prev === 0 ? images.length - 1 : prev - 1)} className="absolute left-0 z-20 bg-white/80 backdrop-blur-sm p-1 rounded-full shadow-md">
//         <ChevronLeft size={14} className="text-black" />
//       </button>

//       {/* IMAGE SLIDER */}
//       <div className="overflow-hidden relative w-[100px] h-[140px] flex justify-center items-center">
//         <AnimatePresence mode="wait">
//           {/* Wrap the motion element in a Link just like desktop */}
//           <Link to="/shop" className="block w-full h-full">
//             <motion.img
//               key={current}
//               src={images[current]}
//               drag="x"
//               dragConstraints={{ left: 0, right: 0 }}
//               onDragEnd={(e, info) => {
//                 if (info.offset.x < -50) {
//                   setCurrent((prev) => (prev + 1) % images.length);
//                 }
//                 if (info.offset.x > 50) {
//                   setCurrent((prev) => prev === 0 ? images.length - 1 : prev - 1);
//                 }
//               }}
//               initial={{ opacity: 0, x: 80 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -80 }}
//               transition={{ duration: 0.4 }}
//               className="absolute w-full h-full object-cover rounded shadow-xl border-4 border-white cursor-pointer"
//             />
//           </Link>
//         </AnimatePresence>
//       </div>

//       {/* RIGHT ARROW */}
//       <button onClick={() => setCurrent((prev) => (prev + 1) % images.length)} className="absolute right-0 z-20 bg-white/80 backdrop-blur-sm p-1 rounded-full shadow-md">
//         <ChevronRight size={14} className="text-black" />
//       </button>
//     </div>
//   </div>
// </section>

//       {/* 2. DESKTOP HERO SECTION */}
//      <section className="bg-[#0B1C2D] text-white py-20 hidden md:block">
//   <div className="container mx-auto px-4 flex flex-row items-center justify-between gap-12">

//     {/* LEFT SIDE */}
//     <div className="flex-1 text-left max-w-2xl">
//       <span className="text-[#C6A75E] tracking-[0.3em] uppercase text-sm font-medium block mb-4">
//         Wholesale Excellence
//       </span>

//       <h1 className="font-serif text-6xl font-bold mb-6">
//         Baba Textiles
//       </h1>

//       <p className="text-[#F8F6F1]/80 text-lg mb-8 italic leading-relaxed">
//         "Best rates and best quality is our motto."
//       </p>

//       <div className="flex items-center gap-6 text-base tracking-widest text-[#C6A75E]">
//         <span>8328030460</span>
//         <span className="text-white/20">|</span>
//         <span className="text-white">WhatsApp</span>
//       </div>
//     </div>

//     {/* RIGHT SIDE – CLICKABLE IMAGES */}
//     <div className="flex-1 flex justify-center gap-5">
//       {[1, 2, 3].map((_, i) => (
//         <Link
//           key={i}
//           to="/shop"
//           className="group bg-white p-1 rounded shadow-xl hover:scale-105 transition duration-300"
//         >
//           <div className="w-40 h-60 overflow-hidden rounded">
//             <img
//               src={
//                 i === 0
//                   ? "https://i.pinimg.com/736x/ac/01/f0/ac01f018c68baad485921f3be55ff704.jpg"
//                   : i === 1
//                   ? "https://i.pinimg.com/736x/43/a0/06/43a00620483bf24332775c4cac882b0c.jpg"
//                   : "https://i.pinimg.com/1200x/06/01/e8/0601e8c940d1f807d87012d928014afc.jpg"
//               }
//               className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
//               alt="textile"
//             />
//           </div>
//         </Link>
//       ))}
//     </div>

//   </div>
// </section>

//       {/* 3. CATEGORIES SECTION */}
//       <section className="py-16 bg-[#F8F6F1]">
//         <div className="max-w-7xl mx-auto px-4">
//           <div className="flex items-center justify-center gap-3 mb-12 flex-nowrap">
//             <div className="h-[1px] bg-[#E5E7EB] flex-grow"></div>
//             <h2 className="font-serif text-xl md:text-3xl text-[#0B1C2D] font-semibold whitespace-nowrap px-2">Shop By Category</h2>
//             <div className="h-[1px] bg-[#E5E7EB] flex-grow"></div>
//           </div>
//           <div className="flex gap-6 overflow-x-auto scrollbar-hide py-4 px-2">
//             {categories.map((category, idx) => (
//               <motion.div key={category.name} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-20px" }} className="flex-shrink-0 text-center group">
//                 <Link to={category.link}>
//                   <div className="w-32 h-32 md:w-52 md:h-52 rounded-full overflow-hidden bg-[#EFE8DC] border border-[#E5E7EB] group-hover:border-[#C6A75E] transition-all shadow-md">
//                     <img src={category.image} alt={category.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
//                   </div>
//                   <p className="mt-4 text-[#1C1C1C] font-semibold text-[10px] md:text-sm uppercase tracking-widest">{category.name}</p>
//                 </Link>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* 4. LATEST ARRIVALS (2 PER ROW ON MOBILE) */}
//       <section className="py-12 md:py-20">
//         <div className="container mx-auto px-4">
//           <div className="flex justify-between items-end mb-8">
//             <h2 className="font-serif text-2xl md:text-4xl text-[#0B1C2D] font-bold">Latest Arrivals</h2>
//             <Link to="/shop" className="text-[#C6A75E] font-medium flex items-center gap-1 text-sm">View All <ArrowRight size={16} /></Link>
//           </div>
//           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
//             {latestProducts.slice(0, 4).map((p) => (
//   <ProductCard key={p.id} product={p} />
// ))}
//           </div>
//         </div>
//       </section>

//       {/* 5. FAST SELLING (2 PER ROW ON MOBILE) */}
//       <section className="py-12 md:py-20 bg-[#EFE8DC]/50">
//         <div className="container mx-auto px-4">
//           <div className="flex justify-between items-end mb-8">
//             <h2 className="font-serif text-2xl md:text-4xl text-[#0B1C2D] font-bold">Popular Collection</h2>
//             <Link to="/shop" className="text-[#C6A75E] font-medium flex items-center gap-1 text-sm">View All <ArrowRight size={16} /></Link>
//           </div>
//           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
//             {popularProducts.slice(0, 4).map((p) => (
//   <ProductCard key={p.id} product={p} />
// ))}
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }

// // import React, { useState, useEffect } from "react";
// // import { Link, useNavigate } from "react-router-dom";
// // import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
// // import { AnimatePresence, motion } from "framer-motion";
// // import { useShop } from "../context/ShopContext";
// // import ProductCard from "../components/ProductCard";

// // interface Category {
// //   id: number;
// //   name: string;
// //   slug: string;
// //   image?: string | null;
// // }

// // export default function Home() {
// //   const { products } = useShop();
// //   const featuredProducts = products.slice(0, 4);
// //   const navigate = useNavigate();

// //   const [categories, setCategories] = useState<Category[]>([]);
// //   const [current, setCurrent] = useState<number>(0);

// //   const images = [
// //     "https://i.pinimg.com/736x/ac/01/f0/ac01f018c68baad485921f3be55ff704.jpg",
// //     "https://i.pinimg.com/736x/43/a0/06/43a00620483bf24332775c4cac882b0c.jpg",
// //     "https://i.pinimg.com/1200x/06/01/e8/0601e8c940d1f807d87012d928014afc.jpg",
// //   ];

// //   /* ✅ Fetch Categories From Backend */
// //   useEffect(() => {
// //     const fetchCategories = async () => {
// //       try {
// //         const res = await fetch(
// //           `${import.meta.env.VITE_API_URL}/api/products/categories/`
// //         );
// //         const data: Category[] = await res.json();
// //         setCategories(data);
// //       } catch (error) {
// //         console.error("Error fetching categories:", error);
// //       }
// //     };

// //     fetchCategories();
// //   }, []);

// //   /* ✅ Auto Slider */
// //   useEffect(() => {
// //     const interval = setInterval(() => {
// //       setCurrent((prev) => (prev + 1) % images.length);
// //     }, 3000);

// //     return () => clearInterval(interval);
// //   }, [images.length]);

// //   return (
// //     <div className="w-full bg-[#F8F6F1]">

// //       {/* ================= HERO MOBILE ================= */}
// //       <section className="bg-[#0B1C2D] text-white md:hidden overflow-hidden relative border-b-2 border-[#C6A75E]">
// //         <div className="relative flex items-center px-6 py-10 min-h-[240px]">

// //           <div className="w-3/5 pr-2">
// //             <h1 className="font-serif text-2xl font-bold text-[#C6A75E]">
// //               Baba Textiles
// //             </h1>
// //             <p className="text-[#F8F6F1] text-[12px] mt-3 italic">
// //               "Best rates and best quality is our motto."
// //             </p>

// //             <a
// //               href="tel:8328030460"
// //               className="block mt-6 bg-[#C6A75E] text-[#0B1C2D] px-4 py-2 text-[11px] font-bold text-center"
// //             >
// //               CALL NOW
// //             </a>
// //           </div>

// //           <div className="w-2/5 relative flex justify-center items-center">
// //             <button
// //               onClick={() =>
// //                 setCurrent((prev) =>
// //                   prev === 0 ? images.length - 1 : prev - 1
// //                 )
// //               }
// //               className="absolute left-0 bg-white/80 p-1 rounded-full"
// //             >
// //               <ChevronLeft size={14} />
// //             </button>

// //             <div className="w-[100px] h-[140px] relative overflow-hidden">
// //               <AnimatePresence mode="wait">
// //                 <Link to="/shop">
// //                   <motion.img
// //                     key={current}
// //                     src={images[current]}
// //                     initial={{ opacity: 0, x: 60 }}
// //                     animate={{ opacity: 1, x: 0 }}
// //                     exit={{ opacity: 0, x: -60 }}
// //                     transition={{ duration: 0.4 }}
// //                     className="absolute w-full h-full object-cover rounded shadow-xl"
// //                   />
// //                 </Link>
// //               </AnimatePresence>
// //             </div>

// //             <button
// //               onClick={() =>
// //                 setCurrent((prev) => (prev + 1) % images.length)
// //               }
// //               className="absolute right-0 bg-white/80 p-1 rounded-full"
// //             >
// //               <ChevronRight size={14} />
// //             </button>
// //           </div>
// //         </div>
// //       </section>

// //       {/* ================= HERO DESKTOP ================= */}
// //       <section className="bg-[#0B1C2D] text-white py-20 hidden md:block">
// //         <div className="container mx-auto px-4 flex justify-between items-center">

// //           <div>
// //             <span className="text-[#C6A75E] uppercase text-sm tracking-widest">
// //               Wholesale Excellence
// //             </span>

// //             <h1 className="font-serif text-6xl font-bold mt-4">
// //               Baba Textiles
// //             </h1>

// //             <p className="text-[#F8F6F1]/80 italic mt-4">
// //               "Best rates and best quality is our motto."
// //             </p>
// //           </div>

// //           <div className="flex gap-5">
// //             {images.map((img, i) => (
// //               <Link key={i} to="/shop">
// //                 <div className="w-40 h-60 overflow-hidden rounded shadow-xl">
// //                   <img
// //                     src={img}
// //                     className="w-full h-full object-cover hover:scale-110 transition duration-500"
// //                     alt="textile"
// //                   />
// //                 </div>
// //               </Link>
// //             ))}
// //           </div>
// //         </div>
// //       </section>

// //       {/* ================= SHOP BY CATEGORY ================= */}
// //       <section className="py-16">
// //         <div className="max-w-7xl mx-auto px-4">

// //           <h2 className="text-center font-serif text-3xl text-[#0B1C2D] font-semibold mb-12">
// //             Shop By Category
// //           </h2>

// //           <div className="flex gap-6 overflow-x-auto scrollbar-hide">

// //             {categories.map((category) => (
// //               <motion.div
// //                 key={category.id}
// //                 whileHover={{ scale: 1.05 }}
// //                 className="flex-shrink-0 text-center"
// //               >
// //                 <Link to={`/shop?category=${category.slug}`}>

// //                   <div className="w-32 h-32 md:w-52 md:h-52 rounded-full overflow-hidden shadow-md border">
// //   <img
// //     src={category.image || "https://via.placeholder.com/300"}
// //     alt={category.name}
// //     className="w-full h-full object-cover"
// //   />
// // </div>

// //                   <p className="mt-4 uppercase text-sm font-semibold tracking-widest">
// //                     {category.name}
// //                   </p>

// //                 </Link>
// //               </motion.div>
// //             ))}

// //           </div>
// //         </div>
// //       </section>

// //       {/* ================= LATEST ARRIVALS ================= */}
// //       <section className="py-12 md:py-20">
// //         <div className="container mx-auto px-4">

// //           <div className="flex justify-between mb-8">
// //             <h2 className="font-serif text-3xl font-bold text-[#0B1C2D]">
// //               Latest Arrivals
// //             </h2>

// //             <Link
// //               to="/shop?tag=latest"
// //               className="text-[#C6A75E] flex items-center gap-1"
// //             >
// //               View All <ArrowRight size={16} />
// //             </Link>
// //           </div>

// //           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
// //             {featuredProducts.map((p) => (
// //               <ProductCard key={p.id} product={p} />
// //             ))}
// //           </div>

// //         </div>
// //       </section>

// //     </div>
// //   );
// // }

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
