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

interface InvitationState {
  url: string;
  isLoading: boolean;
  isDownloading: boolean;
  error: string | null;
  progress: number;
  videoDetails: VideoDetails | null;
  formats: VideoFormat[];
  downloadCompleted: boolean;
  setUrl: (url: string) => void;
  fetchInfo: (url: string) => Promise<void>;
  startDownload: (itag: number, quality: string, trimOptions?: { startTime: string; duration: number }) => Promise<void>;
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

  setUrl: (url) => set({ url, error: null }),

  fetchInfo: async (url) => {
    if (!url) return;
    set({ isLoading: true, error: null, videoDetails: null, formats: [] });
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

    // 0% -> 95% visual progress simulation to prevent empty frozen states during backend pending processing
    let currentProgress = 0;
    const fakeProgressInterval = setInterval(() => {
      if (currentProgress < 60) {
        currentProgress += Math.floor(Math.random() * 12) + 5; // Rapid growth at start
      } else if (currentProgress < 85) {
        currentProgress += Math.floor(Math.random() * 4) + 1;  // Decelerating growth
      } else if (currentProgress < 95) {
        currentProgress += 0.3; // Incremental crawl
      }
      
      const rounded = Math.min(95, Math.round(currentProgress));
      set({ progress: rounded });
    }, 180);

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
          isTrim: !!trimOptions,
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

      const chunks: BlobPart[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      clearInterval(fakeProgressInterval);
      set({ progress: 100 });

      // Blob 파일 생성 및 다운로드 실행
      const blob = new Blob(chunks, {
        type: response.headers.get('Content-Type') || 'video/mp4',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      // 파일명 복원
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${videoDetails.title}_${quality}.mp4`;
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

  resetStore: () => set({
    url: '',
    isLoading: false,
    isDownloading: false,
    error: null,
    progress: 0,
    videoDetails: null,
    formats: [],
    downloadCompleted: false,
  }),
}));
