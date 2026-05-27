'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, PlusCircle, Dumbbell } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { href: '/', label: t.navHome, icon: Home },
    { href: '/log', label: t.navLog, icon: BookOpen },
    { href: '/add', label: t.navAdd, icon: PlusCircle },
    { href: '/workout', label: t.navWorkout, icon: Dumbbell },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="max-w-md mx-auto flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                isActive ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon
                size={22}
                className={isActive ? 'text-green-500' : 'text-gray-400'}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
