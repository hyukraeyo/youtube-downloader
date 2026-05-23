'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function ResponsiveModal({
  isOpen,
  onClose,
  title,
  children,
}: ResponsiveModalProps) {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 배경 바디 스크롤 차단
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          {/* 백드롭 흐림 및 페이드 효과 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* 모달 본체 */}
          {isMobile ? (
            /* 모바일 바텀 시트 (Drawer) */
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-h-[85vh] overflow-y-auto bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-6 shadow-2xl flex flex-col z-10"
            >
              {/* 스와이프 인디케이터 바 */}
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-700" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full text-neutral-400 hover:text-white transition-colors duration-200"
                  aria-label="닫기"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{children}</div>
            </motion.div>
          ) : (
            /* 데스크톱 중앙 다이얼로그 (Dialog) */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors duration-200"
                  aria-label="닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div>{children}</div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
