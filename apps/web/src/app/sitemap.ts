import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { LANDINGS } from "@/tools/landing";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly") =>
    ({ url: `${SITE_URL}${path}`, changeFrequency, priority });
  return [
    page("/", 1, "weekly"),
    page("/tools", 0.9, "weekly"),
    page("/tools/subtitles", 0.9, "weekly"),
    page("/tools/editor", 0.8, "weekly"),
    ...LANDINGS.map(l => page(`/tools/subtitles/${l.slug}`, 0.7)),
    page("/pricing", 0.6),
    page("/about", 0.5),
    page("/signup", 0.5),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
    page("/refund", 0.2, "yearly"),
  ];
}
