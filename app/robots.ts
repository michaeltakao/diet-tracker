import { MetadataRoute } from 'next';

const SITE_URL = 'https://diet-tracker-two-blue.vercel.app';

// Every route except /login requires auth or the guest-mode cookie (see
// proxy.ts) — a crawler with no cookies gets redirected to /login anyway, so
// only /login is worth pointing crawlers at explicitly. /api, /auth, and
// /research (researcher-only data-export tooling) are disallowed outright:
// no public content, and /research handles study-participant data.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login'],
      disallow: ['/api/', '/auth/', '/research/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
