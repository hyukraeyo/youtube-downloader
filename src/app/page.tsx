'use client';

import React, { useState } from 'react';
import { useInvitationStore } from '@/store/useInvitationStore';
import DownloadCard from '@/components/DownloadCard';
import ResponsiveModal from '@/components/ResponsiveModal';
import { Play, Search, AlertCircle, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const {
    url,
    isLoading,
    isDownloading,
    error,
    progress,
    videoDetails,
    downloadCompleted,
    setUrl,
    fetchInfo,
    resetStore,
  } = useInvitationStore();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Automatically close download complete modal after showing visual feedback for 1.8s
  React.useEffect(() => {
    if (downloadCompleted && isModalOpen) {
      const timer = setTimeout(() => {
        setIsModalOpen(false);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [downloadCompleted, isModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    fetchInfo(url);
  };

  const handleDownloadStart = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between py-12 px-4 md:px-8 overflow-hidden bg-[#050505]">
      {/* 백그라운드 디자인 그라데이션 오버레이 */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />
      <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-yellow-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* 헤더 네비게이션 */}
      <header className="relative z-10 w-full max-w-[1920px] mx-auto flex items-center justify-between mb-16 px-2 md:px-4">
        <div className="flex items-center gap-2.5 group cursor-pointer" onClick={resetStore}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FBC02D] to-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-500/10 group-hover:scale-105 transition-transform duration-300">
            <Play className="w-5 h-5 text-black fill-black" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">
            YTDL<span className="text-[#FBC02D]">.premium</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm bg-neutral-900 border border-neutral-800 text-neutral-400 font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#FBC02D]" />
            v1.0 Ready
          </span>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col items-center justify-start w-full max-w-[1920px] mx-auto relative z-10 px-2 md:px-4">
        
        {/* 비디오 상세 정보가 없을 때의 검색 대시보드 */}
        <AnimatePresence mode="wait">
          {!videoDetails ? (
            <motion.div
              key="search-dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-3xl flex flex-col items-center text-center gap-8"
            >
              <div className="flex flex-col gap-3">
                <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-none">
                  유튜브 원본 비디오를 <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FBC02D] to-yellow-300">
                    한 번에 다운로드
                  </span>
                </h1>
                <p className="text-base md:text-lg text-neutral-400 max-w-lg mx-auto font-medium mt-1 leading-relaxed">
                  유튜브 영상 링크를 붙여넣으세요. 고화질 비디오 원본 파일과 MP3 고음질 오디오 트랙을 즉시 추출합니다.
                </p>
              </div>

              {/* 검색 및 분석 폼 */}
              <form onSubmit={handleSubmit} className="w-full relative">
                <div className="relative flex items-center bg-neutral-900/40 backdrop-blur-xl border border-neutral-800 rounded-3xl p-2.5 focus-within:border-[#FBC02D] transition-all duration-300 shadow-2xl">
                  <div className="pl-4 text-neutral-500">
                    <Search className="w-5.5 h-5.5" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... 또는 단축 URL"
                    className="w-full bg-transparent border-none text-white text-base py-3 px-3 placeholder-neutral-500 focus:outline-none"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !url.trim()}
                    className="bg-[#FBC02D] hover:bg-yellow-500 text-black font-extrabold px-7 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-yellow-500/10 hover:shadow-yellow-500/20 active:scale-98 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      <>
                        분석하기
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* 안내 가이드 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
                {[
                  { title: '고화질 원본 다운로드', desc: '1080p 및 720p MP4 지원' },
                  { title: 'MP3 오디오 음원', desc: '비디오 없이 고음질 음악만 추출' },
                  { title: '속도 제한 없음', desc: '가장 강력하고 빠른 다운로드 환경' },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-2xl bg-neutral-900/30 border border-neutral-800/60 text-left hover:border-neutral-800 transition-colors"
                  >
                    <h3 className="text-sm font-bold text-white mb-1.5">{item.title}</h3>
                    <p className="text-sm text-neutral-400 leading-normal">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            /* 비디오 파싱이 완료되었을 때의 결과 카드 */
            <motion.div
              key="result-dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full flex flex-col items-center gap-6"
            >
              <div className="w-full max-w-[1920px] mx-auto flex items-center justify-start">
                <button
                  onClick={resetStore}
                  className="text-sm text-neutral-400 hover:text-white font-bold flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900/50 border border-neutral-800 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  새 링크 입력하기
                </button>
              </div>

              <DownloadCard onDownloadStart={handleDownloadStart} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 에러 피드백 알림 */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 w-full max-w-xl bg-red-950/20 border border-red-500/30 rounded-2xl p-4.5 flex gap-3.5 items-start shadow-lg"
            >
              <AlertCircle className="w-5.5 h-5.5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-sm font-bold text-red-200">에러 발생</span>
                <span className="text-sm text-red-300/80 leading-relaxed">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 다운로드 진행률 팝업 모달 */}
      <ResponsiveModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isDownloading) setIsModalOpen(false);
        }}
        title={downloadCompleted ? '다운로드 완료' : '비디오 스트림 추출 중'}
      >
        <div className="flex flex-col items-center text-center gap-6 py-4">
          {!downloadCompleted ? (
            <>
              {/* 로딩 스피너 및 다운로드 기어 아이콘 */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-neutral-800 rounded-full" />
                <motion.div
                  className="absolute inset-0 border-4 border-[#FBC02D] border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <span className="text-lg font-black text-white">{progress}%</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <h4 className="text-base font-bold text-white">서버에서 영상을 파싱하고 있습니다...</h4>
                <p className="text-sm text-neutral-400 leading-normal max-w-xs mx-auto">
                  이 작업은 유튜브 원본 파일 크기와 해상도에 따라 몇 초에서 최대 몇 분이 소요될 수 있습니다. 창을 닫지 마세요.
                </p>
              </div>

              {/* 실시간 프로그레스 바 */}
              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                <motion.div
                  className="bg-[#FBC02D] h-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </>
          ) : (
            <>
              {/* 완료 상태 아이콘 */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-16 h-16 rounded-full bg-[#FBC02D]/10 flex items-center justify-center"
              >
                <Sparkles className="w-8 h-8 text-[#FBC02D]" />
              </motion.div>

              <div className="flex flex-col gap-1.5">
                <h4 className="text-lg font-bold text-white">다운로드가 준비되었습니다!</h4>
                <p className="text-sm text-neutral-400 leading-normal max-w-xs mx-auto">
                  브라우저의 기본 파일 다운로더가 트리거되었습니다. 혹시 자동으로 저장되지 않는다면 다운로드 기록을 확인해 주세요.
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors duration-200"
              >
                확인
              </button>
            </>
          )}
        </div>
      </ResponsiveModal>

      {/* 푸터 영역 */}
      <footer className="relative z-10 w-full max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between border-t border-neutral-900/60 pt-8 mt-12 text-sm text-neutral-500 px-2 md:px-4">
        <p>© 2026 YTDL Premium. All rights reserved.</p>
        <p className="mt-2 md:mt-0 leading-normal text-center md:text-right">
          본 웹 서비스는 교육적 목적 및 개인 소장 동영상 다운로드용으로만 구현되었으며,<br />
          저작권자의 허가 없이 무단 상업적 재배포를 금지합니다.
        </p>
      </footer>
    </div>
  );
}
