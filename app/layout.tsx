import type { Metadata, Viewport } from 'next';
import { Nunito, M_PLUS_Rounded_1c } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import PwaRegister from '@/components/PwaRegister';
import TextScaleInit from '@/components/TextScaleInit';
import PwaInstallBanner from '@/components/PwaInstallBanner';
import SideNav from '@/components/SideNav';
import CalorieContextBar from '@/components/CalorieContextBar';

// Duolingo-style rounded type (design phase 2). Nunito is a variable font:
// loading the variable axis covers every weight 400–900 in one file
// (next/font docs-recommended over enumerating static weights). Latin only —
// Japanese text falls back to the rounded JP system fonts in --font-sans.
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

// Rounded JP webfont fallback (design phase 4) so non-macOS devices keep the
// soft look for Japanese. Static font → weights must be enumerated. JP glyphs
// ship as unicode-range chunks (browsers fetch only used ranges); preload off
// since it sits behind Nunito for Latin.
const mplusRounded = M_PLUS_Rounded_1c({
  weight: ['400', '700', '800'],
  subsets: ['latin'],
  preload: false,
  variable: '--font-mplus-rounded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Diet Tracker',
    template: '%s | Diet Tracker',
  },
  description: 'PFC・カロリー・体重・水分・ワークアウトを記録。Gemini AIが習慣を分析してコーチング。',
  applicationName: 'Diet Tracker',
  keywords: ['diet', 'calorie', 'PFC', 'workout', 'weight loss', 'nutrition', 'ダイエット'],
  authors: [{ name: 'Diet Tracker' }],
  creator: 'Diet Tracker',
  // PWA — open-graph
  openGraph: {
    type: 'website',
    siteName: 'Diet Tracker',
    title: 'Diet Tracker — PFC & Calorie Log',
    description: 'Track your daily PFC macros with AI coaching',
  },
  // PWA — mobile web app
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Diet Tracker',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-zoom (WCAG 1.4.4): do NOT set maximumScale/userScalable.
  viewportFit: 'cover',           // for iPhone notch / Dynamic Island
  themeColor: [
    // Phase-1 palette: feather green / dark night surface
    { media: '(prefers-color-scheme: light)', color: '#58cc02' },
    { media: '(prefers-color-scheme: dark)',  color: '#131f24' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${nunito.variable} ${mplusRounded.variable}`}>
      <body className="bg-[var(--background)] min-h-screen">
        <ProfileProvider>
          <LanguageProvider>
            {/* Desktop sidebar — hidden on mobile */}
            <aside
              aria-label="メインナビゲーション"
              className="
                hidden lg:flex flex-col
                fixed top-0 left-0 h-full w-56 z-40
                bg-card/90
                backdrop-blur-md
                border-r border-line
                shadow-[1px_0_20px_rgb(0,0,0,0.03)]
              "
            >
              <SideNav />
            </aside>

            {/* Main content — offset by sidebar width on desktop */}
            <div className="lg:ml-56">
              <CalorieContextBar />
              {children}
              <PwaInstallBanner />
            </div>
          </LanguageProvider>
        </ProfileProvider>
        <PwaRegister />
        <TextScaleInit />
      </body>
    </html>
  );
}
