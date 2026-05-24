import { create } from 'zustand';

export interface VideoDetails {
  title: string;
  description: string;
  thumbnail: string;
  author: string;
  lengthSeconds: string;
  viewCount: string;
  url: string;
}

export interface VideoFormat {
  itag: number;
  formatId: string;
  quality: string;
  container: string;
  hasVideo: boolean;
  hasAudio: boolean;
  fps: number;
  contentLength: string;
  mimeType?: string;
}

export interface ShortsRecommendation {
  type?: 'single' | 'stitch';
  title: string;
  hook: string;
  reason: string;
  // 단일 추천일 때만 존재
  startTime?: number;
  endTime?: number;
  formattedStart?: string;
  formattedEnd?: string;
  // 짜집기 추천일 때만 존재
  segments?: {
    startTime: number;
    endTime: number;
    formattedStart: string;
    formattedEnd: string;
    label: string;
  }[];
}

interface InvitationState {
  url: string;
  isLoading: boolean;
  isDownloading: boolean;
  error: string | null;
  progress: number;
  videoDetails: VideoDetails | null;
  formats: VideoFormat[];
  downloadCompleted: boolean;
  
  // AI Shorts Analyzer States
  isAnalyzingShorts: boolean;
  shortsRecommendations: ShortsRecommendation[] | null;
  analyzeError: string | null;
  showShortsAnalyzer: boolean;
  showApiKeySetting: boolean;
  apiKey: string;

  setUrl: (url: string) => void;
  fetchInfo: (url: string) => Promise<void>;
  setShowShortsAnalyzer: (show: boolean) => void;
  setShowApiKeySetting: (show: boolean) => void;
  setApiKey: (key: string) => void;
  startDownload: (
    itag: number, 
    quality: string, 
    trimOptions?: { 
      startTime?: string; 
      duration?: number;
      isStitch?: boolean;
      segments?: { startTime: number; duration: number }[];
    }
  ) => Promise<void>;
  analyzeShorts: (url: string, customApiKey?: string, lengthSeconds?: string, forceRefresh?: boolean) => Promise<void>;
  resetStore: () => void;
}

export const useInvitationStore = create<InvitationState>((set, get) => ({
  url: '',
  isLoading: false,
  isDownloading: false,
  error: null,
  progress: 0,
  videoDetails: null,
  formats: [],
  downloadCompleted: false,

  // AI Shorts Analyzer Initial States
  isAnalyzingShorts: false,
  shortsRecommendations: null,
  analyzeError: null,
  showShortsAnalyzer: false,
  showApiKeySetting: false,
  apiKey: '',

  setUrl: (url) => set({ url, error: null }),
  setShowShortsAnalyzer: (show) => set({ showShortsAnalyzer: show }),
  setShowApiKeySetting: (show) => set({ showApiKeySetting: show }),
  setApiKey: (key) => set({ apiKey: key }),

  fetchInfo: async (url) => {
    if (!url) return;
    set({ 
      isLoading: true, 
      error: null, 
      videoDetails: null, 
      formats: [],
      shortsRecommendations: null,
      analyzeError: null
    });
    try {
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '비디오 정보를 로드하지 못했습니다.');
      }

      set({
        videoDetails: data.videoDetails,
        formats: data.formats,
        isLoading: false,
      });

      // 로컬 스토리지에서 기존 쇼츠 추천 캐시가 있는지 자동 탐색 및 로드
      const getVid = (u: string) => {
        const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
        const match = u.match(regExp);
        return (match && match[1].length === 11) ? match[1] : '';
      };
      const vid = getVid(url);
      if (vid) {
        try {
          const cacheKey = `ytdl_shorts_cache_${vid}`;
          const cachedDataStr = localStorage.getItem(cacheKey);
          if (cachedDataStr) {
            const cached = JSON.parse(cachedDataStr);
            const ANALYSIS_CACHE_TTL = 1000 * 60 * 60 * 24; // 24시간 캐시 유효
            if (cached && cached.recommendations && (Date.now() - cached.timestamp < ANALYSIS_CACHE_TTL)) {
              set({
                shortsRecommendations: cached.recommendations
              });
              console.log(`[Zustand] 로컬 스토리지 캐시로부터 기존 쇼츠 데이터를 복원했습니다: ${vid}`);
            } else {
              localStorage.removeItem(cacheKey); // 만료된 캐시 청소
            }
          }
        } catch (e) {
          console.error('[Zustand] 로컬 캐시 조회 중 오류:', e);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      set({ error: errorMessage, isLoading: false });
    }
  },

  startDownload: async (itag, quality, trimOptions) => {
    const { videoDetails, formats } = get();
    if (!videoDetails) return;

    const selectedFormat = formats.find(f => f.itag === itag);
    const formatId = selectedFormat?.formatId || String(itag);
    const isMergeNeeded = selectedFormat ? (selectedFormat.hasVideo && !selectedFormat.hasAudio) : false;

    set({ isDownloading: true, progress: 0, error: null, downloadCompleted: false });

    // 프로그레스 시뮬레이션
    let currentProgress = 0;
    let tickCount = 0;
    const fakeProgressInterval = setInterval(() => {
      tickCount++;
      if (currentProgress < 40) {
        currentProgress += Math.floor(Math.random() * 8) + 3;
      } else if (currentProgress < 70) {
        currentProgress += Math.floor(Math.random() * 3) + 1;
      } else if (currentProgress < 85) {
        currentProgress += 0.5;
      } else if (currentProgress < 92) {
        currentProgress += 0.15;
      } else if (currentProgress < 99) {
        // 92%~99%: 아주 천천히 올라감 (서버 처리 대기)
        currentProgress += 0.03;
      }
      const rounded = Math.min(99, Math.round(currentProgress * 10) / 10);
      set({ progress: Math.round(rounded) });
    }, 300);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoDetails.url,
          itag,
          formatId,
          title: videoDetails.title,
          quality,
          startTime: trimOptions?.startTime,
          duration: trimOptions?.duration,
          isTrim: !!trimOptions && !trimOptions.isStitch,
          isStitch: !!trimOptions?.isStitch,
          segments: trimOptions?.segments,
          isMergeNeeded
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '다운로드에 실패했습니다.');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('스트림 리더를 초기화할 수 없습니다.');
      }

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      clearInterval(fakeProgressInterval);
      set({ progress: 100 });

      const blob = new Blob(chunks as BlobPart[], {
        type: response.headers.get('Content-Type') || 'video/mp4',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      const contentDisposition = response.headers.get('Content-Disposition');
      const isAudio = quality?.includes('음원') || selectedFormat?.container === 'mp3';
      const ext = isAudio ? 'mp3' : 'mp4';
      let filename = `${videoDetails.title}.${ext}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      set({ isDownloading: false, downloadCompleted: true });
    } catch (err: unknown) {
      clearInterval(fakeProgressInterval);
      const errorMessage = err instanceof Error ? err.message : '다운로드 프로세스 진행 중 오류가 발생했습니다.';
      set({ error: errorMessage, isDownloading: false });
    }
  },

  analyzeShorts: async (url, customApiKey, lengthSeconds, forceRefresh = false) => {
    if (!url) return;
    set({ isAnalyzingShorts: true, shortsRecommendations: null, analyzeError: null });

    try {
      const response = await fetch('/api/analyze-shorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, customApiKey, lengthSeconds, forceRefresh }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI 쇼츠 분석에 실패했습니다.');
      }

      set({
        shortsRecommendations: data.recommendations,
        isAnalyzingShorts: false,
      });

      // 클라이언트 localStorage 캐시 저장
      const getVid = (u: string) => {
        const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
        const match = u.match(regExp);
        return (match && match[1].length === 11) ? match[1] : '';
      };
      const vid = getVid(url);
      if (vid && data.recommendations) {
        try {
          const cacheKey = `ytdl_shorts_cache_${vid}`;
          localStorage.setItem(cacheKey, JSON.stringify({
            recommendations: data.recommendations,
            timestamp: Date.now()
          }));
          console.log(`[Zustand] 로컬 스토리지에 분석 결과 캐싱 완료: ${vid}`);
        } catch (e) {
          console.error('[Zustand] 로컬 캐시 저장 오류:', e);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      set({ analyzeError: errorMessage, isAnalyzingShorts: false });
    }
  },

  resetStore: () => set({
    url: '',
    isLoading: false,
    isDownloading: false,
    error: null,
    progress: 0,
    videoDetails: null,
    formats: [],
    downloadCompleted: false,
    isAnalyzingShorts: false,
    shortsRecommendations: null,
    analyzeError: null,
    showShortsAnalyzer: false,
    showApiKeySetting: false,
    apiKey: '',
  }),
}));
