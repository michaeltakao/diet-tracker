'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Plus, Dumbbell, Scale } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Mobile navigation: 4 tabs (ADR-011) + the add-meal FAB.
 *
 * The FAB lives here (not on the dashboard) so logging a meal is one tap
 * from every tabbed page; it is hidden on /add itself.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { href: '/dashboard', label: t.navHome,    icon: Home },
    { href: '/log',       label: t.navLog,     icon: BookOpen },
    { href: '/workout',   label: t.navWorkout, icon: Dumbbell },
    { href: '/weight',    label: t.navWeight,  icon: Scale },
  ];

  return (
    <>
      {pathname !== '/add' && (
        <Link
          href="/add"
          className="
            lg:hidden
            fixed bottom-20 right-4 z-40 mb-safe
            w-14 h-14 rounded-full
            bg-gradient-to-br from-brand-500 to-brand-600
            shadow-[0_8px_24px_rgba(88,204,2,0.5)]
            flex items-center justify-center text-white
            hover:scale-110 active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
            transition-all duration-200
          "
          aria-label={t.addMeal}
        >
          <Plus size={28} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      )}

      <nav
        aria-label={t.navMainAria}
        className="
          lg:hidden
          fixed bottom-0 left-0 right-0 z-50 pb-safe
          bg-card/90
          backdrop-blur-md
          border-t border-line
          shadow-[0_-4px_24px_rgb(0,0,0,0.06)]
        "
      >
        <div className="max-w-md mx-auto flex">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2
                  rounded-xl transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                  ${isActive ? 'text-brand' : 'text-faint hover:text-muted'}
                `}
              >
                <div className={`relative transition-all duration-200 ${isActive ? 'scale-110' : ''}`}>
                  <Icon
                    size={22}
                    className={isActive ? 'text-brand' : 'text-faint'}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    aria-hidden="true"
                  />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full" />
                  )}
                </div>
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
