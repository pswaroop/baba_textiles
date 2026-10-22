// srcset builders. The server stores each image in a few widths (see
// PRODUCT_*/CATEGORY_*/HERO_* in backend/products/models.py); listing them
// with their real widths lets the browser download the smallest one that is
// still sharp at the size it is displayed.

type Sized = [url: string | null | undefined, width: number];

function buildSrcSet(entries: Sized[]): string | undefined {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const [url, width] of entries) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    parts.push(`${url} ${width}w`);
  }
  // A single candidate gives the browser no choice; plain src is enough.
  return parts.length > 1 ? parts.join(", ") : undefined;
}

export type ProductImageSizes = {
  image?: string | null;
  thumbnail?: string | null;
  medium?: string | null;
  small?: string | null;
};

export const PRODUCT_WIDTHS = { small: 300, medium: 400, thumbnail: 600, image: 1000 } as const;

/** Every stored width: for cards, which range from ~150 to ~300 CSS px. */
export function productSrcSet(img?: ProductImageSizes | null): string | undefined {
  if (!img) return undefined;
  return buildSrcSet([
    [img.small, PRODUCT_WIDTHS.small],
    [img.medium, PRODUCT_WIDTHS.medium],
    [img.thumbnail, PRODUCT_WIDTHS.thumbnail],
    [img.image, PRODUCT_WIDTHS.image],
  ]);
}

/** Main product photo: shown wide, so the small copy is never useful. */
export function productLargeSrcSet(img?: ProductImageSizes | null): string | undefined {
  if (!img) return undefined;
  return buildSrcSet([
    [img.thumbnail, PRODUCT_WIDTHS.thumbnail],
    [img.image, PRODUCT_WIDTHS.image],
  ]);
}

/** Smallest stored copy, for tiny tiles (cart, checkout, gallery strip). */
export function smallestProductImage(img?: ProductImageSizes | null): string {
  return img?.small || img?.thumbnail || img?.image || "/placeholder.png";
}

export function heroSrcSet(image?: string | null, small?: string | null): string | undefined {
  return buildSrcSet([
    [small, 320],
    [image, 640],
  ]);
}

export function categorySrcSet(image?: string | null, small?: string | null): string | undefined {
  return buildSrcSet([
    [small, 240],
    [image, 450],
  ]);
}

/** Card widths: 2 columns on phones, up to 4 on desktop inside a 1280px container. */
export const CARD_SIZES = "(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 48vw";
