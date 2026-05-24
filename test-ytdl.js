/* eslint-disable @typescript-eslint/no-require-imports */
const ytdl = require('@distube/ytdl-core');


async function test() {
  const url = 'https://www.youtube.com/watch?v=mNEUkkoUoIA';
  console.log('Testing URL in project folder with valid video:', url);
  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      }
    });
    console.log('Video Title:', info.videoDetails.title);
    console.log('Formats count:', info.formats.length);
    console.log('First 3 formats:', info.formats.slice(0, 3).map(f => ({
      itag: f.itag,
      quality: f.qualityLabel,
      container: f.container,
      hasVideo: f.hasVideo,
      hasAudio: f.hasAudio,
      mimeType: f.mimeType
    })));
  } catch (error) {
    console.error('Error occurred:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

test();
