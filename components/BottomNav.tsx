'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, PlusCircle, Dumbbell, Scale } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { href: '/',        label: t.navHome,    icon: Home },
    { href: '/log',     label: t.navLog,     icon: BookOpen },
    { href: '/add',     label: t.navAdd,     icon: PlusCircle },
    { href: '/workout', label: t.navWorkout, icon: Dumbbell },
    { href: '/weight',  label: t.navWeight,  icon: Scale },
  ];

  return (
    <nav className="
      fixed bottom-0 left-0 right-0 z-50
      bg-white/90 dark:bg-gray-900/90
      backdrop-blur-md
      border-t border-gray-100 dark:border-gray-800
      shadow-[0_-4px_24px_rgb(0,0,0,0.06)]
    ">
      <div className="max-w-md mx-auto flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          const isAdd = href === '/add';

          return (
            <Link
              key={href}
              href={href}
              className={`
                flex-1 flex flex-col items-center gap-0.5 py-3
                transition-all duration-200
                ${isActive ? 'text-green-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}
              `}
            >
              <div className={`
                relative transition-all duration-200
                ${isAdd ? 'p-0' : ''}
                ${isActive && !isAdd ? 'scale-110' : ''}
              `}>
                {isAdd ? (
                  <div className="
                    w-10 h-10 -mt-5 mb-0.5
                    bg-gradient-to-br from-green-500 to-emerald-600
                    rounded-full shadow-[0_4px_14px_rgba(34,197,94,0.5)]
                    flex items-center justify-center
                    hover:scale-105 active:scale-95
                    transition-all duration-200
                  ">
                    <Icon size={22} className="text-white" strokeWidth={2.5} />
                  </div>
                ) : (
                  <Icon
                    size={22}
                    className={isActive ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                )}
                {isActive && !isAdd && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full" />
                )}
              </div>
              <span className={`text-[9.5px] font-semibold ${isAdd ? 'mt-0.5' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
