'use client';

import React, { useState, useEffect } from 'react';
import { useInvitationStore } from '@/store/useInvitationStore';
import { 
  Sparkles, 
  Key, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  Download, 
  Video, 
  AlertCircle, 
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  X,
  Link,
  CornerRightDown,
  Layers,
  Heart,
  Flame,
  Laugh,
  Zap,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 유튜브 URL에서 비디오 ID를 추출하는 헬퍼
function extractVideoId(url: string): string {
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : '';
}

export default function ShortsAnalyzerCard({ onDownloadStart }: { onDownloadStart: (meta?: { quality: string; hasVideo: boolean; hasAudio: boolean; isTrim: boolean }) => void }) {
  const {
    videoDetails,
    formats,
    isAnalyzingShorts,
    shortsRecommendations,
    analyzeError,
    analyzeShorts,
    startDownload,
    apiKey,
    setApiKey,
    showApiKeySetting,
    setShowApiKeySetting
  } = useInvitationStore();

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  
  // 짜집기 재생 세그먼트 전용 상태
  const [activeStitchSeg, setActiveStitchSeg] = useState<number>(0);

  // 로컬 스토리지에서 저장된 API Key 불러오기
  useEffect(() => {
    if (!videoDetails) return;
    const savedKey = localStorage.getItem('ytdl_gemini_api_key');
    if (savedKey) {
      const timer = setTimeout(() => {
        setApiKey(savedKey);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [videoDetails]);

  // 짜집기 쇼츠 재생 시 세그먼트 자동 전환용 고속 스마트 타이머
  useEffect(() => {
    if (!videoDetails || previewIndex === null || !shortsRecommendations) return;
    const rec = shortsRecommendations[previewIndex];
    if (rec.type !== 'stitch' || !rec.segments || rec.segments.length === 0) return;

    const currentSeg = rec.segments[activeStitchSeg];
    if (!currentSeg) return;

    const duration = currentSeg.endTime - currentSeg.startTime;
    console.log(`[Stitch Player] 세그먼트 ${activeStitchSeg} 재생 시작. ${duration}초 동안 대기...`);

    const timer = setTimeout(() => {
      const nextIndex = activeStitchSeg + 1;
      if (nextIndex < rec.segments!.length) {
        console.log(`[Stitch Player] 다음 세그먼트 ${nextIndex}로 자동 워프!`);
        setActiveStitchSeg(nextIndex);
      } else {
        console.log(`[Stitch Player] 짜집기 재생 루프가 끝나 처음으로 루프백합니다.`);
        setActiveStitchSeg(0);
      }
    }, duration * 1000);

    return () => clearTimeout(timer);
  }, [previewIndex, activeStitchSeg, shortsRecommendations, videoDetails]);

  if (!videoDetails) return null;

  // 분석 시작 함수
  const handleStartAnalysis = (force = false) => {
    if (!videoDetails || isAnalyzingShorts) return;
    const savedKey = localStorage.getItem('ytdl_gemini_api_key') || '';
    analyzeShorts(videoDetails.url, savedKey, videoDetails.lengthSeconds, force);
  };

  // 인라인 프리뷰 토글
  const handleTogglePreview = (index: number) => {
    if (previewIndex === index) {
      setPreviewIndex(null);
      setActiveStitchSeg(0);
    } else {
      setPreviewIndex(index);
      setActiveStitchSeg(0);
    }
  };

  // 일반 추천 쇼츠 다운로드 실행
  const handleDownloadShortsSegment = async (formattedStart: string, duration: number) => {
    if (!videoDetails || formats.length === 0) return;
 
    const bestFormat = formats.find(f => f.hasVideo && !f.hasAudio) || 
                       formats.find(f => f.hasVideo) || 
                       formats[0];
 
    if (!bestFormat) return;
 
    onDownloadStart({
      quality: bestFormat.quality,
      hasVideo: bestFormat.hasVideo,
      hasAudio: bestFormat.hasAudio,
      isTrim: true
    });
 
    await startDownload(bestFormat.itag, `${bestFormat.quality} (AI Shorts Cut)`, {
      startTime: formattedStart,
      duration: duration
    });
  };

  // 짜집기 쇼츠 병합 다운로드 실행
  const handleDownloadStitchShorts = async (rec: any) => {
    if (!videoDetails || formats.length === 0 || !rec.segments) return;

    const bestFormat = formats.find(f => f.hasVideo && !f.hasAudio) || 
                       formats.find(f => f.hasVideo) || 
                       formats[0];

    if (!bestFormat) return;

    onDownloadStart({
      quality: bestFormat.quality,
      hasVideo: bestFormat.hasVideo,
      hasAudio: bestFormat.hasAudio,
      isTrim: true
    });

    const formattedSegments = rec.segments.map((seg: any) => ({
      startTime: seg.formattedStart,
      duration: seg.endTime - seg.startTime
    }));

    await startDownload(bestFormat.itag, `${bestFormat.quality} (AI Shorts Stitch)`, {
      isStitch: true,
      segments: formattedSegments
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto mt-8 bg-card border border-card-border rounded-[32px] p-6 md:p-8 shadow-premium relative overflow-hidden text-left">
      {/* 장식용 네온 백그라운드 스팟 */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />



      {/* 메인 분석 동작 영역 */}
      <div className="flex flex-col items-center justify-center min-h-[160px] py-2 relative z-10">
        <AnimatePresence mode="wait">
          
          {/* 상태 1: 로딩 단계 */}
          {isAnalyzingShorts && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col items-center text-center gap-4 py-6"
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 border-3 border-card-border rounded-full" />
                <motion.div
                  className="absolute inset-0 border-3 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-base font-black text-foreground">AI 하이라이트 분석 중</h4>
                <p className="text-xs text-text-muted max-w-md leading-relaxed animate-pulse font-bold">
                  영상의 전체 구조와 시청 유입이 높은 하이라이트 구간을 탐색하고 있습니다.
                </p>
              </div>
            </motion.div>
          )}

          {/* 상태 2: 추천 결과 목록 전시 (시안 2 세로형 4열 쇼츠 리디자인) */}
          {!isAnalyzingShorts && shortsRecommendations && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col gap-6"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-base text-primary font-black flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  AI 추천 하이라이트 클립
                </span>
                <button
                  onClick={() => handleStartAnalysis(true)}
                  disabled={isAnalyzingShorts}
                  className="text-xs text-text-muted hover:text-foreground font-black bg-accent border border-card-border px-4 py-2.5 rounded-xl cursor-pointer hover:border-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin animate-duration-3000" />
                  재분석
                </button>
              </div>


              {/* 📊 시안 2: 세로형 4열 쇼츠 카드 그리드 적용 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {shortsRecommendations.map((rec, index) => {
                  const isActive = previewIndex === index;
                  const isStitch = rec.type === 'stitch';

                  // 소요 시간 합산
                  let totalDuration = 0;
                  if (isStitch && rec.segments) {
                    totalDuration = rec.segments.reduce((acc, cur) => acc + (cur.endTime - cur.startTime), 0);
                  } else {
                    totalDuration = (rec.endTime || 0) - (rec.startTime || 0);
                  }

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleTogglePreview(index)}
                      className={`group p-5 rounded-[28px] bg-card border transition-all duration-300 flex flex-col justify-between gap-5 hover:shadow-premium cursor-pointer ${
                        isActive 
                          ? 'border-primary shadow-premium shadow-primary/5 bg-accent/[0.02]' 
                          : 'border-card-border hover:border-primary/45'
                      }`}
                    >
                      {/* 상세 분석 내용 및 텍스트 영역 */}
                      <div className="flex flex-col gap-3 px-1 text-left">
                        {/* 1. 재생 시간/타입 배지 통합 정렬 */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[9px] font-black text-text-muted bg-accent border border-card-border px-2.5 py-1 rounded-lg">
                            {isStitch ? '교차 편집' : '단일 하이라이트'} • {totalDuration}초
                          </span>
                        </div>

                        {/* 2. 쇼츠 제목 */}
                        <h3 className="text-sm font-black leading-snug tracking-tight text-foreground line-clamp-2 min-h-[40px] group-hover:text-primary transition-colors">
                          {rec.title}
                        </h3>

                        {/* 3. 분석 근거 */}
                        <p className="text-[11px] text-text-muted leading-relaxed font-bold line-clamp-2">
                          {rec.hook}
                        </p>

                        {/* 4. 시간대 정보 */}
                        <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-bold mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-primary animate-pulse" />
                          <span>
                            {isStitch 
                              ? `세그먼트 ${rec.segments?.length}개` 
                              : `${rec.formattedStart} - ${rec.formattedEnd}`}
                          </span>
                        </div>
                      </div>

                      {/* 슬림 슬릭 액션 버튼 (시안 2 파란색 Download 버튼 매칭) */}
                      <div className="mt-1 px-0.5" onClick={(e) => e.stopPropagation()}>
                        {isStitch ? (
                          <button
                            onClick={() => handleDownloadStitchShorts(rec)}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-black py-2.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
                          >
                            <Download className="w-3.5 h-3.5" />
                            교차 편집 클립 저장
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDownloadShortsSegment(rec.formattedStart || '00:00', totalDuration)}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-black py-2.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
                          >
                            <Download className="w-3.5 h-3.5" />
                            클립 소장하기
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

            </motion.div>
          )}

          {/* 상태 3: 대기 화면 (분석 전) */}
          {!isAnalyzingShorts && !shortsRecommendations && !analyzeError && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center gap-5 py-4"
            >
              <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                <Sparkles className="w-7 h-7 text-primary animate-pulse" />
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="text-base font-black text-foreground">AI 쇼츠 분석</h3>
                <p className="text-xs text-text-muted leading-normal font-bold">
                  영상의 댓글 반응과 흐름을 인공지능이 분석하여 흥행 가능성이 높은 최적의 숏폼 구간을 자동으로 추출합니다.
                </p>
              </div>
              <button
                onClick={() => handleStartAnalysis(false)}
                disabled={isAnalyzingShorts}
                className="mt-1 bg-primary hover:bg-primary-hover text-white font-black px-8 py-3.5 rounded-2xl flex items-center gap-2 shadow-lg shadow-primary/10 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Video className="w-4 h-4 fill-white" />
                AI 쇼츠 분석 시작하기
              </button>
            </motion.div>
          )}

          {/* 상태 4: 에러 피드백 */}
          {!isAnalyzingShorts && analyzeError && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-xl bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex gap-3.5 items-start"
            >
              <AlertCircle className="w-5.5 h-5.5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col gap-2.5 text-left">
                <div>
                  <span className="text-sm font-black text-red-700 dark:text-red-200 block">AI 쇼츠 분석 오류</span>
                  <span className="text-xs text-red-600 dark:text-red-300 leading-relaxed mt-0.5 block">{analyzeError}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartAnalysis(true)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors shadow-sm"
                  >
                    다시 시도하기
                  </button>
                  {!apiKey && (
                    <button
                      onClick={() => setShowApiKeySetting(true)}
                      className="bg-card hover:bg-accent border border-card-border text-foreground font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors shadow-sm"
                    >
                      API Key 설정 열기
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* 🎬 부드럽고 모던한 AI 추천 쇼츠 미리보기 팝업 모달 */}
      <AnimatePresence>
        {previewIndex !== null && shortsRecommendations && shortsRecommendations[previewIndex] && videoDetails && (() => {
          const rec = shortsRecommendations[previewIndex];
          const videoId = extractVideoId(videoDetails.url);
          if (!videoId) return null;

          let embedSrc = '';
          let currentLabel = '';
          let currentTimes = '';

          // 짜집기 재생인 경우 동적으로 세그먼트 인덱스에 매칭
          if (rec.type === 'stitch' && rec.segments && rec.segments.length > 0) {
            const seg = rec.segments[activeStitchSeg] || rec.segments[0];
            embedSrc = `https://www.youtube.com/embed/${videoId}?start=${seg.startTime}&end=${seg.endTime}&autoplay=1&rel=0&modestbranding=1`;
            currentLabel = `[교차 편집 구간 ${activeStitchSeg + 1}] ${seg.label}`;
            currentTimes = `${seg.formattedStart} - ${seg.formattedEnd} (${seg.endTime - seg.startTime}초)`;
          } else {
            embedSrc = `https://www.youtube.com/embed/${videoId}?start=${rec.startTime}&end=${rec.endTime}&autoplay=1&rel=0&modestbranding=1`;
            currentLabel = `단일 명장면 추천`;
            currentTimes = `${rec.formattedStart} - ${rec.formattedEnd} (${(rec.endTime || 0) - (rec.startTime || 0)}초)`;
          }

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* 뒷배경 글래스모피즘 어두운 오버레이 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setPreviewIndex(null);
                  setActiveStitchSeg(0);
                }}
                className="absolute inset-0 bg-black/75 backdrop-blur-md"
              />

              {/* 모달 윈도우 박스 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                className="relative w-full max-w-4xl bg-card border border-card-border rounded-[32px] overflow-hidden shadow-premium z-10 flex flex-col"
              >
                {/* 모달 헤더 바 */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 bg-accent border-b border-card-border gap-3 text-left">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <Play className="w-4 h-4 text-primary fill-primary animate-pulse" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-foreground flex items-center gap-2">
                        쇼츠 #{previewIndex + 1} 미리보기:
                        <span className="text-primary font-black">{currentLabel}</span>
                      </span>
                      <span className="text-[10px] text-text-muted font-bold block mt-0.5">
                        {currentTimes}
                      </span>
                    </div>
                  </div>

                  {/* 교차 편집(Stitch) 구간 정보 인디케이터 */}
                  {rec.type === 'stitch' && rec.segments && (
                    <div className="flex items-center gap-2 bg-card border border-card-border px-3.5 py-2 rounded-xl" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] font-black text-text-muted tracking-wider uppercase">재생 구간:</span>
                      {rec.segments.map((_, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => setActiveStitchSeg(sIdx)}
                          className={`w-5 h-5 rounded-md text-[9px] font-black transition-all duration-300 flex items-center justify-center cursor-pointer ${
                            activeStitchSeg === sIdx
                              ? 'bg-primary text-white scale-110 shadow-md shadow-primary/30'
                              : 'bg-card border border-card-border text-text-muted hover:text-foreground'
                          }`}
                          title={`${sIdx + 1}번 구간으로 이동`}
                        >
                          {sIdx + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 닫기 버튼 */}
                  <button
                    onClick={() => {
                      setPreviewIndex(null);
                      setActiveStitchSeg(0);
                    }}
                    className="text-text-muted hover:text-foreground transition-colors cursor-pointer p-2 rounded-xl hover:bg-card-border shrink-0 self-end sm:self-auto"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 유튜브 비디오 플레이어 본체 (16:9 비율) */}
                <div className="bg-black p-3 md:p-6 flex justify-center">
                  <div className="w-full aspect-video relative rounded-2xl overflow-hidden border border-card-border shadow-inner">
                    <iframe
                      src={embedSrc}
                      title={rec.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
