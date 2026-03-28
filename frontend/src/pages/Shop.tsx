// // import React, { useState, useMemo } from 'react';
// //     import { useLocation } from 'react-router-dom';
// //     import { useShop } from '../context/ShopContext';
// //     import ProductCard from '../components/ProductCard';
// //     import { Filter, ChevronDown } from 'lucide-react';
// //     import { motion } from 'framer-motion';

// //     export default function Shop() {
// //       const { products } = useShop();
// //       const location = useLocation();
// //       const searchParams = new URLSearchParams(location.search);
// //       const initialCategory = searchParams.get('category') || 'All';
// //       const searchQuery = searchParams.get('q') || '';

// //       const [selectedCategory, setSelectedCategory] = useState(initialCategory);
// //       const [sortBy, setSortBy] = useState('featured');
// //       const [selectedSize, setSelectedSize] = useState('');
// //       const [selectedCollection, setSelectedCollection] = useState('');
// // const [priceRange, setPriceRange] = useState([0, 5000]);

// //       const categories = [
// //   'All',
// //   'sarees',
// //   '3 piece sets',
// //   'frocks',
// //   'dress materials'
// // ];

// //       const filteredProducts = useMemo(() => {
// //   let result = [...products];

// //   // Category Filter
// //   if (selectedCategory !== 'All') {
// //     result = result.filter(p => p.category === selectedCategory);
// //   }

// //   // Size Filter
// //   if (selectedSize) {
// //     result = result.filter(p => p.size === selectedSize);
// //   }

// //   // Price Filter
// //   result = result.filter(
// //     p => p.price >= priceRange[0] && p.price <= priceRange[1]
// //   );

// //   // Search Filter
// //   if (searchQuery) {
// //     const query = searchQuery.toLowerCase();
// //     result = result.filter(p =>
// //       p.name.toLowerCase().includes(query) ||
// //       p.code.toLowerCase().includes(query)
// //     );
// //   }

// //   // Sorting
// //   if (sortBy === 'price-low') {
// //     result.sort((a, b) => a.price - b.price);
// //   } else if (sortBy === 'price-high') {
// //     result.sort((a, b) => b.price - a.price);
// //   }

// //   // Collection Filter
// // if (selectedCollection) {
// //   result = result.filter(p => p.tag === selectedCollection);
// // }

// //   return result;
// // }, [products, selectedCategory, selectedSize, priceRange, searchQuery, sortBy, selectedCollection]);

// //       return (
// //         <div className="bg-baba-softbg min-h-screen pb-20">
// //           {/* Shop Header */}
// //           <div className="bg-baba-primary text-white py-16 px-4">
// //             <div className="container mx-auto text-center">
// //               <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
// //                 {searchQuery ? `Search Results for "${searchQuery}"` : 'Our Collection'}
// //               </h1>
// //               <p className="text-baba-accent max-w-2xl mx-auto text-lg">
// //                 Discover our meticulously curated wholesale textiles.
// //               </p>
// //             </div>
// //           </div>

// //           <div className="container mx-auto px-4 mt-8">
// //             <div className="flex flex-col md:flex-row gap-8">
              
// //               {/* Sidebar Filters */}
// //               <aside className="w-full md:w-72 shrink-0">
// //   <div className="bg-white p-6 rounded-xl shadow-sm border border-black/5 sticky top-28">

// //     <div className="flex items-center gap-2 mb-6 text-baba-primary font-serif text-xl border-b pb-4">
// //       <Filter className="w-5 h-5" />
// //       <h2>Filters</h2>
// //     </div>

// //     {/* SIZE FILTER */}
// //     <div className="mb-8">
// //       <h3 className="font-semibold text-baba-textdark mb-4 uppercase text-sm tracking-wider">
// //         Size
// //       </h3>

// //       <div className="grid grid-cols-2 gap-3">
// //         {['XS','S','M','L','XL','XXL','3XL'].map(size => (
// //           <button
// //             key={size}
// //             onClick={() => setSelectedSize(size === selectedSize ? '' : size)}
// //             className={`py-2 rounded-full border text-sm transition-all
// //               ${selectedSize === size
// //                 ? 'bg-baba-primary text-white border-baba-primary'
// //                 : 'border-gray-300 text-baba-textdark hover:border-baba-accent'}
// //             `}
// //           >
// //             {size}
// //           </button>
// //         ))}
// //       </div>
// //     </div>

// //     {/* PRICE FILTER */}
// //     <div className="mb-8">
// //       <h3 className="font-semibold text-baba-textdark mb-4 uppercase text-sm tracking-wider">
// //         Price
// //       </h3>

// //       <input
// //         type="range"
// //         min="0"
// //         max="5000"
// //         value={priceRange[1]}
// //         onChange={(e) => setPriceRange([0, Number(e.target.value)])}
// //         className="w-full accent-baba-accent"
// //       />

// //       <p className="text-sm mt-3 text-baba-textdark/70">
// //         ₹0 — ₹{priceRange[1]}
// //       </p>
// //     </div>
// //     {/* OUR COLLECTION FILTER */}
// // <div className="mb-8">
// //   <h3 className="font-semibold text-baba-textdark mb-4 uppercase text-sm tracking-wider">
// //     Our Collection
// //   </h3>

// //   <div className="space-y-3">
// //     {[
// //       { label: 'Popular Collection', value: 'popular' },
// //       { label: 'Budget Friendly', value: 'budget' },
// //       { label: 'Latest Arrivals', value: 'latest' }
// //     ].map(item => (
// //       <button
// //         key={item.value}
// //         onClick={() =>
// //           setSelectedCollection(
// //             selectedCollection === item.value ? '' : item.value
// //           )
// //         }
// //         className={`block text-left w-full text-sm transition-colors
// //           ${selectedCollection === item.value
// //             ? 'text-baba-accent font-medium'
// //             : 'text-baba-textdark/70 hover:text-baba-primary'}
// //         `}
// //       >
// //         {item.label}
// //       </button>
// //     ))}
// //   </div>
// // </div>

// //     {/* CATEGORY FILTER */}
// //     <div>
// //       <h3 className="font-semibold text-baba-textdark mb-4 uppercase text-sm tracking-wider">
// //         Categories
// //       </h3>

// //       <div className="space-y-3">
// //         {categories.map(cat => (
// //           <button
// //             key={cat}
// //             onClick={() => setSelectedCategory(cat)}
// //             className={`block text-left w-full text-sm transition-colors
// //               ${selectedCategory === cat
// //                 ? 'text-baba-accent font-medium'
// //                 : 'text-baba-textdark/70 hover:text-baba-primary'}
// //             `}
// //           >
// //             {cat}
// //           </button>
// //         ))}
// //       </div>
// //     </div>

// //   </div>
// // </aside>

// //               {/* Main Content */}
// //               <main className="flex-grow">
// //                 {/* Top Bar */}
// //                 <div className="bg-white p-4 rounded-xl shadow-sm border border-black/5 mb-6 flex flex-wrap justify-between items-center gap-4">
// //                   <p className="text-sm text-baba-textdark/60">
// //                     Showing <span className="font-semibold text-baba-primary">{filteredProducts.length}</span> products
// //                   </p>
                  
// //                   <div className="flex items-center gap-2">
// //                     <span className="text-sm text-baba-textdark/60">Sort by:</span>
// //                     <div className="relative">
// //                       <select 
// //                         value={sortBy}
// //                         onChange={(e) => setSortBy(e.target.value)}
// //                         className="appearance-none bg-baba-softbg border border-transparent text-sm pl-4 pr-10 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-baba-accent focus:border-baba-accent cursor-pointer text-baba-primary font-medium"
// //                       >
// //                         <option value="featured">Featured</option>
// //                         <option value="price-low">Price: Low to High</option>
// //                         <option value="price-high">Price: High to Low</option>
// //                       </select>
// //                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-baba-primary/50 pointer-events-none" />
// //                     </div>
// //                   </div>
// //                 </div>

// //                 {/* Product Grid */}
// //                 {filteredProducts.length > 0 ? (
// //                   <motion.div 
// //                     initial={{ opacity: 0 }}
// //                     animate={{ opacity: 1 }}
// //                     className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
// //                   >
// //                     {filteredProducts.map(product => (
// //                       <ProductCard key={product.id} product={product} />
// //                     ))}
// //                   </motion.div>
// //                 ) : (
// //                   <div className="bg-white p-12 rounded-xl shadow-sm text-center border border-black/5">
// //                     <h3 className="text-xl font-serif text-baba-primary mb-2">No products found</h3>
// //                     <p className="text-baba-textdark/60">Try adjusting your search or filters.</p>
// //                     <button 
// //                       onClick={() => {
// //   setSelectedCategory('All');
// //   setSelectedCollection('');
// //   setSelectedSize('');
// //   setPriceRange([0, 5000]);
// //   window.history.replaceState({}, '', '/shop');
// // }}
// //                       className="mt-6 text-baba-accent hover:underline font-medium"
// //                     >
// //                       Clear Filters
// //                     </button>
// //                   </div>
// //                 )}
// //               </main>

// //             </div>
// //           </div>
// //         </div>
// //       );
// //     }
// import React, { useState, useMemo, useEffect } from "react";
// import { useLocation } from "react-router-dom";
// import { useShop } from "../context/ShopContext";
// import ProductCard from "../components/ProductCard";
// import { Filter, ChevronDown } from "lucide-react";
// import { motion } from "framer-motion";

// export default function Shop() {
//   const { products } = useShop();
//   const location = useLocation();

//   const searchParams = new URLSearchParams(location.search);

//   const urlCategory = searchParams.get("category") || "All";
//   const urlTag = searchParams.get("tag") || "";
//   const searchQuery = searchParams.get("q") || "";

//   const [selectedCategory, setSelectedCategory] = useState(urlCategory);
//   const [selectedCollection, setSelectedCollection] = useState(urlTag);
//   const [sortBy, setSortBy] = useState("featured");
//   const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);

//   // Sync when URL changes
//   useEffect(() => {
//     setSelectedCategory(urlCategory);
//     setSelectedCollection(urlTag);
//   }, [urlCategory, urlTag]);

//   const categories = [
//     "All",
//     "sarees",
//     "3 piece sets",
//     "frocks",
//     "dress materials",
//   ];

//   const filteredProducts = useMemo(() => {
//     let result = [...products];

//     // Category Filter
//     if (selectedCategory !== "All") {
//       result = result.filter(
//         (p) =>
//           p.category.toLowerCase() === selectedCategory.toLowerCase()
//       );
//     }

//     // Tag Filter (latest, popular, budget)
//     if (selectedCollection) {
//       result = result.filter(
//         (p) => p.tag === selectedCollection
//       );
//     }

//     // Price Filter
//     result = result.filter(
//       (p) =>
//         p.price >= priceRange[0] &&
//         p.price <= priceRange[1]
//     );

//     // Search Filter
//     if (searchQuery) {
//       const query = searchQuery.toLowerCase();
//       result = result.filter(
//         (p) =>
//           p.name.toLowerCase().includes(query) ||
//           p.code.toLowerCase().includes(query)
//       );
//     }

//     // Sorting
//     if (sortBy === "price-low") {
//       result.sort((a, b) => a.price - b.price);
//     } else if (sortBy === "price-high") {
//       result.sort((a, b) => b.price - a.price);
//     }

//     return result;
//   }, [
//     products,
//     selectedCategory,
//     selectedCollection,
//     priceRange,
//     searchQuery,
//     sortBy,
//   ]);

//   return (
//     <div className="bg-baba-softbg min-h-screen pb-20">
//       {/* Header */}
//       <div className="bg-baba-primary text-white py-16 px-4">
//         <div className="container mx-auto text-center">
//           <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
//             {searchQuery
//               ? `Search Results for "${searchQuery}"`
//               : "Our Collection"}
//           </h1>
//           <p className="text-baba-accent max-w-2xl mx-auto text-lg">
//             Discover our curated wholesale textiles.
//           </p>
//         </div>
//       </div>

//       <div className="container mx-auto px-4 mt-8">
//         <div className="flex flex-col md:flex-row gap-8">
//           {/* Sidebar */}
//           <aside className="w-full md:w-72 shrink-0">
//             <div className="bg-white p-6 rounded-xl shadow-sm border sticky top-28">
//               <div className="flex items-center gap-2 mb-6 font-serif text-xl border-b pb-4">
//                 <Filter className="w-5 h-5" />
//                 <h2>Filters</h2>
//               </div>

//               {/* Price */}
//               <div className="mb-8">
//                 <h3 className="font-semibold mb-4 uppercase text-sm">
//                   Price
//                 </h3>

//                 <input
//                   type="range"
//                   min="0"
//                   max="5000"
//                   value={priceRange[1]}
//                   onChange={(e) =>
//                     setPriceRange([0, Number(e.target.value)])
//                   }
//                   className="w-full"
//                 />

//                 <p className="text-sm mt-3">
//                   ₹0 — ₹{priceRange[1]}
//                 </p>
//               </div>

//               {/* Collection */}
//               <div className="mb-8">
//                 <h3 className="font-semibold mb-4 uppercase text-sm">
//                   Our Collection
//                 </h3>

//                 {[
//                   { label: "Popular Collection", value: "popular" },
//                   { label: "Budget Friendly", value: "budget" },
//                   { label: "Latest Arrivals", value: "latest" },
//                 ].map((item) => (
//                   <button
//                     key={item.value}
//                     onClick={() =>
//                       setSelectedCollection(
//                         selectedCollection === item.value
//                           ? ""
//                           : item.value
//                       )
//                     }
//                     className={`block text-left w-full text-sm mb-3 ${
//                       selectedCollection === item.value
//                         ? "text-baba-accent font-medium"
//                         : "hover:text-baba-primary"
//                     }`}
//                   >
//                     {item.label}
//                   </button>
//                 ))}
//               </div>

//               {/* Categories */}
//               <div>
//                 <h3 className="font-semibold mb-4 uppercase text-sm">
//                   Categories
//                 </h3>

//                 {categories.map((cat) => (
//                   <button
//                     key={cat}
//                     onClick={() => setSelectedCategory(cat)}
//                     className={`block text-left w-full text-sm mb-3 ${
//                       selectedCategory === cat
//                         ? "text-baba-accent font-medium"
//                         : "hover:text-baba-primary"
//                     }`}
//                   >
//                     {cat}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </aside>

//           {/* Main Content */}
//           <main className="flex-grow">
//             {/* Top Bar */}
//             <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 flex justify-between items-center">
//               <p className="text-sm">
//                 Showing{" "}
//                 <span className="font-semibold">
//                   {filteredProducts.length}
//                 </span>{" "}
//                 products
//               </p>

//               <div className="relative">
//                 <select
//                   value={sortBy}
//                   onChange={(e) =>
//                     setSortBy(e.target.value)
//                   }
//                   className="appearance-none bg-baba-softbg text-sm pl-4 pr-10 py-2 rounded-md cursor-pointer"
//                 >
//                   <option value="featured">Featured</option>
//                   <option value="price-low">
//                     Price: Low to High
//                   </option>
//                   <option value="price-high">
//                     Price: High to Low
//                   </option>
//                 </select>
//                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
//               </div>
//             </div>

//             {/* Product Grid */}
//             {filteredProducts.length > 0 ? (
//               <motion.div
//                 initial={{ opacity: 0 }}
//                 animate={{ opacity: 1 }}
//                 className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
//               >
//                 {filteredProducts.map((product) => (
//                   <ProductCard
//                     key={product.id}
//                     product={product}
//                   />
//                 ))}
//               </motion.div>
//             ) : (
//               <div className="bg-white p-12 rounded-xl text-center border">
//                 <h3 className="text-xl font-serif mb-2">
//                   No products found
//                 </h3>
//                 <button
//                   onClick={() => {
//                     setSelectedCategory("All");
//                     setSelectedCollection("");
//                     setPriceRange([0, 5000]);
//                   }}
//                   className="mt-6 text-baba-accent hover:underline font-medium"
//                 >
//                   Clear Filters
//                 </button>
//               </div>
//             )}
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }

// import React, { useState, useMemo, useEffect } from "react";
// import { useLocation } from "react-router-dom";
// import { useShop } from "../context/ShopContext";
// import ProductCard from "../components/ProductCard";
// import { Filter, ChevronDown } from "lucide-react";
// import { motion } from "framer-motion";

// export default function Shop() {
//   const { products } = useShop();
//   const location = useLocation();

//   const searchParams = new URLSearchParams(location.search);

//   const urlCategory = searchParams.get("category") || "All";
//   const urlTag = searchParams.get("tag") || "";
//   const searchQuery = searchParams.get("q") || "";

//   const [selectedCategory, setSelectedCategory] = useState(urlCategory);
//   const [selectedCollection, setSelectedCollection] = useState(urlTag);
//   const [selectedSize, setSelectedSize] = useState("");
//   const [sortBy, setSortBy] = useState("featured");
//   const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);

//   // Sync URL
//   useEffect(() => {
//     setSelectedCategory(urlCategory);
//     setSelectedCollection(urlTag);
//   }, [urlCategory, urlTag]);

//   // ✅ Categories from backend
//   const categories = [
//     "All",
//     ...Array.from(new Set(products.map((p) => p.category)))
//   ];

//   const filteredProducts = useMemo(() => {
//     let result = [...products];

//     // Category
//     if (selectedCategory !== "All") {
//       result = result.filter(
//         (p) => p.category.toLowerCase() === selectedCategory.toLowerCase()
//       );
//     }

//     // Tag (popular, latest, budget)
//     if (selectedCollection) {
//       result = result.filter((p) =>
//   p.tags?.includes(selectedCollection)
// );
//     }

//     // Size filter
//     if (selectedSize) {
//       result = result.filter((p) =>
//         p.sizes?.includes(selectedSize)
//       );
//     }

//     // Price
//     result = result.filter(
//       (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
//     );

//     // Search
//     if (searchQuery) {
//       const query = searchQuery.toLowerCase();
//       result = result.filter(
//         (p) =>
//           p.name.toLowerCase().includes(query) ||
//           p.code.toLowerCase().includes(query)
//       );
//     }

//     // Sorting
//     if (sortBy === "price-low") {
//       result.sort((a, b) => a.price - b.price);
//     } else if (sortBy === "price-high") {
//       result.sort((a, b) => b.price - a.price);
//     }

//     return result;
//   }, [
//     products,
//     selectedCategory,
//     selectedCollection,
//     selectedSize,
//     priceRange,
//     searchQuery,
//     sortBy
//   ]);

//   return (
//     <div className="bg-baba-softbg min-h-screen pb-20">
//       <div className="bg-baba-primary text-white py-16 px-4 text-center">
//         <h1 className="text-4xl font-serif font-bold">
//           {searchQuery ? `Search: "${searchQuery}"` : "Our Collection"}
//         </h1>
//       </div>

//       <div className="container mx-auto px-4 mt-8 flex flex-col md:flex-row gap-8">
//         {/* Sidebar */}
//         <aside className="w-full md:w-72">
//           <div className="bg-white p-6 rounded-xl shadow-sm border sticky top-28">
//             <div className="flex items-center gap-2 mb-6 font-serif text-xl border-b pb-4">
//               <Filter className="w-5 h-5" />
//               Filters
//             </div>

//             {/* Size Filter */}
//             <div className="mb-8">
//               <h3 className="font-semibold mb-4 uppercase text-sm">
//                 Size
//               </h3>

//               {["XS","S","M","L","XL","XXL","3XL"].map((size) => (
//                 <button
//                   key={size}
//                   onClick={() =>
//                     setSelectedSize(selectedSize === size ? "" : size)
//                   }
//                   className={`block w-full text-left mb-2 text-sm ${
//                     selectedSize === size
//                       ? "text-baba-accent font-medium"
//                       : "hover:text-baba-primary"
//                   }`}
//                 >
//                   {size}
//                 </button>
//               ))}
//             </div>

//             {/* Collection */}
//             <div className="mb-8">
//               <h3 className="font-semibold mb-4 uppercase text-sm">
//                 Our Collection
//               </h3>

//               {[
//                 { label: "Popular Collection", value: "popular" },
//                 { label: "Budget Friendly", value: "budget" },
//                 { label: "Latest Arrivals", value: "latest" }
//               ].map((item) => (
//                 <button
//                   key={item.value}
//                   onClick={() =>
//                     setSelectedCollection(
//                       selectedCollection === item.value ? "" : item.value
//                     )
//                   }
//                   className={`block w-full text-left mb-2 text-sm ${
//                     selectedCollection === item.value
//                       ? "text-baba-accent font-medium"
//                       : "hover:text-baba-primary"
//                   }`}
//                 >
//                   {item.label}
//                 </button>
//               ))}
//             </div>

//             {/* Categories */}
//             <div>
//               <h3 className="font-semibold mb-4 uppercase text-sm">
//                 Categories
//               </h3>

//               {categories.map((cat) => (
//                 <button
//                   key={cat}
//                   onClick={() => setSelectedCategory(cat)}
//                   className={`block w-full text-left mb-2 text-sm ${
//                     selectedCategory === cat
//                       ? "text-baba-accent font-medium"
//                       : "hover:text-baba-primary"
//                   }`}
//                 >
//                   {cat}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </aside>

//         {/* Main */}
//         <main className="flex-grow">
//           <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 flex justify-between items-center">
//             <p>Showing {filteredProducts.length} products</p>

//             <select
//               value={sortBy}
//               onChange={(e) => setSortBy(e.target.value)}
//               className="bg-baba-softbg text-sm px-4 py-2 rounded-md"
//             >
//               <option value="featured">Featured</option>
//               <option value="price-low">Price: Low to High</option>
//               <option value="price-high">Price: High to Low</option>
//             </select>
//           </div>

//           {filteredProducts.length > 0 ? (
//             <motion.div
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
//             >
//               {filteredProducts.map((product) => (
//                 <ProductCard key={product.id} product={product} />
//               ))}
//             </motion.div>
//           ) : (
//             <div className="bg-white p-12 rounded-xl text-center border">
//               <h3 className="text-xl font-serif mb-2">
//                 No products found
//               </h3>
//               <button
//                 onClick={() => {
//                   setSelectedCategory("All");
//                   setSelectedCollection("");
//                   setSelectedSize("");
//                   setPriceRange([0, 5000]);
//                 }}
//                 className="mt-6 text-baba-accent hover:underline font-medium"
//               >
//                 Clear Filters
//               </button>
//             </div>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }
import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import ProductCard from "../components/ProductCard";
import { Filter } from "lucide-react";
import { motion } from "framer-motion";

export default function Shop() {
  const { products } = useShop();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);

  const urlCategory = searchParams.get("category") || "All";
  const urlTag = searchParams.get("tag") || "";
  
  // 🔥 FIXED: Match the key 'search' used in your Navbar
  const searchQuery = searchParams.get("search") || ""; 

  const [selectedCategory, setSelectedCategory] = useState(urlCategory);
  const [selectedCollection, setSelectedCollection] = useState(urlTag);
  const [selectedSize, setSelectedSize] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]); // Increased range for wholesale

  useEffect(() => {
    setSelectedCategory(urlCategory);
    setSelectedCollection(urlTag);
  }, [urlCategory, urlTag]);

  const categories = [
    "All",
    ...Array.from(new Set(products.map((p) => p.category)))
  ];

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // CATEGORY FILTER
    if (selectedCategory !== "All") {
      result = result.filter(
        (p) => p.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // COLLECTION TAG FILTER
    if (selectedCollection) {
      result = result.filter((p) =>
        p.tags.some(tag => tag.toLowerCase() === selectedCollection.toLowerCase())
      );
    }

    // SIZE FILTER
    if (selectedSize) {
      result = result.filter((p) =>
        p.variants.some(
          (variant) => variant.size === selectedSize && variant.stock > 0
        )
      );
    }

    // PRICE FILTER
    result = result.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );

    // 🔍 SEARCH FILTER (🔥 UPDATED LOGIC)
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.code.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    // SORTING LOGIC
    if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [
    products,
    selectedCategory,
    selectedCollection,
    selectedSize,
    priceRange,
    searchQuery, // useMemo watches for URL search changes now
    sortBy
  ]);

  return (
  <div className="bg-baba-softbg min-h-screen pb-20">
    {/* 🔹 Header Section */}
    <div className="bg-baba-primary text-white py-16 px-4 text-center">
      <motion.h1 
        key={searchQuery} // Triggers animation when search changes
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-serif font-bold"
      >
        {searchQuery
          ? `Search Results for: "${searchQuery}"`
          : selectedCategory !== "All" 
            ? selectedCategory 
            : "Our Collection"}
      </motion.h1>
      {searchQuery && (
        <p className="mt-2 opacity-80 text-sm">
          Found {filteredProducts.length} items matching your search
        </p>
      )}
    </div>

    {/* 🔹 Content Section */}
    <div className="container mx-auto px-4 mt-8 flex flex-col md:flex-row gap-8">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-72">
        <div className="bg-white p-6 rounded-xl shadow-sm border sticky top-28">
          <div className="flex items-center gap-2 mb-6 font-serif text-xl border-b pb-4">
            <Filter className="w-5 h-5" />
            Filters
          </div>

          {/* SIZE FILTER */}
          <div className="mb-8">
            <h3 className="font-semibold mb-4 uppercase text-sm">Size</h3>
            <div className="flex flex-wrap gap-2">
              {["XS","S","M","L","XL","XXL","3XL"].map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                  className={`px-3 py-1 border rounded text-xs transition ${
                    selectedSize === size
                      ? "bg-baba-accent text-white border-baba-accent"
                      : "bg-white text-gray-600 hover:border-baba-primary"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* COLLECTION FILTER */}
          <div className="mb-8">
            <h3 className="font-semibold mb-4 uppercase text-sm">Our Collection</h3>
            {[
              { label: "Popular Collection", value: "popular" },
              { label: "Budget Friendly", value: "budget" },
              { label: "Latest Arrivals", value: "latest" }
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setSelectedCollection(selectedCollection === item.value ? "" : item.value)}
                className={`block w-full text-left mb-2 text-sm ${
                  selectedCollection === item.value ? "text-baba-accent font-medium" : "hover:text-baba-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* CATEGORIES FILTER */}
          <div>
            <h3 className="font-semibold mb-4 uppercase text-sm">Categories</h3>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`block w-full text-left mb-2 text-sm ${
                  selectedCategory === cat ? "text-baba-accent font-medium" : "hover:text-baba-primary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN PRODUCT GRID */}
      <main className="flex-grow">
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 flex justify-between items-center">
          <p className="text-sm text-gray-600">Showing {filteredProducts.length} products</p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-baba-softbg text-sm px-4 py-2 rounded-md outline-none border-none"
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        {filteredProducts.length > 0 ? (
          <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </motion.div>
        ) : (
          <div className="bg-white p-20 rounded-xl text-center border">
            <h3 className="text-xl font-serif mb-2">No products found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your filters or search query.</p>
          </div>
        )}
      </main>
    </div>
  </div>
);
}