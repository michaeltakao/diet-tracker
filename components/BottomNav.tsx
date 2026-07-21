'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, PlusCircle, Dumbbell, Scale, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { href: '/',        label: t.navHome,    icon: Home },
    { href: '/log',     label: t.navLog,     icon: BookOpen },
    { href: '/add',     label: t.navAdd,     icon: PlusCircle },
    { href: '/workout', label: t.navWorkout, icon: Dumbbell },
    { href: '/plan',    label: t.navPlan,    icon: CalendarDays },
    { href: '/weight',  label: t.navWeight,  icon: Scale },
  ];

  return (
    <nav
      aria-label="メインナビゲーション"
      className="
        lg:hidden
        fixed bottom-0 left-0 right-0 z-50
        bg-card/90
        backdrop-blur-md
        border-t border-line
        shadow-[0_-4px_24px_rgb(0,0,0,0.06)]
      "
    >
      <div className="max-w-md mx-auto flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          const isAdd = href === '/add';

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
              <div className={`
                relative transition-all duration-200
                ${isActive && !isAdd ? 'scale-110' : ''}
              `}>
                {isAdd ? (
                  <div className="
                    w-10 h-10 -mt-5 mb-0.5
                    bg-gradient-to-br from-brand-500 to-brand-600
                    rounded-full shadow-[0_4px_14px_rgba(88,204,2,0.5)]
                    flex items-center justify-center
                    hover:scale-105 active:scale-95
                    transition-all duration-200
                  ">
                    <Icon size={22} className="text-white" strokeWidth={2.5} aria-hidden="true" />
                  </div>
                ) : (
                  <Icon
                    size={22}
                    className={isActive ? 'text-brand' : 'text-faint'}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    aria-hidden="true"
                  />
                )}
                {isActive && !isAdd && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full" />
                )}
              </div>
              <span className={`text-[10px] font-semibold ${isAdd ? 'mt-0.5' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
