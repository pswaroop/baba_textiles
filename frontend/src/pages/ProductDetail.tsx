import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useShop } from "../context/ShopContext";
import { productLargeSrcSet, productSrcSet, smallestProductImage } from "../utils/images";
import type { Product, ProductColor, ProductVariant } from "../context/ShopContext";
import {
  ShoppingBag,
  ChevronRight,
  ChevronDown,
  Heart,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Zap,
} from "lucide-react";

type NormalizedImage = {
  id: number | string;
  url: string;
  thumbUrl: string;
  smallUrl: string;
  largeSrcSet?: string;   // main photo: 600w/1000w
  tileSrcSet?: string;    // gallery strip: 300w/600w
  colorId: string | null;
};

// ─── Preload only the first N images with high priority ───────────────────────
// Previously this fired requests for ALL product images simultaneously, which
// on mobile (limited bandwidth) caused the hero image to compete with every
// other image and actually load SLOWER. Now we only preload the first 2:
//   • idx 0 → fetchpriority="high"  (the hero — needs to be on screen ASAP)
//   • idx 1 → fetchpriority="auto"  (next slide — nice to have ready)
// Everything else loads lazily via loading="lazy" on thumbnail <img> tags,
// so bandwidth goes where it matters most.
// Width of the main photo: full screen on phones, half the page from 1024px.
const MAIN_IMAGE_SIZES = "(min-width: 1024px) 45vw, 100vw";

function preloadImages(
  urls: string[],
  count = 2,
  srcSets?: Map<string, string | undefined>,
): () => void {
  const links: HTMLLinkElement[] = [];

  urls.slice(0, count).forEach((src, idx) => {
    if (!src || src === "/placeholder.png") return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = src;
    const srcSet = srcSets?.get(src);
    if (srcSet) {
      // Preload the size the <img> will pick, not the largest one.
      link.setAttribute("imagesrcset", srcSet);
      link.setAttribute("imagesizes", MAIN_IMAGE_SIZES);
    }
    link.setAttribute("fetchpriority", idx === 0 ? "high" : "auto");
    document.head.appendChild(link);
    links.push(link);
  });

  // Cleanup: remove the <link> tags we injected into <head>
  return () => links.forEach((l) => l.parentNode?.removeChild(l));
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    products,
    isLoading: isShopLoading,
    fetchProductById,
    addToCart,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  } = useShop();

  const listedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(id)),
    [products, id],
  );

  // Only tagged products are preloaded. A shared link (e.g. from Instagram) to
  // any other product is fetched on its own instead of showing "not found".
  const [fetched, setFetched] = useState<{ id: string; product: Product | null } | null>(null);

  // Fetched straight away, not after the (larger, slower) product list has
  // loaded: a product page opened from a link shows up as soon as it can.
  useEffect(() => {
    if (listedProduct || !id) return;
    let cancelled = false;
    fetchProductById(id).then((result) => {
      if (!cancelled) setFetched({ id, product: result });
    });
    return () => {
      cancelled = true;
    };
  }, [id, listedProduct, fetchProductById]);

  const product =
    listedProduct ?? (fetched && fetched.id === id ? fetched.product ?? undefined : undefined);

  // On a hard refresh, `products` starts empty and only fills in after the
  // ShopContext fetch resolves. We distinguish "still fetching" from
  // "fetch finished and genuinely not found" to avoid a false "not found" flash.
  const isProductStillResolving = !product && fetched?.id !== id;

  const hasSizes = product?.has_sizes ?? false;
  const wishlisted = product ? isInWishlist(product.id) : false;
  const availableColors: ProductColor[] = product?.available_colors || [];
  const requiresColorSelection = availableColors.length > 1;

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const pendingHeroIndexRef = useRef<number | null>(null);

  // ─── Step 1: Normalize images ─────────────────────────────────────────────
  const normalizedImages = useMemo<NormalizedImage[]>(() => {
    const raw = product?.images ?? [];
    const imgs = raw
      .map((img, idx) => ({
        id: img.id ?? idx,
        url: img.image ?? "",
        thumbUrl: img.thumbnail || img.image || "",
        smallUrl: smallestProductImage(img),
        largeSrcSet: productLargeSrcSet(img),
        tileSrcSet: productSrcSet({ small: img.small, thumbnail: img.thumbnail }),
        colorId:
          img.color !== null && img.color !== undefined
            ? String(img.color)
            : null,
      }))
      .filter((img) => !!img.url);
    return imgs.length
      ? imgs
      : [{ id: "placeholder", url: "/placeholder.png", thumbUrl: "/placeholder.png", smallUrl: "/placeholder.png", colorId: null }];
  }, [product]);

  // ─── Step 2: Color mapping flags ──────────────────────────────────────────
  const hasAnyColorMapping = useMemo(
    () => normalizedImages.some((img) => img.colorId !== null),
    [normalizedImages],
  );

  // ─── Step 3: colorId → images map ────────────────────────────────────────
  const imagesByColorId = useMemo<Map<string, NormalizedImage[]>>(() => {
    const map = new Map<string, NormalizedImage[]>();
    for (const img of normalizedImages) {
      if (!img.colorId) continue;
      map.set(img.colorId, [...(map.get(img.colorId) ?? []), img]);
    }
    return map;
  }, [normalizedImages]);

  // ─── Step 4: heroImages ───────────────────────────────────────────────────
  const heroImages = useMemo<string[]>(() => {
    const allUrls = normalizedImages.map((img) => img.url);
    if (!selectedColor || !hasAnyColorMapping) return allUrls;
    const colorId = String(selectedColor.id);
    const mapped = imagesByColorId.get(colorId)?.map((img) => img.url) ?? [];
    return mapped.length ? mapped : allUrls;
  }, [selectedColor, hasAnyColorMapping, normalizedImages, imagesByColorId]);

  const safeHeroIndex = Math.min(heroIndex, Math.max(0, heroImages.length - 1));
  const heroImageSrc = heroImages[safeHeroIndex] || "/placeholder.png";
  // Same choice of sizes as the <img> below, so a preload is never wasted.
  const srcSetByUrl = useMemo(
    () => new Map(normalizedImages.map((img) => [img.url, img.largeSrcSet])),
    [normalizedImages],
  );
  const heroSrcSet = srcSetByUrl.get(heroImageSrc);

  // ─── Preload first 2 images when product loads ────────────────────────────
  // Only the hero + next slide get preloaded. Remaining thumbnails load lazily
  // (loading="lazy" on their <img> tags below) so mobile bandwidth isn't wasted
  // on images the user may never scroll to.
  useEffect(() => {
    const allUrls = normalizedImages
      .map((img) => img.url)
      .filter((url) => url && url !== "/placeholder.png");

    if (!allUrls.length) return;

    return preloadImages(allUrls, 2, srcSetByUrl);
  }, [normalizedImages, srcSetByUrl]);

  // ─── Color matching ───────────────────────────────────────────────────────
  const colorsMatch = useCallback(
    (a: ProductColor | undefined, b: ProductColor | null | undefined): boolean => {
      if (!a || !b) return false;
      if (a.id != null && b.id != null && String(a.id) === String(b.id))
        return true;
      return (
        String(a.name).trim().toLowerCase() ===
        String(b.name).trim().toLowerCase()
      );
    },
    [],
  );

  // ─── Reverse lookup: URL → ProductColor ──────────────────────────────────
  const findColorForUrl = useCallback(
    (url: string): ProductColor | null => {
      if (!hasAnyColorMapping) return null;
      const entry = normalizedImages.find((img) => img.url === url);
      if (!entry?.colorId) return null;
      return availableColors.find((c) => String(c.id) === entry.colorId) ?? null;
    },
    [hasAnyColorMapping, normalizedImages, availableColors],
  );

  // ─── Derived variant / stock ──────────────────────────────────────────────
  const isColorOutOfStock = useCallback(
    (color: ProductColor): boolean => {
      if (!product?.variants?.length) return false;
      const variants = product.variants.filter((v: ProductVariant) =>
        colorsMatch(v.color, color),
      );
      return (
        variants.length > 0 &&
        variants.every((v: ProductVariant) => Number(v.stock) <= 0)
      );
    },
    [product, colorsMatch],
  );

  const selectedVariant = useMemo(() => {
    if (!product || !selectedColor) return undefined;
    if (hasSizes && selectedSize) {
      return product.variants?.find(
        (v: ProductVariant) =>
          colorsMatch(v.color, selectedColor) && v.size === selectedSize,
      );
    }
    return product.variants?.find((v: ProductVariant) =>
      colorsMatch(v.color, selectedColor),
    );
  }, [product, selectedColor, selectedSize, hasSizes, colorsMatch]);

  const selectedVariantStock = Number(selectedVariant?.stock || 0);

  const totalStock = useMemo(() => {
    if (!product?.variants?.length) return 0;
    return product.variants.reduce(
      (sum: number, v: ProductVariant) =>
        sum + Math.max(0, Number(v.stock || 0)),
      0,
    );
  }, [product]);

  const hasAnyInStockColor = useMemo(
    () => availableColors.some((c: ProductColor) => !isColorOutOfStock(c)),
    [availableColors, isColorOutOfStock],
  );

  const allVariantsForColor = useMemo(() => {
    if (!product || !selectedColor) return [];
    return (
      product.variants?.filter((v: ProductVariant) =>
        colorsMatch(v.color, selectedColor),
      ) || []
    );
  }, [product, selectedColor, colorsMatch]);

  const isProductOutOfStock = totalStock <= 0;
  const showLowStockMessage =
    !!selectedVariant && selectedVariantStock > 0 && selectedVariantStock < 5;
  const needsColorSelection =
    !isProductOutOfStock && requiresColorSelection && !selectedColor;
  const needsSizeSelection =
    !isProductOutOfStock && hasSizes && !!selectedColor && !selectedSize;
  const isOutOfStock = hasSizes
    ? isProductOutOfStock ||
      !selectedColor ||
      !selectedSize ||
      !selectedVariant ||
      selectedVariantStock <= 0
    : isProductOutOfStock ||
      !selectedColor ||
      !selectedVariant ||
      selectedVariantStock <= 0;

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!product) return;
    setSelectedColor(availableColors.length === 1 ? availableColors[0] : null);
    setSelectedSize("");
    setQuantity(1);
    setHeroIndex(0);
    setIsZoomed(false);
    pendingHeroIndexRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    setHeroIndex(0);
    setIsZoomed(false);
  }, [selectedColor]);

  useEffect(() => {
    if (pendingHeroIndexRef.current !== null) {
      setHeroIndex(pendingHeroIndexRef.current);
      pendingHeroIndexRef.current = null;
    }
  }, [heroImages]);

  useEffect(() => {
    if (heroImages.length > 0 && heroIndex >= heroImages.length) {
      setHeroIndex(0);
    }
  }, [heroImages.length, heroIndex]);

  // ─── Carousel navigation ──────────────────────────────────────────────────
  const goToNext = useCallback(() => {
    if (!heroImages.length) return;
    setHeroIndex((prev) => (prev + 1) % heroImages.length);
    setIsZoomed(false);
  }, [heroImages.length]);

  const goToPrev = useCallback(() => {
    if (!heroImages.length) return;
    setHeroIndex((prev) => (prev - 1 + heroImages.length) % heroImages.length);
    setIsZoomed(false);
  }, [heroImages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "Escape" && isZoomed) setIsZoomed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToPrev, goToNext, isZoomed]);

  // ─── Thumbnail click ──────────────────────────────────────────────────────
  const handleThumbnailClick = useCallback(
    (url: string) => {
      setIsZoomed(false);
      const mappedColor = findColorForUrl(url);

      if (
        mappedColor &&
        String(mappedColor.id) !== String(selectedColor?.id ?? "")
      ) {
        const colorId = String(mappedColor.id);
        const colorImgs = imagesByColorId.get(colorId) ?? [];
        const idxInSet = Math.max(
          0,
          colorImgs.findIndex((img) => img.url === url),
        );
        pendingHeroIndexRef.current = idxInSet;
        setSelectedColor(mappedColor);
        setSelectedSize("");
        setQuantity(1);
      } else {
        const idx = heroImages.findIndex((u) => u === url);
        if (idx !== -1) setHeroIndex(idx);
      }
    },
    [findColorForUrl, imagesByColorId, heroImages, selectedColor],
  );

  const handleColorClick = useCallback((color: ProductColor) => {
    setSelectedColor(color);
    setSelectedSize("");
    setQuantity(1);
  }, []);

  // ─── Cart / Buy ───────────────────────────────────────────────────────────
  const handleAddToCart = (): boolean => {
    if (!product) return false;
    if (isProductOutOfStock) {
      toast.error("This product is out of stock");
      return false;
    }
    if (!selectedColor) {
      toast.warning("Please select a colour first");
      return false;
    }
    if (hasSizes && !selectedSize) {
      toast.warning("Please select a size first");
      return false;
    }
    if (!selectedVariant) {
      toast.error(
        hasSizes
          ? "Selected size is unavailable"
          : "Selected color is unavailable",
      );
      return false;
    }
    if (selectedVariantStock <= 0) {
      toast.error(
        hasSizes
          ? "Selected size is out of stock"
          : "Selected color is out of stock",
      );
      return false;
    }
    addToCart(
      product,
      selectedColor,
      hasSizes ? selectedSize : "",
      quantity,
      selectedVariant.id,
    );
    toast.success("Added to cart successfully! 🛍️");
    return true;
  };

  const handleBuyNow = () => {
    if (handleAddToCart()) navigate("/checkout");
  };

  // ─── Loading state — product list still fetching, don't show "not found" ──
  if (isProductStillResolving) {
    return (
      <div className="bg-baba-softbg min-h-screen py-10">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="bg-gray-50 p-4 md:p-8">
                <div className="rounded-xl bg-gray-200 aspect-[4/5] md:aspect-square" />
                <div className="flex gap-3 mt-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="w-20 h-24 rounded-lg bg-gray-200 flex-shrink-0" />
                  ))}
                </div>
              </div>
              <div className="p-6 md:p-8 lg:p-10 space-y-6">
                <div className="h-8 bg-gray-200 rounded w-3/4" />
                <div className="h-6 bg-gray-200 rounded w-1/3" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
                <div className="h-12 bg-gray-200 rounded w-full mt-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Genuinely not found — fetch finished AND product isn't in the list ──
  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <p className="text-xl text-gray-500 font-medium mb-4">Product not found</p>
        <Link
          to="/shop"
          className="px-6 py-2.5 bg-baba-primary text-white rounded-lg text-sm font-medium hover:bg-baba-accent transition"
        >
          Browse all products
        </Link>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-baba-softbg min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-gray-500 mb-8 overflow-x-auto whitespace-nowrap pb-2">
          <Link to="/" className="hover:text-black transition-colors">
            Home
          </Link>
          <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
          <Link
            to={`/shop?category=${product.category}`}
            className="hover:text-black transition-colors"
          >
            {product.category_name}
          </Link>
          <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
          <span className="text-black font-medium">{product.name}</span>
        </nav>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">

            {/* ── Left: Images ─────────────────────────────────────────────── */}
            <div className="bg-gray-50 p-4 md:p-8 relative border-b lg:border-b-0 lg:border-r border-gray-100">

              {/* Hero image */}
              <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100 aspect-[4/5] md:aspect-square flex items-center justify-center shadow-inner">

                <div className="absolute inset-0 flex items-center justify-center text-gray-200">
                  <ImageIcon className="w-16 h-16 opacity-50" />
                </div>

                {isProductOutOfStock && (
                  <div className="absolute top-4 left-4 z-30 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold tracking-widest shadow-lg">
                    SOLD OUT
                  </div>
                )}

                {/*
                  No key={heroImageSrc} here — changing key unmounts+remounts
                  the DOM node causing a blank flash. We change src in-place;
                  the browser swaps from cache instantly for the first 2 images
                  which were preloaded above.
                */}
                <img
                  src={heroImageSrc}
                  // Zoom (2.5x) needs the full-size photo, so drop srcset then.
                  srcSet={isZoomed ? undefined : heroSrcSet}
                  sizes={MAIN_IMAGE_SIZES}
                  alt={product.name}
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  className={`w-full h-full object-contain relative z-10 transition-opacity duration-150 ${
                    isProductOutOfStock ? "opacity-75" : "cursor-zoom-in"
                  } ${isZoomed ? "cursor-grab active:cursor-grabbing" : ""}`}
                  style={{
                    transform: `scale(${isZoomed ? 2.5 : 1})`,
                    transition: isZoomed
                      ? "transform 0.3s cubic-bezier(0.2, 0, 0, 1)"
                      : "opacity 0.15s ease",
                  }}
                  onClick={() => {
                    if (!isProductOutOfStock) setIsZoomed((p) => !p);
                  }}
                />

                {isZoomed && (
                  <div
                    className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
                    onClick={() => setIsZoomed(false)}
                  />
                )}

                {!isProductOutOfStock && (
                  <button
                    onClick={() => setIsZoomed((p) => !p)}
                    className="absolute top-4 right-4 z-30 bg-white/90 backdrop-blur p-2.5 rounded-full shadow hover:scale-105 transition text-gray-700"
                    title={isZoomed ? "Zoom Out (Esc)" : "Zoom In"}
                    type="button"
                  >
                    {isZoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
                  </button>
                )}

                {heroImages.length > 1 && !isZoomed && (
                  <>
                    <button
                      onClick={goToPrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur p-2.5 rounded-full shadow hover:bg-white transition z-30 text-gray-700"
                      type="button"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur p-2.5 rounded-full shadow hover:bg-white transition z-30 text-gray-700"
                      type="button"
                    >
                      <ChevronRight size={24} />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium tracking-widest z-30">
                      {safeHeroIndex + 1} / {heroImages.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {normalizedImages.length > 1 && (
                <div className="flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
                  {normalizedImages.map((img, index) => {
                    const isActive = img.url === heroImageSrc;
                    const thumbColor = img.colorId
                      ? (availableColors.find(
                          (c) => String(c.id) === img.colorId,
                        ) ?? null)
                      : null;
                    const showDot =
                      thumbColor &&
                      String(thumbColor.id) !== String(selectedColor?.id ?? "");

                    return (
                      <button
                        key={String(img.id)}
                        type="button"
                        onClick={() => handleThumbnailClick(img.url)}
                        className={`relative w-20 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all snap-start bg-white z-10 ${
                          isActive
                            ? "border-baba-primary opacity-100"
                            : "border-transparent opacity-60 hover:opacity-100 hover:border-gray-300"
                        }`}
                      >
                        {/*
                          First 2 thumbnails match our preloaded images, so
                          loading="eager" serves them from cache instantly.
                          The rest load lazily — they're off-screen on mobile
                          and there's no point fetching them upfront.
                        */}
                        <img
                          src={img.smallUrl}
                          srcSet={img.tileSrcSet}
                          sizes="96px"
                          alt={`${product.name} view ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading={index < 2 ? "eager" : "lazy"}
                          decoding="async"
                        />
                        {showDot && (
                          <span
                            className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                            style={{ backgroundColor: thumbColor.color }}
                            title={`Switch to ${thumbColor.name}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Right: Info ───────────────────────────────────────────────── */}
            <div className="p-6 md:p-8 lg:p-10 flex flex-col h-full bg-white">

              {/* Name + wishlist */}
              <div className="flex items-start justify-between mb-2 gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-gray-900 leading-tight">
                    {product.name}
                  </h1>
                  {isProductOutOfStock && (
                    <div className="mt-3 inline-flex items-center rounded-full bg-red-50 text-red-700 border border-red-200 px-3 py-1 text-xs font-bold tracking-wider">
                      SOLD OUT
                    </div>
                  )}
                </div>
                <button
                  onClick={() =>
                    wishlisted
                      ? removeFromWishlist(product.id)
                      : addToWishlist(product)
                  }
                  className={`p-3 rounded-full hover:scale-105 transition-all flex-shrink-0 border ${
                    wishlisted
                      ? "bg-red-50 border-red-100"
                      : "bg-white border-gray-200 hover:border-gray-300 shadow-sm"
                  }`}
                  title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                  type="button"
                >
                  <Heart
                    size={22}
                    className={`transition-colors ${
                      wishlisted
                        ? "fill-red-500 text-red-500"
                        : "text-gray-600"
                    }`}
                  />
                </button>
              </div>

              {/* Price */}
              <div className="flex items-end gap-3 mb-8 flex-wrap">
                <p className="text-3xl font-bold text-baba-primary">
                  ₹{Number(product.price).toLocaleString("en-IN")}
                </p>
                {Number(product.discount_percentage) > 0 && (
                  <>
                    <p className="text-lg text-gray-400 line-through mb-1">
                      ₹{Number(product.original_price).toLocaleString("en-IN")}
                    </p>
                    <span className="bg-green-100 text-green-700 font-bold text-xs px-2.5 py-1 rounded tracking-wide mb-1.5 ml-2 border border-green-200">
                      SAVE {Math.round(Number(product.discount_percentage))}%
                    </span>
                  </>
                )}
              </div>

              {/* Description */}
              <div className="prose prose-sm text-gray-600 mb-8 max-w-none">
                <p className="whitespace-pre-line leading-relaxed">
                  {product.description}
                </p>
              </div>

              <div className="mt-auto space-y-8">

                {/* Color picker */}
                {availableColors.length > 0 && (
                  <div>
                    <h3 className="mb-3 font-bold text-gray-900 uppercase text-xs tracking-widest">
                      Color{" "}
                      <span className="text-gray-500 normal-case font-normal ml-2">
                        — {selectedColor?.name || "Please select"}
                      </span>
                    </h3>
                    <div className="flex gap-3 flex-wrap">
                      {availableColors.map((color: ProductColor) => {
                        const isColorDead = isColorOutOfStock(color);
                        const isSelected =
                          String(selectedColor?.id) === String(color.id);
                        return (
                          <button
                            key={color.id}
                            type="button"
                            disabled={isColorDead || isProductOutOfStock}
                            title={
                              isColorDead
                                ? `${color.name} (Out of Stock)`
                                : color.name
                            }
                            onClick={() => handleColorClick(color)}
                            className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center overflow-hidden transition-all ${
                              isSelected
                                ? "border-baba-primary ring-4 ring-baba-primary/20 scale-105"
                                : isColorDead || isProductOutOfStock
                                  ? "border-gray-200 cursor-not-allowed"
                                  : "border-gray-300 hover:border-gray-500 shadow-sm"
                            }`}
                            style={{ backgroundColor: color.color }}
                          >
                            {(isColorDead || isProductOutOfStock) && (
                              <>
                                <div className="absolute inset-0 bg-white/50" />
                                <div className="absolute w-[120%] h-[3px] bg-red-600 border border-white -rotate-45 z-10 shadow-sm" />
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size picker */}
                {hasSizes && selectedColor && (
                  <div>
                    <h3 className="mb-3 font-bold text-gray-900 uppercase text-xs tracking-widest">
                      Size
                    </h3>
                    {allVariantsForColor.length === 0 ? (
                      <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100 inline-block">
                        No sizes mapped for this color.
                      </p>
                    ) : (
                      <div className="flex gap-3 flex-wrap">
                        {allVariantsForColor.map((variant: ProductVariant) => {
                          const isVariantDead = Number(variant.stock) <= 0;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              disabled={isVariantDead || isProductOutOfStock}
                              onClick={() => setSelectedSize(variant.size)}
                              className={`min-w-[3.5rem] px-4 py-2 border rounded-lg font-bold text-sm transition-all ${
                                selectedSize === variant.size
                                  ? "border-baba-primary bg-baba-primary text-white shadow-md"
                                  : isVariantDead || isProductOutOfStock
                                    ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                                    : "border-gray-300 text-gray-700 hover:border-baba-primary hover:text-baba-primary hover:bg-gray-50"
                              }`}
                            >
                              <span
                                className={
                                  isVariantDead
                                    ? "line-through decoration-gray-400"
                                    : ""
                                }
                              >
                                {variant.size}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {showLowStockMessage && (
                      <p className="mt-3 inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 text-sm font-semibold">
                        Only {selectedVariantStock} left in stock
                      </p>
                    )}
                  </div>
                )}

                {/* Low stock — no-size products */}
                {!hasSizes &&
                  !!selectedColor &&
                  !isProductOutOfStock &&
                  selectedVariantStock > 0 &&
                  selectedVariantStock < 5 && (
                    <p className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 text-sm font-semibold">
                      Only {selectedVariantStock} left in stock
                    </p>
                  )}

                {/* Quantity */}
                {selectedVariant && selectedVariantStock > 0 && (
                  <div>
                    <h3 className="mb-3 font-bold text-gray-900 uppercase text-xs tracking-widest">
                      Quantity
                    </h3>
                    <div className="relative w-28">
                      <select
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        disabled={isOutOfStock}
                        className="w-full border border-gray-300 px-4 py-2.5 appearance-none rounded-lg focus:ring-1 focus:ring-baba-primary focus:border-baba-primary bg-white font-medium text-gray-900 outline-none"
                      >
                        {Array.from(
                          {
                            length: Math.min(
                              Number(selectedVariant.stock || 0),
                              10,
                            ),
                          },
                          (_, i) => i + 1,
                        ).map((num) => (
                          <option key={num} value={num}>
                            {num}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-500" />
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={
                      isOutOfStock || needsColorSelection || needsSizeSelection
                    }
                    className={`w-full sm:w-1/2 py-4 font-bold rounded-xl flex items-center justify-center gap-3 text-base tracking-wide transition-all border-2 ${
                      isOutOfStock || needsColorSelection || needsSizeSelection
                        ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-white text-baba-primary border-baba-primary hover:bg-baba-softbg shadow-sm"
                    }`}
                    type="button"
                  >
                    <ShoppingBag size={20} />
                    {isProductOutOfStock
                      ? "Out of Stock"
                      : needsColorSelection
                        ? "Select Colour"
                        : needsSizeSelection
                          ? "Select Size"
                          : selectedVariantStock <= 0
                            ? "Out of Stock"
                            : "Add to Cart"}
                  </button>

                  <button
                    onClick={handleBuyNow}
                    disabled={
                      isOutOfStock || needsColorSelection || needsSizeSelection
                    }
                    className={`w-full sm:w-1/2 py-4 font-bold rounded-xl flex items-center justify-center gap-2 text-base tracking-wide transition-all border-2 ${
                      isOutOfStock || needsColorSelection || needsSizeSelection
                        ? "bg-gray-100 text-gray-400 border-transparent cursor-not-allowed"
                        : "bg-baba-primary text-white border-baba-primary hover:bg-baba-accent hover:border-baba-accent hover:-translate-y-0.5 shadow-md shadow-baba-primary/20"
                    }`}
                    type="button"
                  >
                    <Zap
                      size={18}
                      className={
                        isOutOfStock || needsColorSelection || needsSizeSelection
                          ? ""
                          : "fill-current"
                      }
                    />
                    {isProductOutOfStock
                      ? "Out of Stock"
                      : needsColorSelection
                        ? "Select Colour"
                        : needsSizeSelection
                          ? "Select Size"
                          : "Buy Now"}
                  </button>
                </div>

                {!hasAnyInStockColor && !isProductOutOfStock && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100 inline-block">
                    No colours are currently in stock.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
