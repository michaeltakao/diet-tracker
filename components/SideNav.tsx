'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, PlusCircle, Dumbbell, Scale, Settings, ScanLine, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SideNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; accent?: boolean }[] = [
    { href: '/',         label: t.navHome,    icon: Home },
    { href: '/log',      label: t.navLog,     icon: BookOpen },
    { href: '/add',      label: t.navAdd,     icon: PlusCircle,  accent: true },
    { href: '/workout',  label: t.navWorkout, icon: Dumbbell },
    { href: '/form',     label: 'フォーム',   icon: ScanLine },
    { href: '/plan',     label: 'プラン',     icon: CalendarDays },
    { href: '/weight',   label: t.navWeight,  icon: Scale },
    { href: '/settings', label: t.settings,   icon: Settings },
  ];

  return (
    <nav className="flex flex-col h-full px-3 py-6 overflow-y-auto">

      {/* Brand */}
      <div className="px-3 mb-8 select-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-black">D</span>
          </div>
          <span className="text-base font-black text-gray-900 dark:text-white tracking-tight">Diet Tracker</span>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 pl-9">AI-powered health log</p>
      </div>

      {/* Links */}
      <div className="flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, accent }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-semibold transition-all duration-200
                ${accent
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(34,197,94,0.35)] hover:shadow-[0_4px_18px_rgba(34,197,94,0.5)] hover:scale-[1.02]'
                  : isActive
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
            >
              <Icon
                size={17}
                strokeWidth={isActive || accent ? 2.5 : 1.5}
                className="shrink-0"
              />
              {label}
              {isActive && !accent && (
                <span className="ml-auto w-1.5 h-1.5 bg-green-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center">
          Diet Tracker
        </p>
      </div>
    </nav>
  );
}
