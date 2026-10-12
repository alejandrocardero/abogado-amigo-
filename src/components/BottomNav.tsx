import React from 'react';
import { motion } from 'motion/react';
import { NavTab } from '../types';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const navItems: { id: NavTab; label: string; icon: string }[] = [
    { id: 'asistente', label: 'Asistente', icon: 'mark_chat_unread' },
    { id: 'gacetas', label: 'Gacetas', icon: 'newspaper' },
    { id: 'extractor', label: 'Agente PDF', icon: 'smart_toy' },
    { id: 'rag_indexer', label: 'RAG LangGraph', icon: 'account_tree' },
    { id: 'leyes', label: 'Leyes', icon: 'menu_book' },
  ];

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-[#f8f9ff]/92 backdrop-blur-xl shadow-[0_-4px_20px_rgba(11,28,48,0.06)] border-t border-outline-variant/25">
      <div className="flex items-center justify-between h-16 px-1.5 max-w-2xl mx-auto overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center flex-1 min-w-[56px] h-13 rounded-xl gap-0.5 cursor-pointer z-10 ${
                isActive
                  ? 'text-secondary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/60'
              }`}
              onClick={() => onSelectTab(item.id)}
              type="button"
            >
              {isActive && (
                <motion.span
                  layoutId="bottomNavActivePill"
                  className="absolute inset-x-1.5 inset-y-1 rounded-xl bg-secondary-fixed/55 border border-secondary/15 -z-10"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span
                className={`material-symbols-outlined text-[21px] ${
                  isActive ? 'fill-1 text-secondary' : ''
                }`}
              >
                {item.icon}
              </span>
              <span className="font-label-sm text-[10px] leading-tight text-center truncate max-w-[64px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
