/**
 * Prepares a post's video for the site and for the newsletter.
 *
 *   node scripts/video-assets.mjs <video.mp4> <slug> [--at 37]
 *
 * Writes to public/media/<slug>/:
 *   video.mp4          the file the <Video> player streams (faststart)
 *   poster.jpg         the frame at --at seconds, shown before playback
 *   email-poster.jpg   the same frame with a play button and duration baked in.
 *                      Email clients do not play video, so the newsletter shows
 *                      this image and links it to the player on the page.
 *   video.json         duration and size, read by scripts/newsletter.mjs
 *
 * Cloudflare Pages refuses any single file over 25 MiB, so anything larger is
 * re-encoded rather than copied.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [src, slugArg] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--at');
const atIx = process.argv.indexOf('--at');
const AT = atIx > -1 ? Number(process.argv[atIx + 1]) : null;
if (!src || !slugArg) {
  console.error('usage: node scripts/video-assets.mjs <video.mp4> <slug> [--at seconds]');
  process.exit(1);
}
const slug = slugArg.toLowerCase();
const ROOT = new URL('..', import.meta.url).pathname;
const out = join(ROOT, 'public/media', slug);
mkdirSync(out, { recursive: true });

const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height:format=duration', '-of', 'json', src]).toString());
const duration = Number(probe.format.duration);
const { width, height } = probe.streams[0];
const at = AT ?? Math.round(duration * 0.7);

const LIMIT = 24 * 1024 * 1024;
const video = join(out, 'video.mp4');
if (statSync(src).size <= LIMIT) {
  // Remux only: same streams, moov atom moved up front so playback starts
  // before the whole file has downloaded.
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-c', 'copy', '-movflags', '+faststart', video]);
} else {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-c:v', 'libx264', '-crf', '24',
    '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', video]);
}

const frame = execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(at), '-i', src,
  '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-']);
await sharp(frame).resize(1600).jpeg({ quality: 84, mozjpeg: true }).toFile(join(out, 'poster.jpg'));

// The email poster: 1200 wide so it is sharp at 600 CSS px on a retina phone.
const W = 1200, H = Math.round(W * height / width);
const mmss = `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}`;
const cx = W / 2, cy = H / 2, r = 76;  // sized for a ~340px-wide phone render
const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="v" cx="50%" cy="50%" r="60%">
      <stop offset="0" stop-color="#050C0F" stop-opacity=".38"/>
      <stop offset="1" stop-color="#050C0F" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#45B5ED"/><stop offset=".55" stop-color="#208EC5"/><stop offset="1" stop-color="#2F6FE8"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#v)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#050C0F" fill-opacity=".62"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#ring)" stroke-width="3.5"/>
  <path d="M ${cx - 20} ${cy - 30} L ${cx + 33} ${cy} L ${cx - 20} ${cy + 30} Z" fill="#DEEAEC"/>
  <rect x="${W - 166}" y="${H - 84}" width="132" height="54" rx="27" fill="#050C0F" fill-opacity=".72"/>
  <text x="${W - 100}" y="${H - 48}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="26" font-weight="500" fill="#DEEAEC" letter-spacing=".5">${mmss}</text>
</svg>`);
await sharp(frame).resize(W, H).composite([{ input: overlay }])
  .jpeg({ quality: 82, mozjpeg: true }).toFile(join(out, 'email-poster.jpg'));

writeFileSync(join(out, 'video.json'), JSON.stringify({ duration: Math.round(duration), width, height, posterAt: at }, null, 2) + '\n');

const mb = (statSync(video).size / 1048576).toFixed(1);
console.log(`video-assets: public/media/${slug}/ (video ${mb} MB, ${mmss}, poster at ${at}s)

Front matter:
  video: /media/${slug}/video.mp4

In the MDX body, where the video belongs:
  import Video from "@/components/Video.astro";
  <Video src="/media/${slug}/video.mp4" caption="..." />`);
