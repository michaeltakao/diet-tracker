import { MetadataRoute } from 'next';

const SITE_URL = 'https://diet-tracker-two-blue.vercel.app';

// Only / and /login are reachable without an authenticated or guest session
// (proxy.ts redirects everything else) — every other route is per-user data,
// not indexable public content, so the sitemap stays deliberately small.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
