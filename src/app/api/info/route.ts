import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import promisify from 'util';

const execFilePromise = promisify.promisify(execFile);

// 유튜브 비디오 ID 추출 헬퍼 함수 (일반, 단축, 쇼츠, 임베드 주소 모두 완벽 지원)
function getYoutubeVideoId(url: string): string {
  if (!url) return '';
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : '';
}

// 유튜브 URL 유효성 검사
function validateYoutubeUrl(url: string): boolean {
  return getYoutubeVideoId(url).length === 11;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: '유튜브 URL을 입력해주세요.' }, { status: 400 });
    }

    if (!validateYoutubeUrl(url)) {
      return NextResponse.json({ error: '유효하지 않은 유튜브 URL입니다. 주소를 다시 확인해 주세요.' }, { status: 400 });
    }

    // 프로젝트 루트 및 yt-dlp.exe 절대 경로 확보
    const ytDlpPath = path.join(process.cwd(), 'bin', 'yt-dlp.exe');

    // yt-dlp를 이용하여 비디오 메타데이터를 JSON 형식으로 획득
    const { stdout } = await execFilePromise(ytDlpPath, ['-j', url]);
    const info = JSON.parse(stdout);

    const videoDetails = {
      title: info.title || 'Untitled Video',
      description: (info.description || '').slice(0, 200) + '...',
      thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : ''),
      author: info.uploader || info.channel || 'Unknown Uploader',
      lengthSeconds: String(info.duration || 0),
      viewCount: String(info.view_count || 0),
      url: info.webpage_url || url,
    };

    // 가용한 포맷 분류 및 반환
    interface YtDlpFormat {
      format_id: string;
      format_note?: string;
      ext?: string;
      vcodec?: string;
      acodec?: string;
      fps?: number;
      filesize?: number;
      filesize_approx?: number;
      mimeType?: string;
      height?: number;
      width?: number;
    }

    const rawFormats: YtDlpFormat[] = info.formats || [];

    // Separate all formats into video formats and audio formats
    const videoOnlyOrMerged = rawFormats.filter(f => f.vcodec && f.vcodec !== 'none');
    const audioOnly = rawFormats.filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));

    const processedFormats: any[] = [];

    // 1. Select the SINGLE BEST Video Format
    if (videoOnlyOrMerged.length > 0) {
      // Sort video formats to find the best resolution and quality
      // Prioritize height, then fps, then filesize
      const sortedVideos = [...videoOnlyOrMerged].sort((a, b) => {
        const heightA = a.height || 0;
        const heightB = b.height || 0;
        if (heightB !== heightA) return heightB - heightA;

        const fpsA = a.fps || 0;
        const fpsB = b.fps || 0;
        if (fpsB !== fpsA) return fpsB - fpsA;

        const sizeA = a.filesize || a.filesize_approx || 0;
        const sizeB = b.filesize || b.filesize_approx || 0;
        return sizeB - sizeA;
      });

      const bestVideo = sortedVideos[0];
      const hasAudio = bestVideo.acodec && bestVideo.acodec !== 'none';
      // For vertical videos (Shorts: 1080x1920), height > width.
      // Use Math.min to always show the correct resolution class (e.g. 1080p, not 1920p).
      const rawHeight = bestVideo.height || 720;
      const rawWidth = bestVideo.width || rawHeight;
      const height = Math.min(rawHeight, rawWidth);
      
      // Label the video format clearly as 'Original High Quality'
      const qualityLabel = `${height}p (고화질 원본)`;

      const parsedItag = parseInt(bestVideo.format_id, 10) || Math.abs(bestVideo.format_id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0));
      const sizeBytes = bestVideo.filesize || bestVideo.filesize_approx || 0;

      processedFormats.push({
        itag: parsedItag,
        formatId: bestVideo.format_id,
        quality: qualityLabel,
        container: 'mp4',
        hasVideo: true,
        hasAudio: !!hasAudio, // Truthful representation: false for video-only (DASH) streams, so client knows it must merge audio!
        fps: bestVideo.fps || 0,
        contentLength: String(sizeBytes),
        mimeType: bestVideo.vcodec ? `video/mp4; codecs="${bestVideo.vcodec}"` : 'video/mp4',
      });
    }

    // 2. Select the SINGLE BEST Audio Format
    if (audioOnly.length > 0) {
      const sortedAudios = [...audioOnly].sort((a, b) => {
        const sizeA = a.filesize || a.filesize_approx || 0;
        const sizeB = b.filesize || b.filesize_approx || 0;
        return sizeB - sizeA;
      });

      const bestAudio = sortedAudios[0];
      const parsedItag = parseInt(bestAudio.format_id, 10) || Math.abs(bestAudio.format_id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0));
      const sizeBytes = bestAudio.filesize || bestAudio.filesize_approx || 0;

      processedFormats.push({
        itag: parsedItag,
        formatId: bestAudio.format_id,
        quality: '음원 추출 (MP3)',
        container: 'mp4',
        hasVideo: false,
        hasAudio: true,
        fps: 0,
        contentLength: String(sizeBytes),
        mimeType: 'audio/mp4',
      });
    }

    const sortedFormats = processedFormats;

    return NextResponse.json({
      success: true,
      videoDetails,
      formats: sortedFormats,
    });
  } catch (error: any) {
    console.error('Info fetching error via yt-dlp:', error);
    return NextResponse.json(
      { error: '유튜브 비디오 정보를 추출하는데 실패했습니다. 주소가 유효한지 다시 확인해주세요. 에러: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
