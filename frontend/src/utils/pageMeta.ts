import { useEffect } from "react";

// Per-page <title>, description, canonical URL and social preview tags.
// Google renders the app, so it sees these; link previews (WhatsApp,
// Instagram) read only index.html, which carries the site-wide defaults.

const ORIGIN = "https://babatextiles.com";
const SITE_NAME = "Baba Textiles";
export const DEFAULT_TITLE = "Baba Textiles – Budget-Friendly Ethnic Wear, Srikakulam";
export const DEFAULT_DESCRIPTION =
  "Shop sarees, 3-piece sets, cord sets, feeding wear, nighties and more from Baba Textiles, Srikakulam. Affordable prices, shipping all over India.";
const DEFAULT_IMAGE = `${ORIGIN}/og-image.jpg`;

type PageMeta = {
  title?: string;          // page name; " | Baba Textiles" is appended
  description?: string;
  path?: string;           // canonical path; defaults to the current path
  image?: string | null;   // absolute URL for social previews
  noindex?: boolean;       // private pages: cart, checkout, account...
};

function setTag(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

export function usePageMeta({ title, description, path, image, noindex }: PageMeta) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const desc = (description || DEFAULT_DESCRIPTION).replace(/\s+/g, " ").trim().slice(0, 160);
    const url = ORIGIN + (path ?? window.location.pathname);
    const img = image || DEFAULT_IMAGE;

    document.title = fullTitle;
    setTag("name", "description", desc);
    setTag("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    setTag("property", "og:title", fullTitle);
    setTag("property", "og:description", desc);
    setTag("property", "og:url", url);
    setTag("property", "og:image", img);
    setTag("name", "twitter:title", fullTitle);
    setTag("name", "twitter:description", desc);
    setTag("name", "twitter:image", img);
    setCanonical(url);
  }, [title, description, path, image, noindex]);
}
