import { NextRequest, NextResponse } from 'next/server';
import { spawn, execFile } from 'child_process';
import path from 'path';
import promisify from 'util';
import fs from 'fs';

const execFilePromise = promisify.promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const { url, itag, formatId, title, quality, startTime, duration, isTrim, isMergeNeeded: isMergeNeededFromClient } = await request.json();

    if (!url || (!itag && !formatId)) {
      return NextResponse.json({ error: '유튜브 URL과 포맷 식별자(formatId 또는 itag)가 필요합니다.' }, { status: 400 });
    }

    // Secure base directory and external binary executable paths
    const binDir = path.join(process.cwd(), 'bin');
    const ytDlpPath = path.join(binDir, 'yt-dlp.exe');
    const ffmpegPath = path.join(binDir, 'ffmpeg.exe');

    const tempDir = path.join(process.cwd(), 'temp');
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
      .trim();
      
    const trimSuffix = isTrim && startTime && duration ? `_trim_${startTime.replace(/:/g, '-')}_${duration}s` : '';
    const filename = `${sanitizedTitle}_${cleanQuality || formatId || itag}${trimSuffix}.${extension}`;

    // --- CASE A: Remote Slice Trim Mode ---
    if (isTrim && startTime && duration) {
      console.log(`Starting Remote Trim Download: startTime=${startTime}, duration=${duration}s`);
      
      const isMergeNeeded = isMergeNeededFromClient !== undefined 
        ? isMergeNeededFromClient 
        : (quality?.includes('원본 병합') || quality?.includes('고화질 원본') || quality?.includes('원본') || quality?.includes('1080p') || quality?.includes('1440p') || quality?.includes('2160p'));
      const targetFormatId = formatId || String(itag);
      const formatQuery = isMergeNeeded ? `${targetFormatId}+bestaudio/best` : targetFormatId;

      // Extract raw stream direct CDN URLs (zero network egress cost)
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

        // Use hybrid seeking & libx264 re-encoding for frame accuracy
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
          actualFilePath // Output to local physical file to guarantee container integrity
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

      // Run ffmpeg and wait for completed physical file compilation
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

      const fileBuffer = fs.readFileSync(actualFilePath);
      const stats = fs.statSync(actualFilePath);

      // Instantly delete file from server disk to save space
      try {
        fs.unlinkSync(actualFilePath);
        console.log(`Cleaned up temp trim file: ${actualFilePath}`);
      } catch (unlinkErr) {
        console.error('Failed to delete temp trim file:', unlinkErr);
      }

      const headers = new Headers();
      headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      headers.set('Content-Type', contentType);
      headers.set('Content-Length', String(stats.size));

      return new Response(fileBuffer, {
        status: 200,
        headers: headers,
      });
    }

    // --- CASE B: Normal Full Download Mode ---
    // ROOT CAUSE FIX (from GitHub/Reddit/StackOverflow community research):
    // yt-dlp's internal merge silently FAILS when YouTube serves VP9/AV1 video + Opus audio
    // because these codecs are incompatible with the MP4 container. yt-dlp just saves the
    // video-only stream without error (exit code 0), producing a silent file.
    // SOLUTION: Use the same proven direct-ffmpeg approach that works for trim downloads.
    // We get raw CDN URLs via `yt-dlp -g`, then use ffmpeg directly to download+merge+re-encode.

    const isMergeNeeded = isMergeNeededFromClient !== undefined 
      ? isMergeNeededFromClient 
      : (quality?.includes('원본 병합') || quality?.includes('고화질 원본') || quality?.includes('원본') || quality?.includes('1080p') || quality?.includes('1440p') || quality?.includes('2160p'));

    const tempBaseName = `download_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const actualFilePath = path.join(tempDir, `${tempBaseName}.${extension}`);
    
    const processEnv = {
      ...process.env,
      PATH: `${binDir};${process.env.PATH || ''}`
    };

    if (isMergeNeeded) {
      // Strategy: Direct ffmpeg merge (bypasses yt-dlp's broken internal merge)
      const targetFormatId = formatId || String(itag);
      const formatQuery = `${targetFormatId}+bestaudio/best`;

      console.log(`[Full DL] Extracting CDN URLs for format: ${formatQuery}`);
      const { stdout } = await execFilePromise(ytDlpPath, ['-g', '-f', formatQuery, url], { env: processEnv });
      const cdnUrls = stdout.trim().split('\n');

      if (!cdnUrls || cdnUrls.length < 2 || !cdnUrls[0] || !cdnUrls[1]) {
        throw new Error('비디오/오디오 스트리밍 주소를 획득하지 못했습니다.');
      }

      const videoUrl = cdnUrls[0].trim();
      const audioUrl = cdnUrls[1].trim();

      console.log(`[Full DL] Merging via direct ffmpeg: video + audio -> ${actualFilePath}`);

      const ffmpegArgs = [
        '-i', videoUrl,
        '-i', audioUrl,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',  // Place moov atom at file start for instant playback
        '-f', 'mp4',
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
        ffmpegProcess.stderr.on('data', (data: Buffer) => {
          const msg = data.toString();
          if (msg.includes('Error') || msg.includes('Invalid')) {
            console.error('ffmpeg stderr:', msg);
          }
        });
      });
    } else if (isAudio) {
      // Audio-only: use yt-dlp to get URL, then ffmpeg to extract MP3
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
      // Single already-merged stream (rare): yt-dlp direct download
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

      // Find the actual file yt-dlp created
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

    const fileBuffer = fs.readFileSync(actualFilePath);
    const stats = fs.statSync(actualFilePath);

    console.log(`[Full DL] Complete: ${actualFilePath} (${stats.size} bytes)`);

    try {
      fs.unlinkSync(actualFilePath);
    } catch (unlinkErr) {
      console.error('Failed to delete temp file:', unlinkErr);
    }

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', String(stats.size));

    return new Response(fileBuffer, {
      status: 200,
      headers: headers,
    });
  } catch (error: any) {
    console.error('Download processing error:', error);
    return NextResponse.json(
      { error: '영상을 다운로드하는 과정에서 오작동이 발생했습니다: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
