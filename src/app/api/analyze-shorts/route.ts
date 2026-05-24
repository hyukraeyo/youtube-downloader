import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

// 유튜브 비디오 ID 추출 헬퍼 함수
function getYoutubeVideoId(url: string): string {
  if (!url) return '';
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : '';
}

// 시간 포맷팅 헬퍼 함수 (초 -> MM:SS 또는 HH:MM:SS)
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');
  
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

// ------------------------------------------
// 캐시 저장을 위한 인터페이스 및 변수 정의 (메모리 누수 방지 & 고성능)
// ------------------------------------------

// 1. 모델 가용성 캐시
interface ModelCache {
  model: string;
  apiVersion: string;
  timestamp: number;
}
const MODEL_CACHE_TTL = 1000 * 60 * 60; // 1시간 캐시
let cachedModel: ModelCache | null = null;

// 2. 자막 데이터 캐시 (videoId -> { data, timestamp })
interface TranscriptCache {
  data: any[];
  timestamp: number;
}
const transcriptCache = new Map<string, TranscriptCache>();
const TRANSCRIPT_CACHE_TTL = 1000 * 60 * 60 * 12; // 12시간 캐시

// 3. 분석 결과 캐시 (videoId -> { recommendations, timestamp })
interface AnalysisCache {
  recommendations: any[];
  timestamp: number;
}
const analysisCache = new Map<string, AnalysisCache>();
const ANALYSIS_CACHE_TTL = 1000 * 60 * 60 * 24; // 24시간 캐시

// 사용 가능한 모델을 자동으로 탐색하는 함수 (캐시 적용)
async function findAvailableModel(apiKey: string): Promise<{ model: string; apiVersion: string }> {
  const now = Date.now();
  if (cachedModel && (now - cachedModel.timestamp < MODEL_CACHE_TTL)) {
    console.log(`[Model Discovery] ⚡ 캐시 히트: ${cachedModel.model} (${cachedModel.apiVersion})`);
    return { model: cachedModel.model, apiVersion: cachedModel.apiVersion };
  }

  const candidates = [
    { model: 'gemini-3.5-flash', apiVersion: 'v1beta' },
    { model: 'gemini-flash-latest', apiVersion: 'v1beta' },
    { model: 'gemini-3.1-flash-lite', apiVersion: 'v1beta' },
    { model: 'gemini-flash-lite-latest', apiVersion: 'v1beta' },
    { model: 'gemini-3-flash-preview', apiVersion: 'v1beta' },
    { model: 'gemini-3.1-pro-preview', apiVersion: 'v1beta' },
    { model: 'gemini-pro-latest', apiVersion: 'v1beta' },
    { model: 'gemini-2.5-flash', apiVersion: 'v1beta' },
    { model: 'gemini-2.0-flash', apiVersion: 'v1beta' },
  ];

  for (const candidate of candidates) {
    try {
      const checkUrl = `https://generativelanguage.googleapis.com/${candidate.apiVersion}/models/${candidate.model}?key=${apiKey}`;
      const res = await fetch(checkUrl, { method: 'GET' });
      if (res.ok) {
        const modelInfo = await res.json();
        const methods: string[] = modelInfo.supportedGenerationMethods || [];
        if (methods.includes('generateContent')) {
          console.log(`[Model Discovery] ✅ 새로 탐색 완료 & 캐싱: ${candidate.model} (${candidate.apiVersion})`);
          cachedModel = {
            model: candidate.model,
            apiVersion: candidate.apiVersion,
            timestamp: now
          };
          return candidate;
        }
      }
    } catch {
      // 다음 후보 시도
    }
  }

  throw new Error('사용 가능한 Gemini 모델을 찾을 수 없습니다. API Key를 확인해 주세요.');
}

// Gemini REST API 직접 호출 함수
async function callGeminiAPI(apiKey: string, modelName: string, apiVersion: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
  
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    }
  };

  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // responseMimeType 미지원 시 제거 후 재시도
  if (!res.ok && res.status === 400) {
    const fallbackBody = {
      contents: body.contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
    };
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fallbackBody),
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Gemini API 호출 실패 (${res.status}): ${errData?.error?.message || 'Unknown'}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API에서 유효한 응답을 받지 못했습니다.');
  }
  return text.trim();
}

// AI 응답에서 JSON 배열을 안전하게 추출
function extractJSON(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/m, '').replace(/\n?\s*```\s*$/m, '').trim();
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) return `[${objectMatch[0]}]`;
  return cleaned;
}

// 자막 텍스트 압축 함수 (토큰 낭비 방지)
function compressTranscript(transcript: string): string {
  if (!transcript) return '';
  
  // 1. 무의미하거나 노이즈가 되는 메타 텍스트 제거 ([음악], (웃음) 등)
  let cleaned = transcript.replace(/\[(?:음악|웃음|박수|비명|소음|대화|노래|한숨|music|applause|laughter|screaming|sigh|cough|throat-clearing|chuckle)\]/gi, '');
  cleaned = cleaned.replace(/\((?:음악|웃음|박수|비명|소음|대화|노래|한숨|music|applause|laughter|screaming|sigh|cough|throat-clearing|chuckle)\)/gi, '');
  
  // 2. 각 라인별 특수 기호 및 공백 정규화
  const lines = cleaned.split('\n')
    .map(line => {
      const match = line.match(/^(\[\d{2}:\d{2}(?::\d{2})?\])\s*(.*)$/);
      if (!match) return '';
      
      const timePart = match[1];
      const textPart = match[2].trim()
        .replace(/\s+/g, ' ') // 연속 공백 축소
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ''); // 문맥에 지장 없는 문장 부호 제거로 글자수 감소
        
      if (!textPart) return '';
      return `${timePart} ${textPart}`;
    })
    .filter(Boolean);

  // 3. 자막이 너무 길어 25,000자를 극도로 초과하는 경우, 토큰 폭발을 막기 위해 5글자 이하 짧은 라인들을 지능적으로 걸러냄
  let finalResult = lines.join('\n');
  if (finalResult.length > 25000) {
    console.log(`[Transcript Compress] 자막 길이 초과(${finalResult.length}자). 지능형 압축 필터링을 가동합니다.`);
    const optimized = lines.filter(line => {
      const content = line.replace(/^\[\d{2}:\d{2}(?::\d{2})?\]\s*/, '');
      return content.length >= 5; // 극히 짧은 단답형 리액션 제외
    });
    finalResult = optimized.join('\n');
    console.log(`[Transcript Compress] 압축 완료 -> ${finalResult.length}자`);
  }

  return finalResult;
}

export async function POST(request: NextRequest) {
  try {
    const { url, customApiKey, lengthSeconds, forceRefresh } = await request.json();

    if (!url) {
      return NextResponse.json({ error: '유튜브 URL을 입력해주세요.' }, { status: 400 });
    }

    const videoId = getYoutubeVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: '유효하지 않은 유튜브 URL입니다.' }, { status: 400 });
    }

    const now = Date.now();

    // 0. 분석 결과 캐시 체크 (forceRefresh가 true가 아닐 때만 적용)
    if (!forceRefresh && analysisCache.has(videoId)) {
      const cached = analysisCache.get(videoId)!;
      if (now - cached.timestamp < ANALYSIS_CACHE_TTL) {
        console.log(`[Shorts Cache] ⚡ 분석 결과 캐시 히트 (videoId: ${videoId}). AI 호출을 생략합니다.`);
        return NextResponse.json({ success: true, recommendations: cached.recommendations, isCached: true });
      }
    }

    // 영상 총 길이 (초 단위)
    const totalDurationSec = lengthSeconds ? parseInt(lengthSeconds, 10) : 0;
    const totalDurationMin = totalDurationSec > 0 ? Math.floor(totalDurationSec / 60) : 0;
    console.log(`[Shorts Analyzer] 영상 총 길이: ${totalDurationSec}초 (${totalDurationMin}분)`);

    // 1. 유튜브 자막 가져오기 (캐시 적용)
    let transcriptData;
    if (transcriptCache.has(videoId)) {
      const cached = transcriptCache.get(videoId)!;
      if (now - cached.timestamp < TRANSCRIPT_CACHE_TTL) {
        transcriptData = cached.data;
        console.log(`[Shorts Cache] ⚡ 자막 데이터 캐시 히트 (videoId: ${videoId})`);
      }
    }

    if (!transcriptData) {
      try {
        transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
        transcriptCache.set(videoId, {
          data: transcriptData,
          timestamp: now
        });
      } catch (err: unknown) {
        console.error('Subtitles fetching failed:', err);
        return NextResponse.json({
          error: '해당 영상에서 자막을 가져올 수 없습니다. 자막이 제공되지 않는 영상일 수 있습니다.'
        }, { status: 400 });
      }
    }

    if (!transcriptData || transcriptData.length === 0) {
      return NextResponse.json({
        error: '자막 데이터가 비어 있습니다.'
      }, { status: 400 });
    }

    // 2. 자막 offset 단위 자동 감지 (밀리초 vs 초) 및 보정
    const lastOffset = transcriptData[transcriptData.length - 1].offset;
    const isMilliseconds = totalDurationSec > 0 && lastOffset > totalDurationSec * 5;
    if (isMilliseconds) {
      console.log(`[Shorts Analyzer] offset이 밀리초로 감지됨 (last: ${lastOffset}, 영상: ${totalDurationSec}초). 보정 적용.`);
    }

    const formattedTranscript = transcriptData.map(t => {
      const offsetSec = isMilliseconds ? t.offset / 1000 : t.offset;
      return `[${formatTime(offsetSec)}] ${t.text}`;
    }).join('\n');

    // 3. 자막 텍스트 압축 리팩토링 (토큰 누수 방지용)
    const compressedTranscript = compressTranscript(formattedTranscript);

    // 디버그 로그
    const lines = compressedTranscript.split('\n');
    console.log(`[Shorts Analyzer] 자막 첫줄: ${lines[0]}`);
    console.log(`[Shorts Analyzer] 자막 끝줄: ${lines[lines.length - 1]}`);
    console.log(`[Shorts Analyzer] 총 ${lines.length}줄 (원본 ${transcriptData.length}줄)`);

    // 4. API Key 확보
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'Gemini API Key가 누락되었습니다. 설정에서 API Key를 입력해 주세요.'
      }, { status: 401 });
    }

    // 5. 모델 탐색 (캐시 적용)
    const { model: modelName, apiVersion } = await findAvailableModel(apiKey);
    console.log(`[Shorts Analyzer] 선택된 모델: ${modelName}`);

    // 6. 프롬프트 구성 (영상 총 길이를 CRITICAL로 명시 + 바이럴 명장면 + 멀티세그먼트 짜집기 스키마 정의)
    const durationConstraint = totalDurationSec > 0
      ? `\nCRITICAL CONSTRAINT: This video is ONLY ${totalDurationMin} minutes (${totalDurationSec} seconds) long. ALL startTime and endTime MUST be between 0 and ${totalDurationSec}. NEVER exceed ${totalDurationSec} seconds. Use ONLY timestamps that exist in the transcript.`
      : '';

    const prompt = `You are an elite YouTube Shorts expert. Analyse the transcript and recommend the absolute best 4 segments to create viral Shorts.

${durationConstraint}

VIRAL ANALYSIS RULES:
- Focus on moments that trigger strong emotions (viral, humor/laughter, deep empathy, heart-warming emotion, shocking plot twist, intense conflict, or highly satisfying resolution).
- Identify what would make people comment, share, or react with "lol", "wow", or "so touching" based on the dialogue context.

RECOMMENDATION TYPES:
- Provide exactly 4 recommendations:
  - 3 Single Highlights (type: "single"): Self-contained high-impact segments (30-60 sec each).
  - 1 Storytelling Stitch (type: "stitch"): A highly engaging stitched/concatenated segment that bridges TWO distant parts of the video to create a complete story (e.g., "Intro/Conflict/Question" in segment 1 + "Resolution/Reveal/Answer" in segment 2). Total combined duration should be under 60 seconds.

RULES:
- 'startTime' and 'endTime' must match actual transcript timestamps (in seconds)
- Keep text fields highly concise and punchy in Korean (title < 50 chars, hook/reason < 80 chars)
- MUST output ONLY JSON array matching the exact structure below, no markdown, no comments.

JSON Schema structure:
[
  {
    "type": "single",
    "title": "Shorts 제목 (유머러스하고 호기심을 유발하는 국문 타이틀)",
    "hook": "초반 3초 후킹 영상 자막/장면 묘사",
    "reason": "바이럴 추천 이유 (유머/공감/감동 등 숏폼 흥행 가치 서술)",
    "startTime": 83,
    "endTime": 125,
    "formattedStart": "01:23",
    "formattedEnd": "02:05"
  },
  {
    "type": "stitch",
    "title": "짜집기 스토리 쇼츠 제목",
    "hook": "짜집기 첫 구간 3초 초강력 후킹 전략",
    "reason": "왜 이 두 구간을 짜집기하면 완벽한 한 편의 반전/감동 스토리가 되는지 설명",
    "segments": [
      {
        "startTime": 120,
        "endTime": 145,
        "formattedStart": "02:00",
        "formattedEnd": "02:25",
        "label": "사건의 시작 또는 의문의 질문"
      },
      {
        "startTime": 620,
        "endTime": 640,
        "formattedStart": "10:20",
        "formattedEnd": "10:40",
        "label": "반전의 사이다 결말 또는 해답"
      }
    ]
  }
]

Transcript:
${compressedTranscript}
`;

    const responseText = await callGeminiAPI(apiKey, modelName, apiVersion, prompt);
    console.log(`[Shorts Analyzer] AI 응답 (500자):`, responseText.substring(0, 500));

    const jsonText = extractJSON(responseText);
    let recommendations;
    try {
      recommendations = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[Shorts Analyzer] JSON 파싱 실패:', jsonText, parseError);
      return NextResponse.json({
        error: 'AI 응답 파싱에 실패했습니다. 잠시 후 다시 시도해 주세요.'
      }, { status: 500 });
    }

    if (!Array.isArray(recommendations)) {
      recommendations = [recommendations];
    }

    // 7. 타임스탬프 검증 및 클램핑 (영상 범위 초과 원천 차단 + stitch 세그먼트들 개별 검증)
    if (totalDurationSec > 0) {
      recommendations = recommendations
        .map((rec: any) => {
          if (rec.type === 'stitch' && Array.isArray(rec.segments)) {
            // 짜집기 세그먼트들 검증
            const verifiedSegments = rec.segments
              .map((seg: { startTime: number; endTime: number; label: string }) => {
                let { startTime, endTime, label } = seg;
                startTime = Math.max(0, Math.min(startTime, totalDurationSec - 5));
                endTime = Math.max(startTime + 5, Math.min(endTime, totalDurationSec));
                return {
                  startTime,
                  endTime,
                  formattedStart: formatTime(startTime),
                  formattedEnd: formatTime(endTime),
                  label: label || '스토리 조각'
                };
              })
              .filter((seg: { startTime: number; endTime: number }) => seg.endTime > seg.startTime);

            return {
              ...rec,
              segments: verifiedSegments
            };
          } else {
            // 일반 단일 세그먼트 검증
            let { startTime, endTime } = rec;
            startTime = Math.max(0, Math.min(startTime || 0, totalDurationSec - 10));
            endTime = Math.max(startTime + 10, Math.min(endTime || 10, totalDurationSec));
            return {
              ...rec,
              startTime,
              endTime,
              formattedStart: formatTime(startTime),
              formattedEnd: formatTime(endTime),
            };
          }
        })
        .filter((rec: any) => {
          if (rec.type === 'stitch') {
            return Array.isArray(rec.segments) && rec.segments.length >= 2;
          }
          return rec.endTime > rec.startTime;
        });
      
      console.log(`[Shorts Analyzer] 검증 완료: ${recommendations.length}개 추천 도출 (${totalDurationSec}초 내)`);
    }

    // 8. 분석 결과 메모리 캐시에 저장
    analysisCache.set(videoId, {
      recommendations,
      timestamp: now
    });

    return NextResponse.json({ success: true, recommendations });

  } catch (error: unknown) {
    console.error('AI Shorts Analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    return NextResponse.json({
      error: '쇼츠 분석 중 오류: ' + errorMessage
    }, { status: 500 });
  }
}
