'use client';

import React, { useState, useRef } from 'react';
import { useInvitationStore, VideoFormat } from '@/store/useInvitationStore';
import { 
  Download, 
  Film, 
  Music, 
  Clock, 
  Eye, 
  ShieldAlert, 
  Scissors, 
  AlertCircle, 
  Plus, 
  Minus,
  Sparkles,
  BarChart3,
  Flame,
  Tv,
  Smartphone,
  Video,
  Award,
  Key,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Time format converter (seconds -> hh:mm:ss)
function formatDuration(secondsStr: string): string {
  const seconds = parseInt(secondsStr, 10);
  if (isNaN(seconds)) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Convert seconds to 'HH:MM:SS' string
function secondsToTimeString(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// View count formatter
function formatViews(viewsStr: string): string {
  const views = parseInt(viewsStr, 10);
  if (isNaN(views)) return '0회';
  if (views >= 100000000) {
    return `${(views / 100000000).toFixed(1)}억회`;
  }
  if (views >= 10000) {
    return `${(views / 10000).toFixed(1)}만회`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}천회`;
  }
  return `${views}회`;
}

// Get 11-char YouTube video ID from URL
function getYoutubeVideoId(url: string): string {
  if (!url) return '';
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : '';
}

interface DownloadCardProps {
  onDownloadStart: (meta?: { quality: string; hasVideo: boolean; hasAudio: boolean; isTrim: boolean }) => void;
}

export default function DownloadCard({ onDownloadStart }: DownloadCardProps) {
  const { 
    videoDetails, 
    formats, 
    startDownload, 
    url, 
    analyzeShorts, 
    setShowShortsAnalyzer,
    apiKey,
    setApiKey,
    showApiKeySetting,
    setShowApiKeySetting
  } = useInvitationStore();

  // maxSeconds를 useState 초기값으로 사용하기 위해 먼저 계산
  const maxSeconds = videoDetails ? (parseInt(videoDetails.lengthSeconds, 10) || 0) : 0;

  // Trim local states
  const [isTrimEnabled, setIsTrimEnabled] = useState<boolean>(false); // 기본 비활성화 (오프)
  const [startSec, setStartSec] = useState<number>(0); // 시작점은 직관적으로 00:00(0초)으로 고정
  const [endSec, setEndSec] = useState<number>(() => Math.min(45, maxSeconds)); // 기본 추천 쇼츠 길이인 45초로 설정 (영상이 짧을 시 영상 전체 길이)
  const [trimError, setTrimError] = useState<string | null>(null);

  // 시작 시간 1초/10초 단위 정밀 조정 헬퍼 함수 (최소 3초 구간 확보 제약)
  const adjustStart = (amount: number) => {
    setStartSec((prev) => {
      const next = Math.max(0, Math.min(prev + amount, endSec - 3));
      seekYoutubePlayer(next);
      return next;
    });
    setTrimError(null);
  };

  // 종료 시간 1초/10초 단위 정밀 조정 헬퍼 함수 (전체 길이 한계 제약)
  const adjustEnd = (amount: number) => {
    setEndSec((prev) => {
      const next = Math.max(startSec + 3, Math.min(prev + amount, maxSeconds));
      seekYoutubePlayer(next);
      return next;
    });
    setTrimError(null);
  };

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 유튜브 API 연동을 통해 실시간 재생 상태 추적 및 종료 시각 제어
  React.useEffect(() => {
    const videoId = getYoutubeVideoId(url) || getYoutubeVideoId(videoDetails?.url || '');
    if (!videoId) return;

    const initPlayer = () => {
      if (!(window as any).YT || !(window as any).YT.Player) return;
      try {
        playerRef.current = new (window as any).YT.Player('yt-player-iframe', {
          events: {
            'onStateChange': (event: any) => {
              // event.data === 1 이면 재생 중 (PLAYING)
              if (event.data === 1) {
                startTimeMonitor();
              } else {
                stopTimeMonitor();
              }
            }
          }
        });
      } catch (e) {
        console.error('Failed to bind YouTube iframe Player:', e);
      }
    };

    // YouTube Iframe API 스크립트 동적 로드
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      // 이미 스크립트가 있다면 0.5초 대기 후 안전하게 바인딩
      const timer = setTimeout(() => {
        initPlayer();
      }, 500);
      return () => clearTimeout(timer);
    }

    return () => {
      stopTimeMonitor();
    };
  }, [url, videoDetails?.url]);

  // 실시간 재생 위치 감시 및 종료 시간(endSec) 정지 제어
  const startTimeMonitor = () => {
    stopTimeMonitor();
    monitorIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime();
        
        // 구간 자르기 스위치가 켜져 있고, 재생 시간이 설정된 종료 시각(endSec)에 다다르면 정지
        if (isTrimEnabled && currentTime >= endSec) {
          try {
            playerRef.current.pauseVideo();
            playerRef.current.seekTo(endSec, true); // 정교한 종료 시각 정지 렌더링
          } catch (e) {
            console.error('Failed to auto-pause video:', e);
          }
        }
      }
    }, 200);
  };

  const stopTimeMonitor = () => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
  };

  // 컴포넌트 언마운트 시 타이머 누출 방지
  React.useEffect(() => {
    return () => {
      stopTimeMonitor();
    };
  }, []);

  // API Key 모달 저장 및 삭제 제어 로직
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ytdl_gemini_api_key', apiKey.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setShowApiKeySetting(false);
    }, 1200);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('ytdl_gemini_api_key');
    setApiKey('');
    setIsSaved(false);
  };

  // 로컬 스토리지에서 저장된 API Key 불러오기 (Zustand 전역 동기화)
  React.useEffect(() => {
    if (!videoDetails) return;
    const savedKey = localStorage.getItem('ytdl_gemini_api_key');
    if (savedKey && !apiKey) {
      setApiKey(savedKey);
    }
  }, [videoDetails, apiKey, setApiKey]);

  if (!videoDetails) return null;
  
  // Calculate duration
  const duration = Math.max(3, endSec - startSec);
  const startTime = secondsToTimeString(startSec);

  // Seamless seek to YouTube iframe
  const seekYoutubePlayer = (seconds: number) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'seekTo',
            args: [seconds, true],
          }),
          '*'
        );
      } catch (e) {
        console.error('Failed to seek player:', e);
      }
    }
  };

  // Trim parameter validation
  const validateTrim = (): boolean => {
    setTrimError(null);
    if (startSec < 0 || startSec >= maxSeconds) {
      setTrimError(`시작 시간은 0초부터 동영상 전체 길이 사이여야 합니다.`);
      return false;
    }
    if (duration < 3 || duration > 300) {
      setTrimError('구간 자르기 길이는 최소 3초에서 최대 300초(5분)까지만 지정 가능합니다.');
      return false;
    }
    if (endSec > maxSeconds) {
      setTrimError('종료 시간이 전체 동영상 길이를 초과할 수 없습니다.');
      return false;
    }
    return true;
  };

  const handleDownload = async (format: VideoFormat) => {
    if (isTrimEnabled) {
      if (!validateTrim()) return;
      onDownloadStart({
        quality: format.quality,
        hasVideo: format.hasVideo,
        hasAudio: format.hasAudio,
        isTrim: true
      });
      await startDownload(format.itag, format.quality, {
        startTime,
        duration,
      });
    } else {
      onDownloadStart({
        quality: format.quality,
        hasVideo: format.hasVideo,
        hasAudio: format.hasAudio,
        isTrim: false
      });
      await startDownload(format.itag, format.quality);
    }
  };

  // Generate AI Shorts 버튼 액션
  const handleGenerateAIShorts = () => {
    setShowShortsAnalyzer(true);
    const savedKey = localStorage.getItem('ytdl_gemini_api_key') || '';
    analyzeShorts(videoDetails.url, savedKey, videoDetails.lengthSeconds, false);
    // 페이지 아래의 분석 영역으로 부드럽게 스크롤
    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
    }, 200);
  };

  // Format filtering (EXCLUDE 360p)
  const videoFormats = formats.filter(f => f.hasVideo && f.quality !== '360p');
  const audioFormats = formats.filter(f => !f.hasVideo && f.hasAudio);

  const videoId = getYoutubeVideoId(url) || getYoutubeVideoId(videoDetails.url);
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&start=0&autoplay=0&rel=0&modestbranding=1`
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-[1920px] mx-auto flex flex-col lg:flex-row gap-8 relative z-10 items-start select-none px-2"
    >
      
      {/* ========================================================================= */}
      {/* 🎬 LEFT CARD PANEL: 비디오 플레이어 및 3종 핵심 지표 카드 (시안 1 스타일) */}
      {/* ========================================================================= */}
      <div className="flex-1 w-full flex flex-col gap-6 bg-card border border-card-border rounded-[32px] p-6 shadow-premium relative overflow-hidden">
        {/* 그라데이션 광체 */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        
        {/* 대형 플레이어 영역 */}
        <div className="relative group overflow-hidden rounded-2xl border border-card-border aspect-video shadow-premium bg-black w-full transition-all duration-300 relative z-10">
          {embedUrl ? (
            <iframe
              ref={iframeRef}
              id="yt-player-iframe"
              src={embedUrl}
              title={videoDetails.title}
              className="w-full h-full border-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-sm font-bold">
              유튜브 비디오를 임베드할 수 없습니다.
            </div>
          )}
        </div>

        {/* 비디오 뱃지 및 메타데이터 */}
        <div className="flex flex-col gap-3 p-1 relative z-10 text-left">


          {/* 제목 */}
          <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight leading-snug">
            {videoDetails.title}
          </h2>

          {/* 업로더 및 조회수 */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-3.5 text-xs text-text-muted font-bold pt-0.5">
            <span className="text-foreground font-black text-sm">{videoDetails.author}</span>
            <span className="w-1 h-1 rounded-full bg-card-border" />
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              {formatViews(videoDetails.viewCount)}
            </span>
            <span className="w-1 h-1 rounded-full bg-card-border" />
            <span className="flex items-center gap-1.5 text-primary">
              <Clock className="w-3.5 h-3.5" />
              전체: {formatDuration(videoDetails.lengthSeconds)}
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 📥 RIGHT PANEL: 편집 슬라이더 & 다운로드 리스트 (개별 카드 노출형) */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[480px] shrink-0 flex flex-col gap-6 relative z-10">

        {/* ✂️ Section A: Trim Video 조작부 카드 (시안 1) */}
        <div className="p-5 rounded-2xl bg-accent/40 border border-card-border flex flex-col gap-4.5 relative z-10 text-left">
          <div 
            onClick={() => {
              setIsTrimEnabled(!isTrimEnabled);
              setTrimError(null);
            }}
            className={`flex items-center justify-between cursor-pointer select-none group/trim-header ${
              isTrimEnabled ? 'border-b border-card-border pb-3' : ''
            }`}
          >
            <h3 className="text-base font-black text-foreground tracking-tight flex items-center gap-2 transition-colors duration-200 group-hover/trim-header:text-primary">
              <Scissors className="w-4 h-4 text-primary group-hover/trim-header:scale-110 transition-transform duration-200" />
              영상 구간 자르기
            </h3>
            
            {/* 스위치 온/오프 상태 단추 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsTrimEnabled(!isTrimEnabled);
                setTrimError(null);
              }}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 focus:outline-none ${
                isTrimEnabled ? 'bg-primary' : 'bg-card-border'
              }`}
            >
              <motion.div
                layout
                className="bg-white w-4 h-4 rounded-full shadow-md"
                animate={{ x: isTrimEnabled ? 16 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {isTrimEnabled && (
              <motion.div
                key="trim-panel-active"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden flex flex-col gap-4"
              >
                {/* 1. 슬라이더 정보 라벨 & 정밀 피팅(1초) 조절부 (시작/종료 시각적 카드형 분할 레이아웃) */}
                <div className="grid grid-cols-2 gap-4 border-b border-card-border/50 pb-4.5">
                  {/* 시작 조절 카드 (파란색 포인트 디자인) */}
                  <div className="flex flex-col gap-2.5 text-left p-3.5 rounded-2xl border border-primary/20 bg-primary/5 relative overflow-hidden transition-all duration-300 hover:border-primary/30 shrink-0">
                    <span className="text-[10px] uppercase font-black tracking-wider text-primary/80">시작</span>
                    <span className="text-xl font-black text-primary font-mono">{formatDuration(startSec.toString())}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        type="button"
                        onClick={() => adjustStart(-1)}
                        className="w-14 h-9 rounded-xl bg-card hover:bg-primary/5 border border-card-border hover:border-primary flex items-center justify-center text-xs font-black text-text-muted hover:text-primary transition-all duration-200 active:scale-95 cursor-pointer shrink-0 shadow-sm"
                        title="1초 뒤로"
                      >
                        -1s
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustStart(1)}
                        className="w-14 h-9 rounded-xl bg-card hover:bg-primary/5 border border-card-border hover:border-primary flex items-center justify-center text-xs font-black text-text-muted hover:text-primary transition-all duration-200 active:scale-95 cursor-pointer shrink-0 shadow-sm"
                        title="1초 앞으로"
                      >
                        +1s
                      </button>
                    </div>
                  </div>

                  {/* 종료 조절 카드 (세련된 그레이/화이트 포인트 디자인) */}
                  <div className="flex flex-col gap-2.5 text-right items-end p-3.5 rounded-2xl border border-card-border/80 bg-accent/30 relative overflow-hidden transition-all duration-300 hover:border-card-border shrink-0">
                    <span className="text-[10px] uppercase font-black tracking-wider text-text-muted">종료</span>
                    <span className="text-xl font-black text-foreground font-mono">{formatDuration(endSec.toString())}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        type="button"
                        onClick={() => adjustEnd(-1)}
                        className="w-14 h-9 rounded-xl bg-card hover:bg-primary/5 border border-card-border hover:border-primary flex items-center justify-center text-xs font-black text-text-muted hover:text-primary transition-all duration-200 active:scale-95 cursor-pointer shrink-0 shadow-sm"
                        title="1초 뒤로"
                      >
                        -1s
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustEnd(1)}
                        className="w-14 h-9 rounded-xl bg-card hover:bg-primary/5 border border-card-border hover:border-primary flex items-center justify-center text-xs font-black text-text-muted hover:text-primary transition-all duration-200 active:scale-95 cursor-pointer shrink-0 shadow-sm"
                        title="1초 앞으로"
                      >
                        +1s
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. 타임라인 슬라이더 바 (기본 포인트 파란색 적용) */}
                <div className="relative w-full h-6 flex items-center select-none mt-1">
                  {/* 슬라이더 배경 트랙 */}
                  <div className="absolute left-0 right-0 h-1.5 bg-card border border-card-border rounded-full" />
                  
                  {/* 선택된 활성화 구간 트랙 (Start ~ End 비율) */}
                  <div 
                    className="absolute h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(0,86,224,0.1)]"
                    style={{
                      left: `${(startSec / maxSeconds) * 100}%`,
                      width: `${((endSec - startSec) / maxSeconds) * 100}%`
                    }}
                  />
                  
                  {/* 시작점 슬라이더 */}
                  <input
                    type="range"
                    min={0}
                    max={maxSeconds}
                    value={startSec}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (value <= endSec - 3) {
                        setStartSec(value);
                        seekYoutubePlayer(value);
                        setTrimError(null);
                      }
                    }}
                    className="absolute w-full h-1.5 pointer-events-none appearance-none bg-transparent outline-none z-25
                      [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md
                      [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md"
                  />
                  
                  {/* 종료점 슬라이더 */}
                  <input
                    type="range"
                    min={0}
                    max={maxSeconds}
                    value={endSec}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (value >= startSec + 3) {
                        setEndSec(value);
                        seekYoutubePlayer(value);
                        setTrimError(null);
                      }
                    }}
                    className="absolute w-full h-1.5 pointer-events-none appearance-none bg-transparent outline-none z-20
                      [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md
                      [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md"
                  />
                </div>


                {trimError && (
                  <div className="flex gap-2 items-start bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-red-600 dark:text-red-300 leading-normal">{trimError}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 📥 Section B: 영상 다운로드 버튼 목록 (박스 없이 아이콘만 플랫하게 노출) */}
        <div className="flex flex-row gap-3 relative z-10 w-full items-center justify-start py-1">
          {videoFormats.length > 0 ? (
            // 고화질 원본 해상도 순으로 정렬하여 시안에 매치되게 가공 렌더링
            videoFormats.slice(0, 3).map((format, idx) => {
              let resolutionLabel = '';

              if (format.quality.includes('2160p') || format.quality.includes('4K')) {
                resolutionLabel = '4K UHD';
              } else if (format.quality.includes('1440p')) {
                resolutionLabel = '2K QHD';
              } else if (format.quality.includes('1080p')) {
                resolutionLabel = '1080p FHD';
              } else {
                const q = format.quality || '720p';
                resolutionLabel = `${q} HD`;
              }

              return (
                <button
                  key={format.itag}
                  type="button"
                  onClick={() => handleDownload(format)}
                  className="flex-1 bg-primary hover:bg-primary/95 text-white font-black h-12 rounded-2xl cursor-pointer flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-primary/10 hover:shadow-primary/25"
                  title={`${resolutionLabel} 다운로드`}
                >
                  <Download className="w-5 h-5 stroke-[2.5px] shrink-0" />
                </button>
              );
            })
          ) : (
            <div className="text-xs text-text-muted font-bold text-center py-2 w-full">
              다운로드 가능한 포맷 정보가 없습니다.
            </div>
          )}
        </div>

        {/* 🎥 Section C: AI 추천 하이라이트 구간 카드 */}
        <div className="p-4 rounded-2xl bg-accent/40 border border-card-border relative z-10 text-left">
          <div className="flex gap-2.5 w-full flex-col sm:flex-row items-stretch">
            {/* API Key 설정 모달 트리거 (아이콘만 노출, API 키 없을 시 빨간 테두리 강조) */}
            <button
              type="button"
              onClick={() => {
                setShowApiKeySetting(!showApiKeySetting);
              }}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 border shrink-0 active:scale-95 ${
                apiKey 
                  ? 'bg-accent/40 text-text-muted border-card-border hover:bg-primary/5 hover:border-primary hover:text-primary' 
                  : 'bg-red-500/5 text-red-500 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.15)]'
              }`}
              title={apiKey ? 'Gemini API Key 등록 완료 (클릭하여 관리)' : 'Gemini API Key 등록 필요 (AI 추천 필수)'}
            >
              <Key className={`w-5 h-5 shrink-0 ${!apiKey ? 'animate-pulse' : ''}`} />
            </button>

            {/* AI 추천 쇼츠 클립 생성 메인 단추 */}
            <button
              type="button"
              onClick={handleGenerateAIShorts}
              className="flex-1 bg-primary hover:bg-primary/95 text-white font-black py-3.5 px-6 rounded-2xl cursor-pointer flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-primary/10 hover:shadow-primary/25 text-xs tracking-wider uppercase"
            >
              <span>AI 추천 구간</span>
            </button>
          </div>
        </div>

      </div>

      {/* 🔐 Google Gemini API Key 설정 팝업 모달 */}
      <AnimatePresence>
        {showApiKeySetting && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* 뒷배경 글래스모피즘 어두운 오버레이 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiKeySetting(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* 모달 윈도우 박스 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-lg bg-card border border-card-border rounded-[32px] overflow-hidden shadow-premium z-10 flex flex-col p-6 md:p-8 text-left"
            >
              {/* 장식용 네온 백그라운드 스팟 */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

              {/* 모달 헤더 */}
              <div className="flex items-center justify-between border-b border-card-border pb-4 mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                    <Key className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground">Gemini API Key 설정</h3>
                    <p className="text-[10px] text-text-muted font-bold mt-0.5">
                      안전하게 브라우저 로컬 저장소에 보관됩니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowApiKeySetting(false)}
                  className="text-text-muted hover:text-foreground transition-colors cursor-pointer p-2 rounded-xl hover:bg-card-border shrink-0 animate-fade-in"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 모달 폼 본체 */}
              <form onSubmit={handleSaveApiKey} className="flex flex-col gap-5 relative z-10">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    Google AI Studio Gemini API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AI Studio에서 발급받은 AIzaSy... API Key"
                      className="flex-1 bg-accent border border-card-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
                    />
                    {apiKey && (
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 text-xs font-black px-4.5 rounded-xl cursor-pointer transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center mt-2 border-t border-card-border pt-4">
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-muted hover:text-foreground flex items-center gap-1 transition-colors font-bold"
                  >
                    Gemini API Key 발급받기
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="submit"
                    disabled={!apiKey.trim()}
                    className="bg-primary hover:bg-primary-hover text-white text-xs font-black px-5 py-3 rounded-xl transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-primary/10"
                  >
                    {isSaved ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        저장 완료!
                      </>
                    ) : (
                      '저장하기'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

