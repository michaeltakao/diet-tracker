import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import PwaRegister from '@/components/PwaRegister';
import PwaInstallBanner from '@/components/PwaInstallBanner';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',           // for iPhone notch / Dynamic Island
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#22c55e' },
    { media: '(prefers-color-scheme: dark)',  color: '#16a34a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-[var(--background)] min-h-screen`}>
        <ProfileProvider>
          <LanguageProvider>
            {children}
            <PwaInstallBanner />
          </LanguageProvider>
        </ProfileProvider>
        {/* SW registration — runs outside LanguageProvider to avoid re-renders */}
        <PwaRegister />
      </body>
    </html>
  );
}
