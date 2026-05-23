'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useInvitationStore, VideoFormat } from '@/store/useInvitationStore';
import { Download, Film, Music, Clock, Eye, ShieldAlert, Scissors, AlertCircle, Plus, Minus } from 'lucide-react';
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

// Convert 'HH:MM:SS' string to seconds
function timeStringToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
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
  // 정밀 유튜브 ID 매칭 정규식 (shorts, watch, embed, v, y2u.be 등 모든 주소 커버)
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : '';
}

interface DownloadCardProps {
  onDownloadStart: () => void;
}

export default function DownloadCard({ onDownloadStart }: DownloadCardProps) {
  const { videoDetails, formats, startDownload, url } = useInvitationStore();
  const [selectedItag, setSelectedItag] = useState<number | null>(null);

  // Trim local states
  const [isTrimEnabled, setIsTrimEnabled] = useState<boolean>(false);
  const [startSec, setStartSec] = useState<number>(0);
  const [endSec, setEndSec] = useState<number>(30);
  const [trimError, setTrimError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const maxSeconds = videoDetails ? (parseInt(videoDetails.lengthSeconds, 10) || 0) : 0;
  
  // Initialize values when video changes
  useEffect(() => {
    if (videoDetails) {
      setStartSec(0);
      setEndSec(Math.min(30, maxSeconds));
    }
  }, [videoDetails, maxSeconds]);

  if (!videoDetails) return null;
  
  // Calculate duration
  const duration = Math.max(3, endSec - startSec);
  const startTime = secondsToTimeString(startSec);

  // Seamless seek to YouTube iframe without reloading via postMessage
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
    setSelectedItag(format.itag);

    if (isTrimEnabled) {
      if (!validateTrim()) return;
      onDownloadStart();
      await startDownload(format.itag, format.quality, {
        startTime,
        duration,
      });
    } else {
      onDownloadStart();
      await startDownload(format.itag, format.quality);
    }
  };

  // Start time slider handler
  const handleStartSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setStartSec(value);
    setTrimError(null);

    if (endSec < value + 3) {
      setEndSec(Math.min(maxSeconds, value + 3));
    }

    seekYoutubePlayer(value);
  };

  // End time slider handler
  const handleEndSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setEndSec(value);
    setTrimError(null);

    if (startSec > value - 3) {
      setStartSec(Math.max(0, value - 3));
    }

    seekYoutubePlayer(value);
  };

  // Fine-tuning handler for start time
  const adjustStartSec = (amount: number) => {
    setStartSec((prev) => {
      let next = prev + amount;
      if (next < 0) next = 0;
      if (next > endSec - 3) next = endSec - 3;
      seekYoutubePlayer(next);
      return next;
    });
    setTrimError(null);
  };

  // Fine-tuning handler for end time
  const adjustEndSec = (amount: number) => {
    setEndSec((prev) => {
      let next = prev + amount;
      if (next < startSec + 3) next = startSec + 3;
      if (next > maxSeconds) next = maxSeconds;
      seekYoutubePlayer(next);
      return next;
    });
    setTrimError(null);
  };

  // Duration adjustments
  const adjustDuration = (amount: number) => {
    setEndSec((prev) => {
      const next = prev + amount;
      if (next < startSec + 3) return startSec + 3;
      if (next > maxSeconds) return maxSeconds;
      return next;
    });
    setTrimError(null);
  };

  // Format filtering (EXCLUDE 360p per user request)
  const videoFormats = formats.filter(f => f.hasVideo && f.quality !== '360p');
  const audioFormats = formats.filter(f => !f.hasVideo && f.hasAudio);

  // Standard embed url matching
  const videoId = getYoutubeVideoId(url) || getYoutubeVideoId(videoDetails.url);
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&start=0&autoplay=0&rel=0&modestbranding=1`
    : '';

  // Presets list
  const durationPresets = [
    { label: '쇼츠 15초', value: 15 },
    { label: '틱톡 30초', value: 30 },
    { label: '숏폼 60초', value: 60 },
    { label: '롱폼 180초', value: 180 },
  ];

  const applyPreset = (presetVal: number) => {
    const newEnd = startSec + presetVal;
    if (newEnd <= maxSeconds) {
      setEndSec(newEnd);
    } else {
      const newStart = Math.max(0, maxSeconds - presetVal);
      setStartSec(newStart);
      setEndSec(maxSeconds);
      seekYoutubePlayer(newStart);
    }
    setTrimError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-[1920px] mx-auto flex flex-col lg:flex-row gap-6 relative z-10 items-start select-none"
    >
      
      {/* 🎬 LEFT CARD PANEL: Completely separated video player card with luxury background */}
      <div className="flex-1 w-full flex flex-col gap-5 bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-5 md:p-7 shadow-2xl relative overflow-hidden">
        {/* Mood light dedicated to left video card */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Large YouTube Player */}
        <div className="relative group overflow-hidden rounded-2xl border border-neutral-850 aspect-video shadow-2xl bg-neutral-950/95 w-full transition-all duration-300 hover:border-neutral-700/50 relative z-10">
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
            <div className="w-full h-full flex items-center justify-center text-neutral-500 text-sm">
              유튜브 비디오를 임베드할 수 없습니다.
            </div>
          )}
        </div>

        {/* Video metadata info inside Left Card */}
        <div className="flex flex-col gap-2 p-1 relative z-10">
          <h2 className="text-lg md:text-2xl font-black text-white tracking-tight leading-snug">
            {videoDetails.title}
          </h2>
          <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-sm text-neutral-400 font-medium pt-1">
            <span className="font-bold text-neutral-200 text-sm">{videoDetails.author}</span>
            <span className="w-1 h-1 rounded-full bg-neutral-800 hidden sm:inline" />
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-neutral-500" />
              {formatViews(videoDetails.viewCount)}
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-800 hidden sm:inline" />
            <span className="flex items-center gap-1 text-[#FBC02D]">
              <Clock className="w-3.5 h-3.5" />
              전체: {formatDuration(videoDetails.lengthSeconds)}
            </span>
          </div>
        </div>

      </div>

      {/* 📥 RIGHT CARD PANEL: Completely separated Controls & Downloads Sidebar with luxury background */}
      <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-6 lg:sticky lg:top-4 bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        {/* Mood light dedicated to right sidebar card */}
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* ✂️ Section A: Trim Controls Panel (Top) */}
        <div className="p-5 rounded-2xl bg-neutral-950/50 border border-neutral-850/80 flex flex-col gap-4 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-[#FBC02D]" />
              <span className="text-sm font-extrabold text-white">원하는 구간 잘라내기</span>
            </div>
            
            {/* Switch Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsTrimEnabled(!isTrimEnabled);
                setTrimError(null);
              }}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 focus:outline-none ${
                isTrimEnabled ? 'bg-[#FBC02D]' : 'bg-neutral-800'
              }`}
            >
              <motion.div
                layout
                className="bg-neutral-950 w-4 h-4 rounded-full shadow-md"
                animate={{ x: isTrimEnabled ? 16 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <AnimatePresence>
            {isTrimEnabled && (
              <motion.div
                key="trim-panel-active"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden flex flex-col gap-3.5 pt-1.5"
              >
                {/* Slider controls with fine-tuning buttons */}
                <div className="flex flex-col gap-3.5 bg-neutral-900/10 p-3.5 rounded-xl border border-neutral-850/30">
                  
                  {/* Start Time Slider */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm font-bold text-neutral-400">
                      <span>시작점 (Start Time)</span>
                      <span className="text-[#FBC02D] font-extrabold">◀ {startTime}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxSeconds - 3}
                      value={startSec}
                      onChange={handleStartSliderChange}
                      className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#FBC02D] hover:accent-yellow-500"
                    />
                    
                    {/* 1s tuner */}
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[13px] text-neutral-500 font-bold mr-1">1초 미세조정:</span>
                      <button
                        type="button"
                        onClick={() => adjustStartSec(-1)}
                        className="px-2 py-0.5 text-[13px] font-black rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 active:scale-95 transition-all"
                      >
                        -1초
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustStartSec(1)}
                        className="px-2 py-0.5 text-[13px] font-black rounded bg-neutral-900 border border-neutral-800 text-[#FBC02D] hover:bg-[#FBC02D]/10 active:scale-95 transition-all"
                      >
                        +1초
                      </button>
                    </div>
                  </div>

                  {/* End Time Slider */}
                  <div className="flex flex-col gap-1.5 border-t border-neutral-850/20 pt-2.5">
                    <div className="flex items-center justify-between text-sm font-bold text-neutral-400">
                      <span>종료점 (End Time)</span>
                      <span className="text-[#FBC02D] font-extrabold">▶ {secondsToTimeString(endSec)}</span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={maxSeconds}
                      value={endSec}
                      onChange={handleEndSliderChange}
                      className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#FBC02D] hover:accent-yellow-500"
                    />
                    
                    {/* 1s tuner */}
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[13px] text-neutral-500 font-bold mr-1">1초 미세조정:</span>
                      <button
                        type="button"
                        onClick={() => adjustEndSec(-1)}
                        className="px-2 py-0.5 text-[13px] font-black rounded bg-neutral-900 border border-neutral-800 text-[#FBC02D] hover:bg-[#FBC02D]/10 active:scale-95 transition-all"
                      >
                        -1초
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustEndSec(1)}
                        className="px-2 py-0.5 text-[13px] font-black rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 active:scale-95 transition-all"
                      >
                        +1초
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preset panel */}
                <div className="flex flex-col gap-3 bg-neutral-900/20 p-3.5 rounded-xl border border-neutral-850/25">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-300">추출 분량:</span>
                    <span className="text-sm font-extrabold text-[#FBC02D]">{duration}초 분량 잘라받기</span>
                  </div>
                  
                  {/* 5-sec incremental */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustDuration(-5)}
                      className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center transition-colors duration-200 active:scale-95"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <div className="w-12 text-center">
                      <span className="text-base font-black text-white">{duration}</span>
                      <span className="text-sm text-neutral-400 font-bold ml-0.5">초</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustDuration(5)}
                      className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center transition-colors duration-200 active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Preset buttons */}
                  <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                    {durationPresets.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => applyPreset(preset.value)}
                        className={`py-1.5 text-sm font-black rounded-lg text-center tracking-tight border transition-all duration-200 ${
                          duration === preset.value
                            ? 'bg-[#FBC02D]/10 border-[#FBC02D] text-[#FBC02D]'
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Seamless guide */}
                <div className="text-[13px] text-neutral-500 bg-neutral-900/10 p-2.5 rounded-lg border border-neutral-850/20 leading-snug">
                  ⚡ **Seamless Seek Active**: 끊김 없이 실시간 재생 상태를 완벽히 유지하며 1초 단위 탐색 동조가 완료됩니다.
                </div>

                {trimError && (
                  <div className="flex gap-2 items-start bg-red-950/10 border border-red-500/20 p-2 rounded-xl">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-red-300 leading-normal">{trimError}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 📥 Section B: Downloads List (Bottom) */}
        <div className="flex flex-col gap-5 relative z-10">
          
          {/* Video downloads option */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-white font-bold tracking-wide text-sm">
              <Film className="w-3.5 h-3.5 text-[#FBC02D]" />
              <span>비디오 다운로드 (MP4)</span>
            </div>
            
            {/* Video scroll view */}
            <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto p-1.5 pr-2.5 scrollbar-thin">
              {videoFormats.length > 0 ? (
                videoFormats.map((format) => (
                  <button
                    key={format.itag}
                    type="button"
                    onClick={() => handleDownload(format)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-neutral-950/40 border border-neutral-800/80 hover:border-[#FBC02D] hover:bg-neutral-900/60 text-left cursor-pointer group hover:scale-[1.005] active:scale-[0.98] transition-all duration-300 focus:outline-none focus:border-[#FBC02D] focus:shadow-[0_0_20px_rgba(251,192,45,0.15)] select-none"
                    title={isTrimEnabled ? '선택 구간 다운로드' : '전체 파일 다운로드'}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-white group-hover:text-[#FBC02D] transition-colors duration-200">
                          {format.quality}
                        </span>
                        {format.fps > 30 && (
                          <span className="text-xs bg-[#FBC02D]/10 border border-[#FBC02D]/20 text-[#FBC02D] px-2 py-0.5 rounded-full font-black tracking-wider">
                            {format.fps}FPS
                          </span>
                        )}
                        {isTrimEnabled ? (
                          <span className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-black tracking-wider">
                            잘라내기
                          </span>
                        ) : (
                          <span className="text-xs bg-neutral-800 border border-transparent text-neutral-400 px-2 py-0.5 rounded-full font-bold">
                            전체영상
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-neutral-450 mt-0.5 font-bold">
                        {isTrimEnabled ? (
                          <span className="text-[#FBC02D]">
                            ⚡ {startTime} ~ {secondsToTimeString(endSec)}
                          </span>
                        ) : (
                          format.contentLength !== '0'
                            ? `크기: 약 ${(parseInt(format.contentLength) / (1024 * 1024)).toFixed(1)} MB`
                            : '크기 확인 중'
                        )}
                      </span>
                    </div>
                    {/* Download glow icon */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 group-hover:text-black group-hover:bg-[#FBC02D] group-hover:border-[#FBC02D] group-hover:shadow-[0_0_10px_rgba(251,192,45,0.4)] group-hover:scale-105 active:scale-95 transition-all duration-300 shrink-0">
                      <Download className="w-4 h-4 group-hover:animate-bounce" />
                    </div>
                  </button>
                ))
              ) : (
                <span className="text-sm text-neutral-500 py-2 text-center">가용한 비디오 포맷이 없습니다.</span>
              )}
            </div>
          </div>

          {/* Audio downloads option */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-white font-bold tracking-wide text-sm">
              <Music className="w-3.5 h-3.5 text-[#FBC02D]" />
              <span>오디오 다운로드 (MP3)</span>
            </div>
            
            {/* Audio scroll view */}
            <div className="flex flex-col gap-2 p-1.5">
              {audioFormats.length > 0 ? (
                audioFormats.slice(0, 3).map((format) => (
                  <button
                    key={format.itag}
                    type="button"
                    onClick={() => handleDownload(format)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-neutral-950/40 border border-neutral-800/80 hover:border-[#FBC02D] hover:bg-neutral-900/60 text-left cursor-pointer group hover:scale-[1.005] active:scale-[0.98] transition-all duration-300 focus:outline-none focus:border-[#FBC02D] focus:shadow-[0_0_20px_rgba(251,192,45,0.15)] select-none"
                    title={isTrimEnabled ? '오디오 구간 잘라내기' : '전체 음원 다운로드'}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-white group-hover:text-[#FBC02D] transition-colors duration-200">
                          음원 추출 (MP3)
                        </span>
                        {isTrimEnabled ? (
                          <span className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-black tracking-wider">
                            잘라내기
                          </span>
                        ) : (
                          <span className="text-xs bg-neutral-800 border border-transparent text-neutral-400 px-2 py-0.5 rounded-full font-bold">
                            전체음원
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-neutral-450 mt-0.5 font-bold">
                        {isTrimEnabled ? (
                          <span className="text-[#FBC02D]">
                            ⚡ {startTime} ~ {secondsToTimeString(endSec)}
                          </span>
                        ) : (
                          format.contentLength !== '0'
                            ? `크기: 약 ${(parseInt(format.contentLength) / (1024 * 1024)).toFixed(1)} MB`
                            : '크기 확인 중'
                        )}
                      </span>
                    </div>
                    {/* Download glow icon */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 group-hover:text-black group-hover:bg-[#FBC02D] group-hover:border-[#FBC02D] group-hover:shadow-[0_0_10px_rgba(251,192,45,0.4)] group-hover:scale-105 active:scale-95 transition-all duration-300 shrink-0">
                      <Download className="w-4 h-4 group-hover:animate-bounce" />
                    </div>
                  </button>
                ))
              ) : (
                <span className="text-sm text-neutral-500 py-2 text-center">가용한 오디오 포맷이 없습니다.</span>
              )}
            </div>
          </div>

          {/* Guide footer info */}
          <div className="p-3.5 rounded-2xl bg-yellow-500/5 border border-yellow-500/10 flex gap-2 items-start mt-2">
            <ShieldAlert className="w-4 h-4 text-[#FBC02D] shrink-0 mt-0.5 animate-pulse" />
            <p className="text-sm text-neutral-400 leading-normal">
              1080p 이상 고해상도도 무손실 음원과 완벽하게 병합 결합하여 오디오 싱크 밀림 없이 다운로드됩니다!
            </p>
          </div>

        </div>

      </div>

    </motion.div>
  );
}
