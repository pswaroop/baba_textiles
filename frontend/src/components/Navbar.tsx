// import React, { useState } from "react";
// import { Link } from "react-router-dom";
// import {
//   Menu,
//   Search,
//   ShoppingBag,
//   User,
//   X,
//   ChevronDown,
//   Heart
// } from "lucide-react";
// import { useShop } from "../context/ShopContext";
// import { AnimatePresence, motion } from "framer-motion";

// const Navbar = () => {
//   const [isOpen, setIsOpen] = useState(false);
//   const { cart, wishlist } = useShop();

//   const cartItemCount = cart.reduce(
//     (acc, item) => acc + item.quantity,
//     0
//   );

//   const categoryLinks = [
//   { name: "Sarees", link: "/shop?category=sarees" },
//   { name: "3 Piece Sets", link: "/shop?category=3%20piece%20sets" },
//   { name: "Frocks", link: "/shop?category=frocks" },
//   { name: "Dress Materials", link: "/shop?category=dress%20materials" },
// ];

//   return (
//     <header className="w-full sticky top-0 z-50 bg-white shadow-sm">

//       {/* 🔹 Top Bar */}
//       <div className="bg-baba-primary text-white py-3 px-4">
//   <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm tracking-wide gap-2">

//     {/* Left */}
//     <div>
//       Free Shipping All Over India
//     </div>

//     {/* Right */}
//     <div className="flex items-center gap-6">

//       {/* WhatsApp */}
//       <a
//         href="https://wa.me/918328030460"
//         target="_blank"
//         rel="noopener noreferrer"
//         className="hover:text-baba-accent transition-colors duration-300"
//       >
//         WhatsApp: 8328030460
//       </a>

//       {/* Instagram */}
//       <a
//         href="https://www.instagram.com/srikakulam_wholesale_babatex?igsh=MW83cWp6cmZrcGlmcA=="
//         target="_blank"
//         rel="noopener noreferrer"
//         className="hover:text-baba-accent transition-colors duration-300"
//       >
//         Instagram
//       </a>

//     </div>
//   </div>
// </div>

//       {/* 🔹 Main Navbar */}
//       <div className="max-w-7xl mx-auto px-4">
//         <div className="flex items-center justify-between h-20">

//           {/* LEFT LOGO */}
//           <Link to="/" className="flex items-center">
//   <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-wide text-baba-primary hover:text-baba-accent transition">
//     Baba Textiles
//   </h1>
// </Link>

//           {/* CENTER MENU (Desktop) */}
//           <nav className="hidden md:flex items-center gap-10 uppercase text-sm font-medium tracking-wide text-baba-primary">

//             <Link to="/" className="hover:text-baba-accent transition">
//               Home
//             </Link>

//             {/* Categories Dropdown */}
//             <div className="relative group">
//               <button className="flex items-center gap-1 hover:text-baba-accent transition">
//                 Categories <ChevronDown size={16} />
//               </button>

//               <div className="absolute left-0 mt-6 w-72 bg-white shadow-xl rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 border border-gray-100 z-50">
//                 <div className="py-4">
//                   {categoryLinks.map((cat) => (
//                     <Link
//                       key={cat.name}
//                       to={cat.link}
//                       className="block px-6 py-3 text-sm text-baba-primary hover:bg-baba-softbg hover:text-baba-accent transition"
//                     >
//                       {cat.name}
//                     </Link>
//                   ))}
//                 </div>
//               </div>
//             </div>

//             <Link to="/shop" className="hover:text-baba-accent transition">
//               Popular Collection
//             </Link>

//             <Link to="/shop" className="hover:text-baba-accent transition">
//               Budget Friendly
//             </Link>

//             <Link to="/contact" className="hover:text-baba-accent transition">
//               Contact Us
//             </Link>
//             <Link
//   to="/auth"
//   className="hidden md:flex items-center gap-1 text-baba-primary hover:text-baba-accent transition"
// >
//   <User size={22} />
// </Link>

//           </nav>

//           {/* RIGHT ICONS */}
//           <div className="flex items-center gap-6">

//             <Search
//               size={22}
//               className="cursor-pointer text-baba-primary hover:text-baba-accent transition"
//             />

//             <Link
//   to="/wishlist"
//   className="relative text-baba-primary hover:text-baba-accent transition"
// >
//   <Heart
//     size={22}
//     className={`transition ${
//       wishlist.length > 0
//         ? "fill-red-500 text-red-500"
//         : "text-baba-primary"
//     }`}
//   />

//   {wishlist.length > 0 && (
//     <span className="absolute -top-2 -right-2 bg-baba-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
//       {wishlist.length}
//     </span>
//   )}
// </Link>

//             <Link
//               to="/cart"
//               className="relative text-baba-primary hover:text-baba-accent transition"
//             >
//               <ShoppingBag size={22} />
//               {cartItemCount > 0 && (
//                 <span className="absolute -top-2 -right-2 bg-baba-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
//                   {cartItemCount}
//                 </span>
//               )}
//             </Link>

//             {/* Mobile Menu Button */}
//             <button
//               onClick={() => setIsOpen(true)}
//               className="md:hidden text-baba-primary"
//             >
//               <Menu size={26} />
//             </button>

//           </div>
//         </div>
//       </div>

//       {/* 🔹 Mobile Drawer */}
//       <AnimatePresence>
//         {isOpen && (
//           <>
//             <div
//               onClick={() => setIsOpen(false)}
//               className="fixed inset-0 bg-black/40 z-40"
//             />

//             <motion.div
//               initial={{ x: "-100%" }}
//               animate={{ x: 0 }}
//               exit={{ x: "-100%" }}
//               transition={{ duration: 0.3 }}
//               className="fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-50 p-6"
//             >
//               <button
//                 onClick={() => setIsOpen(false)}
//                 className="mb-8 text-baba-primary"
//               >
//                 <X size={24} />
//               </button>

//               <nav className="flex flex-col uppercase text-baba-primary font-medium">

//   {/* Home */}
//   <Link 
//     to="/" 
//     onClick={() => setIsOpen(false)}
//     className="py-3 border-b"
//   >
//     Home
//   </Link>

//   {/* Categories */}
//   <div className="py-3 border-b">
//     <p className="mb-3">Categories</p>

//     <div className="flex flex-col gap-3 pl-3 text-sm">
//       {categoryLinks.map((cat) => (
//         <Link
//           key={cat.name}
//           to={cat.link}
//           onClick={() => setIsOpen(false)}
//           className="hover:text-baba-accent transition"
//         >
//           {cat.name}
//         </Link>
//       ))}
//     </div>
//   </div>

//   {/* Popular Collection */}
//   <Link 
//     to="/shop" 
//     onClick={() => setIsOpen(false)}
//     className="py-3 border-b"
//   >
//     Popular Collection
//   </Link>

//   {/* Budget Friendly */}
//   <Link 
//     to="/shop" 
//     onClick={() => setIsOpen(false)}
//     className="py-3 border-b"
//   >
//     Budget Friendly
//   </Link>

//   {/* Contact */}
//   <Link 
//     to="/contact" 
//     onClick={() => setIsOpen(false)}
//     className="py-3"
//   >
//     Contact Us
//   </Link>
//   <div className="mt-6 border-t pt-6 flex flex-col gap-4">

//   <Link
//     to="/auth"
//     onClick={() => setIsOpen(false)}
//     className="bg-baba-primary text-white text-center py-2 rounded"
//   >
//     Login / Sign Up
//   </Link>

// </div>



//                 {/* <Link to="/" onClick={() => setIsOpen(false)}>
//                   Home
//                 </Link>

//                 <Link to="/shop" onClick={() => setIsOpen(false)}>
//                   Shop
//                 </Link>

//                 <Link to="/contact" onClick={() => setIsOpen(false)}>
//                   Contact
//                 </Link> */}

//               </nav>
//             </motion.div>
//           </>
//         )}
//       </AnimatePresence>

//     </header>
//   );
// };

// export default Navbar;

// import React, { useEffect, useState } from "react";
// import { Link } from "react-router-dom";
// import {
//   Menu,
//   Search,
//   ShoppingBag,
//   User,
//   X,
//   ChevronDown,
//   Heart,
// } from "lucide-react";
// import { useShop } from "../context/ShopContext";
// import { AnimatePresence, motion } from "framer-motion";
// import { useNavigate } from "react-router-dom";

// /* ✅ Type Definition */
// interface Category {
//   id: number;
//   name: string;
//   slug: string;
//   image?: string | null;
// }

// const Navbar: React.FC = () => {
//   const [isOpen, setIsOpen] = useState<boolean>(false);
//   const [categories, setCategories] = useState<Category[]>([]);
//   const { cart, wishlist, user } = useShop();

//   const cartItemCount = cart.reduce(
//     (acc: number, item: any) => acc + item.quantity,
//     0
//   );
// const Navbar: React.FC = () => {
//   const [isSearchOpen, setIsSearchOpen] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const navigate = useNavigate();

//   const handleSearch = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (searchQuery.trim()) {
//       // Navigate to shop with the search term as a query parameter
//       navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
//       setIsSearchOpen(false);
//       setSearchQuery("");
//     }
//   };

//   /* ✅ Fetch Categories */
//   useEffect(() => {
//     const fetchCategories = async () => {
//       try {
//         const res = await fetch(
//           `${import.meta.env.VITE_API_URL}/api/products/categories/`
//         );
//         const data: Category[] = await res.json();
//         setCategories(data);
//       } catch (error) {
//         console.error("Error fetching categories:", error);
//       }
//     };

//     fetchCategories();
//   }, []);

//   return (
//     <header className="w-full sticky top-0 z-50 bg-white shadow-sm">
//       {/* 🔹 Top Bar */}
//       <div className="bg-baba-primary text-white py-3 px-4">
//         <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm tracking-wide gap-2">
//           <div>Free Shipping All Over India</div>

//           <div className="flex items-center gap-6">
//             <a
//               href="https://wa.me/918328030460"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="hover:text-baba-accent transition-colors duration-300"
//             >
//               WhatsApp: 8328030460
//             </a>

//             <a
//               href="https://www.instagram.com/srikakulam_wholesale_babatex"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="hover:text-baba-accent transition-colors duration-300"
//             >
//               Instagram
//             </a>
//           </div>
//         </div>
//       </div>

//       {/* 🔹 Main Navbar */}
//       <div className="max-w-7xl mx-auto px-4">
//         <div className="flex items-center justify-between h-20">
//           {/* Logo */}
//           <Link to="/" className="flex items-center">
//             <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-wide text-baba-primary hover:text-baba-accent transition">
//               Baba Textiles
//             </h1>
//           </Link>

//           {/* Desktop Menu */}
//           <nav className="hidden md:flex items-center gap-10 uppercase text-sm font-medium tracking-wide text-baba-primary">
//             <Link to="/" className="hover:text-baba-accent transition">
//               Home
//             </Link>

//             {/* Categories Dropdown */}
//             <div className="relative group">
//               <button className="flex items-center gap-1 hover:text-baba-accent transition">
//                 Categories <ChevronDown size={16} />
//               </button>

//               <div className="absolute left-0 mt-6 w-72 bg-white shadow-xl rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 border border-gray-100 z-50">
//                 <div className="py-4">
//                   {categories.map((cat) => (
//                     <Link
//                       key={cat.id}
//                       to={`/shop?category=${cat.slug}`}
//                       className="block px-6 py-3 text-sm hover:bg-baba-softbg hover:text-baba-accent transition"
//                     >
//                       {cat.name}
//                     </Link>
//                   ))}
//                 </div>
//               </div>
//             </div>

//             <Link
//               to="/shop?tag=popular"
//               className="hover:text-baba-accent transition"
//             >
//               Popular Collection
//             </Link>

//             <Link
//               to="/shop?tag=budget"
//               className="hover:text-baba-accent transition"
//             >
//               Budget Friendly
//             </Link>

//             <Link
//               to="/contact"
//               className="hover:text-baba-accent transition"
//             >
//               Contact Us
//             </Link>

//             <Link
//   to={user ? "/profile" : "/auth"}
//   className="flex items-center gap-1 hover:text-baba-accent transition"
// >
//   <User size={22} />
// </Link>
//           </nav>

//           {/* Right Icons */}
//           <div className="flex items-center gap-6">
//             <Search
//               size={22}
//               className="cursor-pointer hover:text-baba-accent transition"
//             />

//             <Link to="/wishlist" className="relative">
//               <Heart
//                 size={22}
//                 className={`transition ${
//                   wishlist.length > 0
//                     ? "fill-red-500 text-red-500"
//                     : ""
//                 }`}
//               />
//               {wishlist.length > 0 && (
//                 <span className="absolute -top-2 -right-2 bg-baba-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
//                   {wishlist.length}
//                 </span>
//               )}
//             </Link>

//             <Link to="/cart" className="relative">
//               <ShoppingBag size={22} />
//               {cartItemCount > 0 && (
//                 <span className="absolute -top-2 -right-2 bg-baba-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
//                   {cartItemCount}
//                 </span>
//               )}
//             </Link>

//             <button
//               onClick={() => setIsOpen(true)}
//               className="md:hidden"
//             >
//               <Menu size={26} />
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* 🔹 Mobile Drawer */}
//       <AnimatePresence>
//         {isOpen && (
//           <>
//             <div
//               onClick={() => setIsOpen(false)}
//               className="fixed inset-0 bg-black/40 z-40"
//             />

//             <motion.div
//               initial={{ x: "-100%" }}
//               animate={{ x: 0 }}
//               exit={{ x: "-100%" }}
//               transition={{ duration: 0.3 }}
//               className="fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-50 p-6"
//             >
//               <button
//                 onClick={() => setIsOpen(false)}
//                 className="mb-8"
//               >
//                 <X size={24} />
//               </button>

//               <nav className="flex flex-col uppercase font-medium">
//                 <Link
//                   to="/"
//                   onClick={() => setIsOpen(false)}
//                   className="py-3 border-b"
//                 >
//                   Home
//                 </Link>

//                 <div className="py-3 border-b">
//                   <p className="mb-3">Categories</p>
//                   <div className="flex flex-col gap-3 pl-3 text-sm">
//                     {categories.map((cat) => (
//                       <Link
//                         key={cat.id}
//                         to={`/shop?category=${cat.slug}`}
//                         onClick={() => setIsOpen(false)}
//                         className="hover:text-baba-accent transition"
//                       >
//                         {cat.name}
//                       </Link>
//                     ))}
//                   </div>
//                 </div>

//                 <Link
//                   to="/shop?tag=popular"
//                   onClick={() => setIsOpen(false)}
//                   className="py-3 border-b"
//                 >
//                   Popular Collection
//                 </Link>

//                 <Link
//                   to="/shop?tag=budget"
//                   onClick={() => setIsOpen(false)}
//                   className="py-3 border-b"
//                 >
//                   Budget Friendly
//                 </Link>

//                 <Link
//                   to="/contact"
//                   onClick={() => setIsOpen(false)}
//                   className="py-3"
//                 >
//                   Contact Us
//                 </Link>
//               </nav>
//             </motion.div>
//           </>
//         )}
//       </AnimatePresence>
//     </header>
//   );
// };

// export default Navbar;

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
  ChevronDown,
  Heart,
} from "lucide-react";
import { useShop } from "../context/ShopContext";
import { AnimatePresence, motion } from "framer-motion";

/* ✅ Type Definition */
interface Category {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
}

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  
  const navigate = useNavigate();
  const { cart, wishlist, user } = useShop();

  const cartItemCount = cart.reduce(
    (acc: number, item: any) => acc + item.quantity,
    0
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };

  /* ✅ Fetch Categories */
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/products/categories/`
        );
        const data: Category[] = await res.json();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  return (
    <header className="w-full sticky top-0 z-50 bg-white shadow-sm">
      {/* 🔹 Top Bar */}
      <div className="bg-baba-primary text-white py-3 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm tracking-wide gap-2">
          <div>Free Shipping All Over India</div>
          <div className="flex items-center gap-6">
            <a href="https://wa.me/918328030460" target="_blank" rel="noopener noreferrer" className="hover:text-baba-accent transition">
              WhatsApp: 8328030460
            </a>
            <a href="https://www.instagram.com/srikakulam_wholesale_babatex" target="_blank" rel="noopener noreferrer" className="hover:text-baba-accent transition">
              Instagram
            </a>
          </div>
        </div>
      </div>

      {/* 🔹 Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 relative">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-wide text-baba-primary hover:text-baba-accent transition">
              Baba Textiles
            </h1>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-10 uppercase text-sm font-medium tracking-wide text-baba-primary">
            <Link to="/" className="hover:text-baba-accent transition">Home</Link>

            <div className="relative group">
              <button className="flex items-center gap-1 hover:text-baba-accent transition">
                Categories <ChevronDown size={16} />
              </button>
              <div className="absolute left-0 mt-6 w-72 bg-white shadow-xl rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 border border-gray-100 z-50">
                <div className="py-4">
                  {categories.map((cat) => (
                    <Link key={cat.id} to={`/shop?category=${cat.slug}`} className="block px-6 py-3 text-sm hover:bg-baba-softbg hover:text-baba-accent transition">
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link to="/shop?tag=popular" className="hover:text-baba-accent transition">Popular</Link>
            <Link to="/shop?tag=budget" className="hover:text-baba-accent transition">Budget Friendly</Link>
            <Link to="/contact" className="hover:text-baba-accent transition">Contact</Link>
            
            <Link to={user ? "/profile" : "/auth"} className="hover:text-baba-accent transition">
              <User size={22} />
            </Link>
          </nav>

          {/* Right Icons */}
          <div className="flex items-center gap-6">
            <Search
              size={22}
              className="cursor-pointer hover:text-baba-accent transition"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            />

            <Link to="/wishlist" className="relative">
              <Heart size={22} className={wishlist.length > 0 ? "fill-red-500 text-red-500" : ""} />
              {wishlist.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-baba-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <Link to="/cart" className="relative">
              <ShoppingBag size={22} />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-baba-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {cartItemCount}
                </span>
              )}
            </Link>

            <button onClick={() => setIsOpen(true)} className="md:hidden">
              <Menu size={26} />
            </button>
          </div>
        </div>

        {/* 🔍 ANIMATED SEARCH BAR OVERLAY */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-20 bg-white border-b border-gray-100 p-4 shadow-md z-40"
            >
              <form onSubmit={handleSearch} className="max-w-3xl mx-auto flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3 border-none focus:ring-0 text-lg font-serif outline-none"
                />
                <button type="submit" className="text-baba-primary hover:text-baba-accent p-2">
                  <Search size={24} />
                </button>
                <button type="button" onClick={() => setIsSearchOpen(false)} className="text-gray-400 hover:text-red-500 p-2">
                  <X size={24} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 🔹 Mobile Drawer ... (Rest of your drawer code remains the same) */}
    </header>
  );
};

export default Navbar;