import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  ShoppingBag,
  User,
  X,
  ChevronDown,
  Heart,
} from "lucide-react";
import { useShop } from "../context/ShopContext";
import { AnimatePresence, motion } from "framer-motion";
import { Instagram } from "lucide-react";
/* ✅ Type Definition */
interface Category {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
}

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const { cart, wishlist, user } = useShop();

  const cartItemCount = cart.reduce(
    (acc: number, item: any) => acc + item.quantity,
    0
  );

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

  // Helper to ensure page scrolls to top on route change
  const handleNavClick = () => {
    window.scrollTo(0, 0);
  };

  const handleMobileNavClick = () => {
    setIsOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <header className="w-full sticky top-0 z-50 bg-white shadow-sm">
      {/* 🔹 Top Bar */}
      <div className="bg-baba-primary text-white py-2 md:py-3 px-4 text-xs md:text-sm border-b border-white/10">
  <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
    <div className="font-medium tracking-wide">Shipping All Over India</div>
    
    <div className="flex items-center gap-5 sm:gap-6 font-medium">
      <a 
        href="https://wa.me/918125114993" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-1.5 hover:text-white/80 transition-colors"
      >
        {/* Custom WhatsApp SVG Logo */}
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.305-.885-.653-1.48-1.459-1.653-1.756-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        WhatsApp: +91 8125114993
      </a>
      
      <a 
        href="https://www.instagram.com/babatextiles_srikakulam?igsh=MWJ2NTQ3Zm1udGp3Ng%3D%3D&utm_source=qr" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-1.5 hover:text-white/80 transition-colors"
      >
        <Instagram className="w-4 h-4" />
        Instagram
      </a>
    </div>
  </div>
</div>       

      {/* 🔹 Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 relative">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" onClick={handleNavClick} className="flex items-center">
            <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-wide text-baba-primary hover:text-baba-accent transition">
              Baba Textiles
            </h1>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-10 uppercase text-sm font-medium tracking-wide text-baba-primary">
            <Link to="/" onClick={handleNavClick} className="hover:text-baba-accent transition">
              Home
            </Link>

            <div className="relative group">
              {/* Added py-4 to expand the hover hit-area of the button */}
              <button className="flex items-center gap-1 hover:text-baba-accent transition py-4">
                Categories <ChevronDown size={16} />
              </button>
              
              {/* 🚀 FIX: Used top-full and pt-2 to create an invisible "bridge" so mouse doesn't lose hover state */}
              <div className="absolute left-0 top-full pt-2 w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                <div className="bg-white shadow-xl rounded-md border border-gray-100 py-3">
                  {categories.map((cat) => (
                    <Link 
                      key={cat.id} 
                      to={`/shop?category=${cat.slug}`} 
                      onClick={handleNavClick}
                      className="block px-6 py-2.5 text-sm hover:bg-baba-softbg hover:text-baba-accent transition"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link to="/shop?tag=popular" onClick={handleNavClick} className="hover:text-baba-accent transition">Popular</Link>
            <Link to="/shop?tag=budget" onClick={handleNavClick} className="hover:text-baba-accent transition">Budget Friendly</Link>
            <Link to="/contact" onClick={handleNavClick} className="hover:text-baba-accent transition">Contact</Link>
            
            <Link to={user ? "/profile" : "/auth"} onClick={handleNavClick} className="hover:text-baba-accent transition">
              <User size={22} />
            </Link>
          </nav>

          {/* Right Icons */}
          <div className="flex items-center gap-6">
            <Link to="/wishlist" onClick={handleNavClick} className="relative">
              <Heart size={22} className={wishlist.length > 0 ? "fill-red-500 text-red-500" : ""} />
              {wishlist.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-baba-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <Link to="/cart" onClick={handleNavClick} className="relative">
              <ShoppingBag size={22} />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-baba-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {cartItemCount}
                </span>
              )}
            </Link>

            <button onClick={() => setIsOpen(!isOpen)} className="md:hidden">
              <Menu size={26} />
            </button>
          </div>
        </div>
      </div>

      {/* 🔹 Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 z-40"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3 }}
              className="fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-50 p-6 overflow-y-auto"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="mb-8 text-baba-primary"
              >
                <X size={24} />
              </button>

              {/* Menu */}
              <nav className="flex flex-col uppercase text-baba-primary font-medium">

                <Link
                  to="/"
                  onClick={handleMobileNavClick}
                  className="py-3 border-b"
                >
                  Home
                </Link>

                {/* Categories */}
                <div className="py-3 border-b">
                  <p className="mb-3">Categories</p>

                  <div className="flex flex-col gap-3 pl-3 text-sm">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/shop?category=${cat.slug}`}
                        onClick={handleMobileNavClick}
                        className="hover:text-baba-accent transition"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>

                <Link
                  to="/shop?tag=popular"
                  onClick={handleMobileNavClick}
                  className="py-3 border-b"
                >
                  Popular
                </Link>

                <Link
                  to="/shop?tag=budget"
                  onClick={handleMobileNavClick}
                  className="py-3 border-b"
                >
                  Budget Friendly
                </Link>

                <Link
                  to="/contact"
                  onClick={handleMobileNavClick}
                  className="py-3"
                >
                  Contact
                </Link>

                {/* Auth */}
                <div className="mt-6 border-t pt-6 pb-10">
                  <Link
                    to={user ? "/profile" : "/auth"}
                    onClick={handleMobileNavClick}
                    className="block bg-baba-primary text-white text-center py-3 rounded-lg shadow-sm hover:bg-gray-800 transition"
                  >
                    {user ? "My Profile" : "Login / Sign Up"}
                  </Link>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
