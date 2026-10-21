import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import ProductCard from "../components/ProductCard";
import { Filter, Search, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const slugify = (value: string | number | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Fallback categories if none exist
const tempCategoryNames = [
  "All",
  "Frocks",
  "Sarees",
  "2 Piece sets",
  "3 Piece sets",
  "Cod sets",
  "Pants",
  "Tops",
];

export default function Shop() {
  const { products, categoriesFromAPI = tempCategoryNames } = useShop();
  const [searchParams, setSearchParams] = useSearchParams();

  // ✅ 1. READ STATE DIRECTLY FROM URL (Single Source of Truth)
  const selectedCategory = searchParams.get("category") || "All";
  const selectedCollection = searchParams.get("tag") || "";
  const urlSearch = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "featured";
  
  // Local UI state (doesn't need to sync with URL)
  const [selectedSize, setSelectedSize] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(urlSearch);

  // ✅ Helper to cleanly update URL params without losing existing ones
  const updateUrlParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (value && value !== "All" && value !== "featured") {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      return newParams;
    }, { replace: true });
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateUrlParam("search", searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    updateUrlParam("search", "");
  };

  // ✅ 2. De-duplicate categories by slug
  const allCategories = useMemo(() => {
    const backend = categoriesFromAPI || [];
    const fromProducts = Array.from(
      new Set(
        products
          .map((p) => p.category_name || p.category)
          .filter(Boolean) as string[]
      )
    );
    const all = ["All", ...backend, ...fromProducts];
    const seenSlugs = new Set<string>();
    const result: string[] = [];
    
    for (const cat of all) {
      const normalized = cat === "All" ? "all" : slugify(cat);
      if (!seenSlugs.has(normalized)) {
        seenSlugs.add(normalized);
        result.push(cat);
      }
    }
    return result.length > 0 ? result : tempCategoryNames;
  }, [products, categoriesFromAPI]);

  // ✅ 3. Extract UNIQUE sizes dynamically from product variants
  const allSizes = useMemo(() => {
    const sizeSet = new Set<string>();

    products.forEach((product) => {
      if (Array.isArray(product.variants)) {
        product.variants.forEach((variant: any) => {
          const size = String(variant?.size || "").trim();
          if (size) sizeSet.add(size);
        });
      }
    });

    const preferredOrder = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "FREE SIZE"];
    const sizes = Array.from(sizeSet);

    return sizes.sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.toUpperCase());
      const bIndex = preferredOrder.indexOf(b.toUpperCase());

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [products]);

  const activeCategoryLabel = useMemo(() => {
    if (selectedCategory === "All") return "All";
    const matchedCategory = allCategories.find(
      (cat) => slugify(cat) === slugify(selectedCategory)
    );
    return matchedCategory || selectedCategory;
  }, [allCategories, selectedCategory]);

  // ✅ 4. Master filtering logic
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];

    let result = [...products];

    if (selectedCategory !== "All") {
      const selectedCategorySlug = slugify(selectedCategory);
      result = result.filter((p) => {
        const categoryNameSlug = slugify(p.category_name);
        const categoryValueSlug = slugify(p.category);
        return (
          categoryNameSlug === selectedCategorySlug ||
          categoryValueSlug === selectedCategorySlug
        );
      });
    }

    if (selectedCollection) {
      result = result.filter(
        (p) =>
          Array.isArray(p.tag_names) &&
          p.tag_names.some((tag: string) => slugify(tag) === slugify(selectedCollection))
      );
    }

    if (selectedSize) {
      result = result.filter(
        (p) =>
          Array.isArray(p.variants) &&
          p.variants.some(
            (variant: any) =>
              String(variant?.size || "").trim().toLowerCase() === selectedSize.toLowerCase() &&
              Number(variant?.stock || 0) > 0
          )
      );
    }

    result = result.filter(
      (p) => Number(p.price) >= priceRange[0] && Number(p.price) <= priceRange[1]
    );

    const query = urlSearch.toLowerCase().trim();
    if (query) {
      result = result.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(query)) ||
          (p.code && p.code.toLowerCase().includes(query)) ||
          (p.category_name && p.category_name.toLowerCase().includes(query)) ||
          (p.description && p.description.toLowerCase().includes(query))
      );
    }

    if (sortBy === "price-low") {
      result.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === "price-high") {
      result.sort((a, b) => Number(b.price) - Number(a.price));
    }

    return result;
  }, [products, selectedCategory, selectedCollection, selectedSize, priceRange, urlSearch, sortBy]);


  return (
    <div className="bg-baba-softbg min-h-screen pb-20">
      
      {/* 📱 MOBILE SEARCH BAR (Sticky) */}
      <div className="md:hidden bg-baba-primary text-white px-4 py-3 sticky top-0 z-40 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <button type="submit">
            <Search className="w-4 h-4 text-white shrink-0" />
          </button>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-transparent text-white placeholder:text-white/60 outline-none text-sm"
          />
          {searchInput && (
            <button type="button" onClick={clearSearch} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* 🖼 HERO HEADER */}
      <div className="bg-baba-primary text-white py-12 md:py-16 px-4 text-center">
        <motion.h1
          key={urlSearch || activeCategoryLabel}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-serif font-bold tracking-wide"
        >
          {urlSearch
            ? `Search: "${urlSearch}"`
            : activeCategoryLabel !== "All"
            ? activeCategoryLabel
            : "Our Collection"}
        </motion.h1>
        <p className="mt-3 opacity-80 text-sm font-medium bg-white/10 inline-block px-4 py-1 rounded-full">
          Showing {filteredProducts.length} items
        </p>
      </div>

      {/* 🗂 MAIN LAYOUT */}
      <div className="container mx-auto px-4 mt-6 md:mt-10 flex flex-col md:flex-row gap-8">
        
        {/* 📱 MOBILE FILTER & SORT BAR */}
        <div className="md:hidden flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition relative"
          >
            <Filter className="w-4 h-4" />
            Filters {(selectedCategory !== "All" || selectedSize || selectedCollection) && <span className="bg-baba-primary text-white w-2 h-2 rounded-full absolute top-1 right-1"></span>}
          </button>
          
          <select
            value={sortBy}
            onChange={(e) => updateUrlParam("sort", e.target.value)}
            className="bg-gray-50 border-none text-sm px-3 py-2 rounded-lg outline-none font-medium text-gray-700"
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        {/* 💻 DESKTOP SIDEBAR */}
        <aside className="w-full md:w-64 lg:w-72 hidden md:block shrink-0">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
            
            {/* DESKTOP SEARCH BAR */}
            <div className="mb-6">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-baba-primary focus-within:bg-white transition-colors">
                <button type="submit">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search products..."
                  className="w-full bg-transparent text-gray-800 placeholder:text-gray-400 outline-none text-sm"
                />
                {searchInput && (
                  <button type="button" onClick={clearSearch} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>
            </div>

            <div className="flex items-center gap-2 mb-6 font-serif text-xl border-b border-gray-100 pb-4 text-gray-800 mt-2">
              <Filter className="w-5 h-5 text-baba-primary" />
              Filters
            </div>

            {/* SIZES */}
            <div className="mb-8">
              <h3 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-xs">Size</h3>
              <div className="flex flex-wrap gap-2">
                {allSizes.length === 0 ? (
                  <span className="text-sm text-gray-400 italic">No sizes available</span>
                ) : (
                  allSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                      className={`min-w-[40px] px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${
                        selectedSize === size
                          ? "bg-baba-primary text-white border-baba-primary shadow-md"
                          : "bg-white text-gray-600 border-gray-200 hover:border-baba-primary hover:text-baba-primary"
                      }`}
                    >
                      {size}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* COLLECTIONS */}
            <div className="mb-8">
              <h3 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-xs">Collections</h3>
              <div className="flex flex-col gap-1">
                {[
                  { label: "Popular Collection", value: "popular" },
                  { label: "Budget Friendly", value: "budget" },
                  { label: "Latest Arrivals", value: "latest" },
                ].map((item) => {
                  const isActive = slugify(selectedCollection) === slugify(item.value);
                  return (
                    <button
                      key={item.value}
                      onClick={() => updateUrlParam("tag", isActive ? "" : item.value)}
                      className={`flex justify-between items-center text-sm text-left py-2 px-3 rounded-lg transition-colors ${
                        isActive ? "bg-baba-softbg text-baba-primary font-semibold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {item.label}
                      {isActive && <ChevronRight className="w-4 h-4" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* CATEGORIES */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-xs">Categories</h3>
              <div className="flex flex-col gap-1">
                {allCategories.map((cat) => {
                  const isActive = slugify(selectedCategory) === slugify(cat);
                  return (
                    <button
                      key={String(cat)}
                      onClick={() => updateUrlParam("category", String(cat))}
                      className={`flex justify-between items-center text-sm text-left py-2 px-3 rounded-lg transition-colors ${
                        isActive ? "bg-baba-softbg text-baba-primary font-semibold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {String(cat)}
                      {isActive && <ChevronRight className="w-4 h-4" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* 📦 PRODUCT GRID */}
        <main className="flex-grow">
          {/* DESKTOP SORT BAR */}
          <div className="hidden md:flex bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100 mb-6 justify-between items-center">
            <p className="text-sm font-medium text-gray-500">
              Showing <span className="text-gray-900 font-bold">{filteredProducts.length}</span> results
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => updateUrlParam("sort", e.target.value)}
                className="bg-gray-50 text-sm px-4 py-2 rounded-lg outline-none border border-gray-200 font-medium text-gray-800 focus:border-baba-primary focus:ring-1 focus:ring-baba-primary"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* THE GRID */}
          {filteredProducts.length > 0 ? (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6"
            >
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 4}
                />
              ))}
            </motion.div>
          ) : (
            <div className="bg-white p-12 md:p-20 rounded-2xl text-center border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-serif mb-2 text-gray-800">No products found</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                We couldn't find any items matching your current filters. Try adjusting categories or sizes to find what you're looking for.
              </p>
              <button
                onClick={() => {
                  setSearchParams(new URLSearchParams(), { replace: true });
                  setSelectedSize("");
                  setSearchInput("");
                }}
                className="mt-6 px-6 py-2 bg-baba-primary text-white rounded-lg text-sm font-medium hover:bg-baba-accent transition"
              >
                Clear all filters
              </button>
            </div>
          )}
        </main>
      </div>

      {/* 📱 MOBILE SLIDE-IN FILTER DRAWER */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-[85%] max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 rounded-l-2xl overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-baba-primary" />
                  Filters
                </h2>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-200 bg-white shadow-sm border border-gray-100 text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-5 overflow-y-auto flex-grow">
                
                {/* Size Filter */}
                <div className="mb-8">
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Size</h3>
                    {selectedSize && (
                      <button onClick={() => setSelectedSize("")} className="text-xs text-baba-primary font-medium">Clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allSizes.length === 0 ? (
                      <span className="text-sm text-gray-400 italic">No sizes</span>
                    ) : (
                      allSizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                          className={`min-w-[40px] px-3 py-2 border rounded-lg text-xs font-medium transition-all ${
                            selectedSize === size
                              ? "bg-baba-primary text-white border-baba-primary shadow-md"
                              : "bg-gray-50 text-gray-700 border-gray-200 hover:border-baba-primary"
                          }`}
                        >
                          {size}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Collections Filter */}
                <div className="mb-8">
                  <h3 className="font-bold text-gray-900 mb-3 uppercase tracking-wider text-xs">Our Collection</h3>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: "Popular Collection", value: "popular" },
                      { label: "Budget Friendly", value: "budget" },
                      { label: "Latest Arrivals", value: "latest" },
                    ].map((item) => {
                      const isActive = slugify(selectedCollection) === slugify(item.value);
                      return (
                        <button
                          key={item.value}
                          onClick={() => updateUrlParam("tag", isActive ? "" : item.value)}
                          className={`text-sm text-left py-3 px-4 border rounded-xl transition ${
                            isActive
                              ? "bg-baba-softbg border-baba-primary text-baba-primary font-semibold"
                              : "bg-white border-gray-200 text-gray-700"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Categories Filter */}
                <div className="mb-4">
                  <h3 className="font-bold text-gray-900 mb-3 uppercase tracking-wider text-xs">Categories</h3>
                  <div className="flex flex-col gap-2">
                    {allCategories.map((cat) => {
                      const isActive = slugify(selectedCategory) === slugify(cat);
                      return (
                        <button
                          key={String(cat)}
                          onClick={() => updateUrlParam("category", String(cat))}
                          className={`text-sm text-left py-3 px-4 border rounded-xl transition ${
                            isActive
                              ? "bg-baba-softbg border-baba-primary text-baba-primary font-semibold"
                              : "bg-white border-gray-200 text-gray-700"
                          }`}
                        >
                          {String(cat)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Drawer Footer / CTA */}
              <div className="p-5 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full py-3.5 bg-baba-primary text-white rounded-xl font-bold shadow-lg shadow-baba-primary/30"
                >
                  Show Results ({filteredProducts.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
