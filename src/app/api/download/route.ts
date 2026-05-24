import { NextRequest, NextResponse } from 'next/server';
import { spawn, execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import { Readable } from 'stream';

const execFilePromise = promisify(execFile);

// YouTube URL 유효성 검사 헬퍼
function getYoutubeVideoId(url: string): string {
  if (!url) return '';
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : '';
}

function validateYoutubeUrl(url: string): boolean {
  return getYoutubeVideoId(url).length === 11;
}

// 주기적인 백그라운드 고아 임시 파일 가비지 컬렉터 (3시간 이상 경과된 파일 삭제)
function cleanupOrphanedTempFiles() {
  try {
    const tempDir = path.join(os.tmpdir(), 'cuttube-downloads');
    if (!fs.existsSync(tempDir)) return;
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = 1000 * 60 * 60 * 3; // 3시간
    
    for (const file of files) {
      if (file.startsWith('download_') || file.startsWith('trim_') || file.startsWith('stitch_')) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          console.log(`[GC] Cleaning up orphaned temp file: ${file}`);
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
      }
    }
  } catch (e) {
    console.error('[GC] Error cleaning up temp files:', e);
  }
}




// 대용량 파일 스트리밍 응답 헬퍼 (OOM 방지를 위한 백프레셔 제어)
function createStreamResponse(filePath: string, filename: string, contentType: string): Response {
  const stats = fs.statSync(filePath);
  const nodeStream = fs.createReadStream(filePath);

  // V8 JS 힙 가비지 생성을 원천 제거하기 위해 C++ 네이티브 스트림 변환(toWeb) 활용
  // 이 방식은 메모리 버핑이나 JS 가비지 컬렉션 부하가 없어 OOM이 완벽히 방지됩니다.
  const webStream = Readable.toWeb(nodeStream);

  // 스트림 전송 완료 또는 클라이언트 중도 취소 시 임시 파일을 안전하게 삭제하기 위한 리스너 등록
  nodeStream.on('close', () => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch { /* ignore */ }
  });

  const headers = new Headers();
  headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(stats.size));

  return new Response(webStream as unknown as ReadableStream, { status: 200, headers });
}

interface DownloadRequestPayload {
  url: string;
  itag: number;
  formatId: string;
  title: string;
  quality: string;
  startTime?: string;
  duration?: number;
  isTrim?: boolean;
  isMergeNeeded?: boolean;
  isStitch?: boolean;
  segments?: any[];
}

async function processDownloadRequest(payload: DownloadRequestPayload): Promise<Response> {
  const { 
    url, 
    itag, 
    formatId, 
    title, 
    quality, 
    startTime, 
    duration, 
    isTrim, 
    isMergeNeeded: isMergeNeededFromClient,
    isStitch,
    segments
  } = payload;

  try {
    if (!url || (!itag && !formatId)) {
      return NextResponse.json({ error: '유튜브 URL과 포맷 식별자(formatId 또는 itag)가 필요합니다.' }, { status: 400 });
    }

    if (!validateYoutubeUrl(url)) {
      return NextResponse.json({ error: '유효하지 않은 유튜브 URL입니다. 주소를 다시 확인해 주세요.' }, { status: 400 });
    }

    // 오래된 고아 임시 파일 자동 클린업 (비동기 수행)
    cleanupOrphanedTempFiles();

    // Secure base directory and external binary executable paths
    const binDir = path.join(process.cwd(), 'bin');
    const ytDlpPath = path.join(binDir, 'yt-dlp.exe');
    const ffmpegPath = path.join(binDir, 'ffmpeg.exe');

    // OS 임시 폴더에 전용 서브디렉토리 생성 (프로젝트 내부에서 생성 시 Turbopack HMR이 감지하여 OOM 유발)
    const tempDir = path.join(os.tmpdir(), 'cuttube-downloads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Sanitize output file name
    const sanitizedTitle = (title || 'video')
      .replace(/[\\/:*?"<>|]/g, '')
      .trim();

    const isAudio = quality?.includes('음원') || String(formatId).includes('audio') || String(itag).includes('audio');
    const extension = isAudio ? 'mp3' : 'mp4';
    const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';

    const cleanQuality = (quality || '')
      .replace(/\s*\(고화질 원본\)\s*/g, '')
      .replace(/\s*\(MP3 추출\)\s*/g, '')
      .replace(/\s*\(AI Shorts Cut\)\s*/g, '')
      .replace(/\s*\(AI Shorts Stitch\)\s*/g, '')
      .trim();
      
    // Stitch모드 또는 일반 Trim모드 전용 꼬리표 생성
    let trimSuffix = '';
    if (isStitch && Array.isArray(segments)) {
      trimSuffix = `_stitched_${segments.length}parts`;
    } else if (isTrim && startTime && duration) {
      trimSuffix = `_trim_${startTime.replace(/:/g, '-')}_${duration}s`;
    }

    const filename = `${sanitizedTitle}${trimSuffix}.${extension}`;

    const isMergeNeeded = isMergeNeededFromClient !== undefined 
      ? isMergeNeededFromClient 
      : (quality?.includes('원본 병합') || quality?.includes('고화질 원본') || quality?.includes('원본') || quality?.includes('1080p') || quality?.includes('1440p') || quality?.includes('2160p'));

    // 모든 다운로드는 안정적인 파일 기반 처리 후 스트리밍 전송 방식으로 통일

    // --- CASE A-1: Stitch (Multi-segment Concat/짜집기) Mode ---
    if (isStitch && Array.isArray(segments) && segments.length >= 2) {
      console.log(`[Stitch Mode] Starting multi-segment trim and stitch. Count: ${segments.length}`);

      const targetFormatId = formatId || String(itag);
      const formatQuery = isMergeNeeded ? `${targetFormatId}+bestaudio/best` : targetFormatId;

      // Extract raw stream direct CDN URLs
      const { stdout } = await execFilePromise(ytDlpPath, ['-g', '-f', formatQuery, url], {
        env: {
          ...process.env,
          PATH: `${binDir};${process.env.PATH || ''}`
        }
      });
      const urls = stdout.trim().split('\n');

      if (!urls || urls.length === 0 || !urls[0]) {
        throw new Error('스트리밍 직접 주소를 획득하지 못했습니다.');
      }

      const tempFiles: string[] = [];
      const stitchSessionId = `stitch_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // 1. 각 세그먼트별 개별 자르기 동기/비동기 실행
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segmentFilePath = path.join(tempDir, `${stitchSessionId}_seg_${i}.${extension}`);
        tempFiles.push(segmentFilePath);

        const ffmpegArgs: string[] = [];
        if (urls.length >= 2 && isMergeNeeded) {
          const videoUrl = urls[0].trim();
          const audioUrl = urls[1].trim();

          ffmpegArgs.push(
            '-ss', String(seg.startTime),
            '-i', videoUrl,
            '-ss', String(seg.startTime),
            '-i', audioUrl,
            '-t', String(seg.duration),
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '22',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-avoid_negative_ts', 'make_zero',
            '-f', 'mp4',
            '-y',
            segmentFilePath
          );
        } else {
          const singleUrl = urls[0].trim();
          if (isAudio) {
            ffmpegArgs.push(
              '-ss', String(seg.startTime),
              '-i', singleUrl,
              '-t', String(seg.duration),
              '-c:a', 'libmp3lame',
              '-ab', '192k',
              '-f', 'mp3',
              '-y',
              segmentFilePath
            );
          } else {
            ffmpegArgs.push(
              '-ss', String(seg.startTime),
              '-i', singleUrl,
              '-t', String(seg.duration),
              '-c:v', 'libx264',
              '-preset', 'ultrafast',
              '-crf', '22',
              '-c:a', 'aac',
              '-b:a', '192k',
              '-avoid_negative_ts', 'make_zero',
              '-f', 'mp4',
              '-y',
              segmentFilePath
            );
          }
        }

        console.log(`[Stitch Mode] Downloading Segment ${i}: ss=${seg.startTime}, duration=${seg.duration}s`);

        await new Promise<void>((resolve, reject) => {
          const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
          ffmpegProcess.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg segment ${i} exited with code ${code}`));
          });
          ffmpegProcess.on('error', reject);
        });

        if (!fs.existsSync(segmentFilePath)) {
          throw new Error(`세그먼트 ${i} 파일 생성 실패: ${segmentFilePath}`);
        }
      }

      // 2. Concat 텍스트 목록 생성 (슬래시 처리 적용)
      const concatListPath = path.join(tempDir, `${stitchSessionId}_list.txt`);
      const concatContent = tempFiles
        .map(f => `file '${f.replace(/\\/g, '/')}'`)
        .join('\n');
      fs.writeFileSync(concatListPath, concatContent, 'utf-8');

      // 3. Concat 실행 (재인코딩 없이 1초 초고속 무손실 병합)
      const finalStitchPath = path.join(tempDir, `${stitchSessionId}_final.${extension}`);
      const concatArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        finalStitchPath
      ];

      console.log('[Stitch Mode] Merging segments: ', concatArgs);

      await new Promise<void>((resolve, reject) => {
        const concatProcess = spawn(ffmpegPath, concatArgs);
        concatProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg concat exited with code ${code}`));
        });
        concatProcess.on('error', reject);
      });

      if (!fs.existsSync(finalStitchPath)) {
        throw new Error('합치기 결과 최종 파일 생성에 실패했습니다.');
      }

      console.log(`[Stitch Mode] Concat Success: ${finalStitchPath} (${fs.statSync(finalStitchPath).size} bytes)`);

      // 병합 완료 후 세그먼트 및 목록 텍스트 삭제
      try {
        fs.unlinkSync(concatListPath);
        for (const file of tempFiles) {
          fs.unlinkSync(file);
        }
      } catch (err) {
        console.warn('[Stitch Mode] Cleanup warnings:', err);
      }

      return createStreamResponse(finalStitchPath, filename, contentType);
    }

    // --- CASE A-2: Remote Slice Trim Mode (일반 단일 자르기) ---
    if (isTrim && startTime && duration) {
      console.log(`Starting Remote Trim Download: startTime=${startTime}, duration=${duration}s`);
      
      const targetFormatId = formatId || String(itag);
      const formatQuery = isMergeNeeded ? `${targetFormatId}+bestaudio/best` : targetFormatId;

      // Extract raw stream direct CDN URLs
      const { stdout } = await execFilePromise(ytDlpPath, ['-g', '-f', formatQuery, url], {
        env: {
          ...process.env,
          PATH: `${binDir};${process.env.PATH || ''}`
        }
      });
      const urls = stdout.trim().split('\n');

      if (!urls || urls.length === 0 || !urls[0]) {
        throw new Error('스트리밍 직접 주소를 획득하지 못했습니다.');
      }

      const tempBaseName = `trim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const actualFilePath = path.join(tempDir, `${tempBaseName}.${extension}`);

      const ffmpegArgs: string[] = [];

      if (urls.length >= 2 && isMergeNeeded) {
        const videoUrl = urls[0].trim();
        const audioUrl = urls[1].trim();

        ffmpegArgs.push(
          '-ss', startTime,
          '-i', videoUrl,
          '-ss', startTime,
          '-i', audioUrl,
          '-t', String(duration),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '22',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-avoid_negative_ts', 'make_zero',
          '-f', 'mp4',
          '-y',
          actualFilePath
        );
      } else {
        const singleUrl = urls[0].trim();

        if (isAudio) {
          ffmpegArgs.push(
            '-ss', startTime,
            '-i', singleUrl,
            '-t', String(duration),
            '-c:a', 'libmp3lame',
            '-ab', '192k',
            '-f', 'mp3',
            '-y',
            actualFilePath
          );
        } else {
          ffmpegArgs.push(
            '-ss', startTime,
            '-i', singleUrl,
            '-t', String(duration),
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '22',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-avoid_negative_ts', 'make_zero',
            '-f', 'mp4',
            '-y',
            actualFilePath
          );
        }
      }

      console.log('Spawning ffmpeg to local file with arguments:', ffmpegArgs);

      await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
        
        ffmpegProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}`));
        });

        ffmpegProcess.on('error', (err) => {
          reject(err);
        });

        ffmpegProcess.stderr.on('data', (data: Buffer) => {
          const logMsg = data.toString();
          if (logMsg.includes('Error') || logMsg.includes('Invalid')) {
            console.error('ffmpeg stderr:', logMsg);
          }
        });
      });

      if (!fs.existsSync(actualFilePath)) {
        throw new Error('구간 자르기 임시 파일을 찾을 수 없습니다.');
      }

      console.log(`[Trim DL] Complete: ${actualFilePath} (${fs.statSync(actualFilePath).size} bytes)`);
      return createStreamResponse(actualFilePath, filename, contentType);
    }

    // --- CASE B: Normal Full Download Mode (전체 다운로드) ---
    const tempBaseName = `download_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const actualFilePath = path.join(tempDir, `${tempBaseName}.${extension}`);
    
    const processEnv = {
      ...process.env,
      PATH: `${binDir};${process.env.PATH || ''}`
    };

    if (isMergeNeeded) {
      const targetFormatId = formatId || String(itag);
      const formatQuery = `${targetFormatId}+bestaudio/best`;

      console.log(`[Full DL] Downloading & merging via yt-dlp: ${formatQuery} -> ${actualFilePath}`);

      const tempOutPathTemplate = path.join(tempDir, `${tempBaseName}.%(ext)s`);
      const args = [
        '-f', formatQuery,
        '--ffmpeg-location', ffmpegPath,
        '-o', tempOutPathTemplate,
        '--merge-output-format', 'mp4',
        '--no-part',
        url
      ];

      await new Promise<void>((resolve, reject) => {
        const ytDlpProcess = spawn(ytDlpPath, args, { env: processEnv });
        
        ytDlpProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited with code ${code}`));
        });

        ytDlpProcess.on('error', reject);

        ytDlpProcess.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.includes('[download]') || line.includes('[Merger]')) {
              console.log(line.trim());
            }
          }
        });
      });
    } else if (isAudio) {
      const targetFormatId = formatId || String(itag);
      const { stdout } = await execFilePromise(ytDlpPath, ['-g', '-f', targetFormatId, url], { env: processEnv });
      const audioUrl = stdout.trim();

      const ffmpegArgs = [
        '-i', audioUrl,
        '-c:a', 'libmp3lame',
        '-ab', '192k',
        '-f', 'mp3',
        '-y',
        actualFilePath
      ];

      await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
        ffmpegProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}`));
        });
        ffmpegProcess.on('error', reject);
      });
    } else {
      const tempFileTemplate = path.join(tempDir, `${tempBaseName}.%(ext)s`);
      const args = ['-f', formatId || String(itag), '-o', tempFileTemplate, '--no-part', url];
      
      await new Promise<void>((resolve, reject) => {
        const ytDlpProcess = spawn(ytDlpPath, args, { env: processEnv });
        ytDlpProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited with code ${code}`));
        });
        ytDlpProcess.on('error', reject);
      });

      const files = fs.readdirSync(tempDir);
      const found = files.find((f: string) => f.startsWith(tempBaseName));
      if (found) {
        const ytdlpFile = path.join(tempDir, found);
        fs.renameSync(ytdlpFile, actualFilePath);
      }
    }

    if (!fs.existsSync(actualFilePath)) {
      throw new Error('다운로드된 파일을 찾을 수 없습니다.');
    }

    console.log(`[Full DL] Complete: ${actualFilePath} (${fs.statSync(actualFilePath).size} bytes)`);
    return createStreamResponse(actualFilePath, filename, contentType);
  } catch (error: unknown) {
    console.error('Download processing error:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: '영상을 다운로드하는 과정에서 오작동이 발생했습니다: ' + errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  return processDownloadRequest(payload);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const url = searchParams.get('url') || '';
  const itag = Number(searchParams.get('itag') || 0);
  const formatId = searchParams.get('formatId') || '';
  const title = searchParams.get('title') || 'video';
  const quality = searchParams.get('quality') || '';
  const startTime = searchParams.get('startTime') || undefined;
  const duration = searchParams.get('duration') ? Number(searchParams.get('duration')) : undefined;
  const isTrim = searchParams.get('isTrim') === 'true';
  const isMergeNeeded = searchParams.get('isMergeNeeded') === 'true';
  const isStitch = searchParams.get('isStitch') === 'true';
  
  const segmentsStr = searchParams.get('segments');
  let segments = undefined;
  if (segmentsStr) {
    try {
      segments = JSON.parse(decodeURIComponent(segmentsStr));
    } catch (e) {
      console.error('Failed to parse segments from query string:', e);
    }
  }

  const payload: DownloadRequestPayload = {
    url,
    itag,
    formatId,
    title,
    quality,
    startTime,
    duration,
    isTrim,
    isMergeNeeded,
    isStitch,
    segments
  };

  return processDownloadRequest(payload);
}
