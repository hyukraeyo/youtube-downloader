'use client';

import React, { useState, useEffect } from 'react';
import { useInvitationStore } from '@/store/useInvitationStore';
import DownloadCard from '@/components/DownloadCard';
import ShortsAnalyzerCard from '@/components/ShortsAnalyzerCard';
import ResponsiveModal from '@/components/ResponsiveModal';
import { 
  Play, 
  Search, 
  AlertCircle, 
  RefreshCw, 
  Loader2, 
  Sparkles, 
  Minimize2, 
  Maximize2, 
  Zap, 
  Clock, 
  ArrowRight,
  Sun, 
  Moon,
  Bell,
  User,
  Check,
  Flame,
  Shield,
  Cpu,
  Layers,
  HelpCircle,
  ExternalLink,
  Plus
} from 'lucide-react';
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
    showShortsAnalyzer,
  } = useInvitationStore();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [downloadStartTime, setDownloadStartTime] = useState<number>(0);
  const [downloadMeta, setDownloadMeta] = useState<{ quality: string; hasVideo: boolean; hasAudio: boolean; isTrim: boolean } | null>(null);

  // 테마 상태 관리 (기본 다크모드)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clips' | 'templates' | 'pricing'>('dashboard');
  const [fontPreviewText, setFontPreviewText] = useState<string>('유튜브 다운로드도 컷튜브 AI와 함께!');

  // 마운트 시 로컬 스토리지 테마 로드
  useEffect(() => {
    const savedTheme = localStorage.getItem('cuttube_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    } else {
      // 기본값 다크
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  // 테마 전환 함수
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('cuttube_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  // 다운로드 완료 시 처리
  useEffect(() => {
    if (downloadCompleted) {
      if (isModalOpen) {
        const timer = setTimeout(() => {
          setIsModalOpen(false);
        }, 1800);
        return () => clearTimeout(timer);
      }
      if (isMinimized) {
        const timer = setTimeout(() => {
          setIsMinimized(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [downloadCompleted, isModalOpen, isMinimized]);

  // 다운로드 속도 및 남은 시간 동적 시뮬레이션 계산
  const getDownloadStats = () => {
    if (!downloadStartTime) return { speed: '24.8 MB/s', timeLeft: '계산 중...' };
    
    const elapsedSeconds = (Date.now() - downloadStartTime) / 1000;
    if (elapsedSeconds <= 0.5) {
      return { speed: '24.8 MB/s', timeLeft: '계산 중...' };
    }

    // 대략적인 예상 파일 크기
    let estimatedTotalMB = 45;
    if (downloadMeta) {
      if (!downloadMeta.hasVideo) estimatedTotalMB = 8;
      else if (downloadMeta.quality.includes('4K') || downloadMeta.quality.includes('2160p')) estimatedTotalMB = 180;
      else if (downloadMeta.quality.includes('1080p')) estimatedTotalMB = 65;
      else if (downloadMeta.quality.includes('720p')) estimatedTotalMB = 35;
      
      if (downloadMeta.isTrim) {
        estimatedTotalMB = Math.max(3, estimatedTotalMB * 0.15);
      }
    }

    // progress에 따른 현재 다운로드 양
    const currentMB = estimatedTotalMB * (progress / 100);
    
    // 실시간 속도
    let speedVal = currentMB / elapsedSeconds;
    if (isNaN(speedVal) || speedVal <= 0) speedVal = 18.5;
    speedVal = Math.min(55, Math.max(8.5, speedVal + Math.sin(elapsedSeconds) * 2));
    
    const speedStr = `${speedVal.toFixed(1)} MB/s`;

    // 남은 시간
    const remainingMB = estimatedTotalMB - currentMB;
    const remainingSeconds = speedVal > 0 ? remainingMB / speedVal : 5;
    
    let timeLeftStr = '';
    if (progress >= 95) {
      timeLeftStr = '몇 초 남지 않음';
    } else if (remainingSeconds < 60) {
      timeLeftStr = `${Math.ceil(remainingSeconds)}초 남음`;
    } else {
      const mins = Math.floor(remainingSeconds / 60);
      const secs = Math.ceil(remainingSeconds % 60);
      timeLeftStr = `${mins}분 ${secs}초 남음`;
    }

    return { speed: speedStr, timeLeft: timeLeftStr };
  };

  // 동적 상태 뱃지 생성
  const getBadges = () => {
    const badges: { text: string; dotColor: string }[] = [];
    if (!downloadMeta) return [{ text: '미디어 정보 분석 중', dotColor: 'bg-yellow-400' }];

    if (downloadMeta.hasVideo) {
      if (downloadMeta.quality.includes('1080p') || downloadMeta.quality.includes('1440p')) {
        badges.push({ text: '표준 고화질 HD', dotColor: 'bg-cyan-400' });
      } else if (downloadMeta.quality.includes('4K') || downloadMeta.quality.includes('2160p')) {
        badges.push({ text: '원본 초고화질 4K', dotColor: 'bg-blue-500' });
      } else {
        badges.push({ text: '일반 비디오 화질', dotColor: 'bg-neutral-400' });
      }
    } else {
      badges.push({ text: '고해상도 고음질 MP3', dotColor: 'bg-purple-500' });
    }

    if (progress < 35) {
      badges.push({ text: '미디어 스트림 데이터 분석', dotColor: 'bg-amber-400' });
    } else if (progress < 80) {
      if (downloadMeta.hasVideo && !downloadMeta.hasAudio) {
        badges.push({ text: '오디오 및 비디오 파일 병합 중', dotColor: 'bg-indigo-400' });
      } else if (!downloadMeta.hasVideo) {
        badges.push({ text: '고주파 MP3 음원 변환 중', dotColor: 'bg-pink-400' });
      } else {
        badges.push({ text: '미디어 최종 인코딩 최적화', dotColor: 'bg-emerald-400' });
      }
    } else {
      badges.push({ text: '소장용 단일 파일 결합 중', dotColor: 'bg-teal-400' });
    }

    return badges;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    fetchInfo(url);
  };

  const handleDownloadStart = (meta?: { quality: string; hasVideo: boolean; hasAudio: boolean; isTrim: boolean }) => {
    setDownloadStartTime(Date.now());
    if (meta) {
      setDownloadMeta(meta);
    } else {
      setDownloadMeta({ quality: '1080p', hasVideo: true, hasAudio: true, isTrim: false });
    }
    setIsModalOpen(true);
    setIsMinimized(true);
  };

  // 신규 링크 초기화
  const handleNewLink = () => {
    resetStore();
    setActiveTab('dashboard');
  };

  // 탭 한글 텍스트 매핑
  const getTabKoreanLabel = (tab: string) => {
    switch (tab) {
      case 'dashboard': return '동영상 분석기';
      case 'clips': return '쇼츠 하이라이트';
      case 'templates': return '편집 템플릿';
      case 'pricing': return '프리미엄 요금제';
      default: return '';
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between py-6 px-4 md:px-8 overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* 백그라운드 디자인 그라데이션 오버레이 (아이스블루 / 딥블루 스팟) */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />

      {/* 1. 헤더 네비게이션 (최대 1920px 와이드 제한 및 중앙 정렬) */}
      <header className="relative z-50 w-full max-w-[1920px] mx-auto flex items-center justify-between mb-10 py-4 px-6 rounded-[24px] bg-card/60 backdrop-blur-xl border border-card-border shadow-premium">
        
        {/* 로고 영역 (텍스트 삭제, 심플 아이콘 로고 적용) */}
        <div className="flex items-center gap-2 group cursor-pointer" onClick={handleNewLink} title="홈으로 이동">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
            <Play className="w-4.5 h-4.5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* 우측 아이콘 및 새 영상 입력 버튼 */}
        <div className="flex items-center gap-3.5">
          {/* 테마 스위치 */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-accent border border-card-border flex items-center justify-center text-foreground hover:bg-primary/5 hover:border-primary hover:text-primary transition-all duration-300 active:scale-95 cursor-pointer"
            title={theme === 'dark' ? '라이트모드로 전환' : '다크모드로 전환'}
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          {/* 새 영상 분석 버튼 (Plus 아이콘 대체) */}
          <button
            onClick={handleNewLink}
            className="w-9 h-9 rounded-xl bg-primary hover:bg-primary/95 text-white flex items-center justify-center shadow-md shadow-primary/15 hover:shadow-primary/25 active:scale-95 cursor-pointer transition-all duration-300 shrink-0"
            title="새 영상 분석"
          >
            <Plus className="w-4.5 h-4.5 stroke-[2.5px]" />
          </button>
        </div>
      </header>

      {/* 2. 메인 콘텐츠 영역 (상태별 분기) */}
      <div className={`flex-1 flex flex-col items-center w-full max-w-[1920px] mx-auto relative z-10 px-4 md:px-6 ${
        !videoDetails ? 'justify-center pb-20' : 'justify-start'
      }`}>
        
        <AnimatePresence mode="wait">
          {!videoDetails ? (
            /* ========================================================================= */
            /* 2-A. 비디오 상세 정보가 없을 때: 시안 3 메인 대시보드 구조 전면 개편 */
            /* ========================================================================= */
            <motion.div
              key="search-dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="w-full flex flex-col items-center text-center gap-12 my-auto"
            >


              {/* 검색 및 분석 폼 */}
              <form onSubmit={handleSubmit} className="w-full max-w-3xl relative px-2">
                <div className="relative flex items-center bg-card/70 backdrop-blur-xl border border-card-border rounded-full p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-300 shadow-premium">
                  <div className="pl-4 text-text-muted">
                    <Search className="w-5 h-5" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="여기에 유튜브 주소 링크를 붙여넣으세요..."
                    className="w-full bg-transparent border-none text-foreground text-sm sm:text-base py-3 px-3 placeholder-text-muted focus:outline-none"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !url.trim()}
                    className="bg-primary hover:bg-primary/95 text-white font-extrabold w-[130px] sm:w-[150px] py-3 rounded-full flex items-center justify-center gap-1.5 shadow-lg shadow-primary/15 hover:shadow-primary/25 active:scale-95 cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      <>
                        다운로드
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* 임시 브랜드 폰트 카탈로그 쇼케이스 */}
              <div className="w-full max-w-[1920px] mx-auto mt-16 px-2">
                <div className="flex flex-col items-center gap-3 mb-8">
                  <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-full text-xs font-bold text-primary">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-500" />
                    <span>실시간 폰트 테스터 (임시)</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-title">
                    대기업 & 인기 시그니처 폰트 쇼케이스
                  </h3>
                  <p className="text-sm text-text-muted max-w-lg leading-relaxed">
                    자막 편집기에서 즉시 적용 가능한 국내 대기업 브랜드 및 예능 자막용 서체입니다. 
                    아래 인풋창에 글자를 입력하여 각 서체의 느낌을 미리 비교해 보세요!
                  </p>

                  {/* 실시간 텍스트 인풋 */}
                  <div className="w-full max-w-md mt-4 relative">
                    <input
                      type="text"
                      value={fontPreviewText}
                      onChange={(e) => setFontPreviewText(e.target.value)}
                      placeholder="테스트할 문구를 입력해보세요..."
                      className="w-full bg-card/50 backdrop-blur-md border border-card-border rounded-xl py-3.5 px-5 text-sm text-foreground focus-neon-blue text-center font-bold"
                    />
                  </div>
                </div>

                {/* 폰트 카드 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                  {/* 1. 당근체 */}
                  <div className="group relative bg-card/60 backdrop-blur-xl border border-card-border rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-premium hover:border-orange-500/30 overflow-hidden flex flex-col justify-between min-h-[200px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-[100px] group-hover:bg-orange-500/10 transition-colors duration-300" />
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-md">당근마켓</span>
                        <span className="text-[10px] text-text-muted font-bold">CookieRun 대체</span>
                      </div>
                      <h4 className="text-lg font-black text-foreground mb-2 font-cookierun">당근체</h4>
                      <p className="text-xs text-text-muted leading-relaxed mb-6">친근하고 따뜻한 느낌을 주는 라운드 스타일의 소셜 서체</p>
                    </div>
                    <div className="border-t border-card-border/50 pt-4 mt-auto">
                      <p className="text-xl text-foreground font-medium truncate py-1 font-cookierun">
                        {fontPreviewText || '동네 이웃과 함께하는 따뜻함!'}
                      </p>
                    </div>
                  </div>

                  {/* 2. 지마켓체 */}
                  <div className="group relative bg-card/60 backdrop-blur-xl border border-card-border rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-premium hover:border-blue-500/30 overflow-hidden flex flex-col justify-between min-h-[200px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-[100px] group-hover:bg-blue-500/10 transition-colors duration-300" />
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-md">신세계 Gmarket</span>
                        <span className="text-[10px] text-text-muted font-bold">GmarketSans</span>
                      </div>
                      <h4 className="text-lg font-black text-foreground mb-2 font-gmarketsans">지마켓체</h4>
                      <p className="text-xs text-text-muted leading-relaxed mb-6">구조적인 기하학적 형태와 뛰어난 정렬이 돋보이는 모던 서체</p>
                    </div>
                    <div className="border-t border-card-border/50 pt-4 mt-auto">
                      <p className="text-xl text-foreground font-medium truncate py-1 font-gmarketsans">
                        {fontPreviewText || '쇼핑을 더 직관적이고 경쾌하게!'}
                      </p>
                    </div>
                  </div>

                  {/* 3. 프리텐다드체 */}
                  <div className="group relative bg-card/60 backdrop-blur-xl border border-card-border rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-premium hover:border-neutral-500/30 overflow-hidden flex flex-col justify-between min-h-[200px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-neutral-500/5 rounded-bl-[100px] group-hover:bg-neutral-500/10 transition-colors duration-300" />
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black text-neutral-400 bg-neutral-500/10 px-2.5 py-1 rounded-md">산돌 Open-Source</span>
                        <span className="text-[10px] text-text-muted font-bold">Pretendard</span>
                      </div>
                      <h4 className="text-lg font-black text-foreground mb-2 font-pretendard">프리텐다드체</h4>
                      <p className="text-xs text-text-muted leading-relaxed mb-6">모든 플랫폼과 디바이스에서 최상의 선명도를 자랑하는 표준 서체</p>
                    </div>
                    <div className="border-t border-card-border/50 pt-4 mt-auto">
                      <p className="text-xl text-foreground font-medium truncate py-1 font-pretendard">
                        {fontPreviewText || '모든 디바이스에서 완벽한 가독성'}
                      </p>
                    </div>
                  </div>

                  {/* 4. 여기어때 잘난체 */}
                  <div className="group relative bg-card/60 backdrop-blur-xl border border-card-border rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-premium hover:border-red-500/30 overflow-hidden flex flex-col justify-between min-h-[200px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-[100px] group-hover:bg-red-500/10 transition-colors duration-300" />
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black text-red-500 bg-red-500/10 px-2.5 py-1 rounded-md">여기어때</span>
                        <span className="text-[10px] text-text-muted font-bold">Jalnan</span>
                      </div>
                      <h4 className="text-lg font-black text-foreground mb-2 font-jalnan">여기어때 잘난체</h4>
                      <p className="text-xs text-text-muted leading-relaxed mb-6">톡톡 튀는 둥글고 역동적인 실루엣의 예능 자막 대명사</p>
                    </div>
                    <div className="border-t border-card-border/50 pt-4 mt-auto">
                      <p className="text-xl text-foreground font-medium truncate py-1 font-jalnan">
                        {fontPreviewText || '오늘 밤 우리 여기서 잘난체!'}
                      </p>
                    </div>
                  </div>

                  {/* 5. 어그로체 */}
                  <div className="group relative bg-card/60 backdrop-blur-xl border border-card-border rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-premium hover:border-violet-500/30 overflow-hidden flex flex-col justify-between min-h-[200px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-bl-[100px] group-hover:bg-violet-500/10 transition-colors duration-300" />
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black text-violet-500 bg-violet-500/10 px-2.5 py-1 rounded-md">샌드박스 네트워크</span>
                        <span className="text-[10px] text-text-muted font-bold">SBAggro</span>
                      </div>
                      <h4 className="text-lg font-black text-foreground mb-2 font-sbaggro">어그로체</h4>
                      <p className="text-xs text-text-muted leading-relaxed mb-6">주목도 극대화를 위해 태어난 볼드하고 트렌디한 크리에이터 서체</p>
                    </div>
                    <div className="border-t border-card-border/50 pt-4 mt-auto">
                      <p className="text-xl text-foreground font-medium truncate py-1 font-sbaggro">
                        {fontPreviewText || '주목해! 엄청난 어그로가 끌린다!'}
                      </p>
                    </div>
                  </div>

                  {/* 6. 배민 도현체 */}
                  <div className="group relative bg-card/60 backdrop-blur-xl border border-card-border rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-premium hover:border-emerald-500/30 overflow-hidden flex flex-col justify-between min-h-[200px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-[100px] group-hover:bg-emerald-500/10 transition-colors duration-300" />
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-md">우아한형제들</span>
                        <span className="text-[10px] text-text-muted font-bold">DoHyeon</span>
                      </div>
                      <h4 className="text-lg font-black text-foreground mb-2 font-dohyeon">배민 도현체</h4>
                      <p className="text-xs text-text-muted leading-relaxed mb-6">아크릴판을 손으로 잘라낸 듯 투박하면서도 따뜻한 아날로그 서체</p>
                    </div>
                    <div className="border-t border-card-border/50 pt-4 mt-auto">
                      <p className="text-xl text-foreground font-medium truncate py-1 font-dohyeon">
                        {fontPreviewText || '우리가 어떤 민족입니까!'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          ) : (
            <motion.div
              key="result-dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full flex flex-col items-center gap-8 mt-2"
            >


              <DownloadCard key={videoDetails?.url} onDownloadStart={handleDownloadStart} />
              <AnimatePresence>
                {showShortsAnalyzer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.98 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.98 }}
                    transition={{ 
                      duration: 0.6, 
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    className="w-full overflow-hidden"
                  >
                    <ShortsAnalyzerCard onDownloadStart={handleDownloadStart} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 w-full max-w-xl bg-red-500/10 border border-red-500/20 rounded-2xl p-4.5 flex gap-3.5 items-start shadow-lg"
            >
              <AlertCircle className="w-5.5 h-5.5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-sm font-bold text-red-700 dark:text-red-200">에러 발생</span>
                <span className="text-sm text-red-600 dark:text-red-300/80 leading-relaxed">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. 다운로드 진행률 팝업 모달 */}
      <ResponsiveModal
        isOpen={isModalOpen && !isMinimized}
        onClose={() => {
          if (!isDownloading) setIsModalOpen(false);
        }}
        title="동영상 다운로드 중"
      >
        <div className="flex flex-col items-center text-center gap-5 py-2 select-none">
          {!downloadCompleted ? (
            <>
              <div className="relative flex items-center justify-center my-2">
                <svg
                  height="160"
                  width="160"
                  className="transform -rotate-90"
                >
                  <circle
                    stroke="var(--card-border)"
                    fill="transparent"
                    strokeWidth="8"
                    r="68"
                    cx="80"
                    cy="80"
                  />
                  <circle
                    stroke="var(--primary)"
                    fill="transparent"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 68}`}
                    strokeDashoffset={`${2 * Math.PI * 68 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    r="68"
                    cx="80"
                    cy="80"
                    className="transition-all duration-300 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-foreground tracking-tight leading-none">{progress}%</span>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">
                    {progress < 40 ? '파일 추출 중' : progress < 70 ? '데이터 수신 중' : progress < 90 ? '파일 결합 처리 중' : '거의 완료...'}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-[280px] mt-2">
                <h4 className="text-base font-extrabold text-foreground truncate px-2" title={videoDetails?.title}>
                  {videoDetails?.title || '미디어 분석 스트림'}
                </h4>
              </div>

              <div className="flex items-center justify-center gap-4 text-xs font-extrabold text-text-muted">
                <span className="flex items-center gap-1 text-primary">
                  <Zap className="w-3.5 h-3.5 fill-primary/10" />
                  {getDownloadStats().speed}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {getDownloadStats().timeLeft}
                </span>
              </div>

              <div className="flex gap-1.5 justify-center flex-wrap max-w-sm mt-1">
                {getBadges().map((badge, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-accent border border-card-border px-3.5 py-1.5 rounded-full text-[11px] font-extrabold text-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                    <span>{badge.text}</span>
                  </div>
                ))}
              </div>

              <div className="w-full mt-5 pt-4 border-t border-card-border">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsMinimized(true);
                  }}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 px-6 rounded-2xl cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/10 text-xs tracking-wider uppercase"
                >
                  <Minimize2 className="w-4 h-4 stroke-[3px]" />
                  백그라운드 최소화
                </button>
              </div>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center my-3"
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </motion.div>

              <div className="flex flex-col gap-1.5">
                <h4 className="text-lg font-black text-foreground">안전하게 다운로드가 완료되었습니다</h4>
                <p className="text-sm text-text-muted leading-normal max-w-xs mx-auto">
                  브라우저의 파일 저장 폴더를 확인해 주세요.
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full bg-accent hover:bg-card-border text-foreground font-extrabold py-3.5 px-4 rounded-xl cursor-pointer transition-colors duration-200 mt-2 border border-card-border"
              >
                확인
              </button>
            </>
          )}
        </div>
      </ResponsiveModal>

      <AnimatePresence>
        {isMinimized && isDownloading && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 w-80 bg-card border border-card-border rounded-2xl p-4 shadow-premium backdrop-blur-md flex items-center gap-3.5 select-none"
          >
            <div className="relative w-11 h-11 shrink-0 flex items-center justify-center bg-accent rounded-full border border-card-border">
              <span className="text-[10px] font-black text-foreground">{progress}%</span>
              <motion.div
                className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-xs font-black text-foreground truncate block text-left">
                {videoDetails?.title || '미디어 다운로드 진행 중...'}
              </span>
              <span className="text-[10px] text-text-muted font-bold mt-0.5 text-left">
                {getDownloadStats().speed} • {getDownloadStats().timeLeft}
              </span>
            </div>

            {/* 복원 버튼 */}
            <button
              onClick={() => {
                setIsMinimized(false);
                setIsModalOpen(true);
              }}
              className="p-2 bg-primary hover:bg-primary-hover text-white font-extrabold rounded-xl transition-all active:scale-90 cursor-pointer shadow-md"
              title="원래 크기로 복원"
            >
              <Maximize2 className="w-3.5 h-3.5 stroke-[2.5px]" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

