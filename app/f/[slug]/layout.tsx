import type { Metadata } from "next";

/**
 * Everything under /f/{slug} is a signed-in screen. The gate itself runs in
 * each page through requireFacility(), because a layout cannot hand its
 * loaded facility to the page and loading it twice is cheaper than a
 * context. What the layout does own is the robots rule: none of this has
 * any business in an index.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function FacilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
