import { SITE_NAME, SITE_URL } from "./site";

/** schema.org SoftwareApplication for a free in-browser tool (rich results in search). */
export function ToolJsonLd({ name, path, description }: { name: string; path: string; description: string }) {
  const data = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: `${SITE_NAME} ${name}`, url: `${SITE_URL}${path}`, applicationCategory: "MultimediaApplication", operatingSystem: "Any (web browser)", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, description };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }} />;
}
