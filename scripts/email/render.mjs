/**
 * The newsletter's body HTML, built from a post's front matter.
 *
 * This is what goes into Kit's `{{ message_content }}`. The surrounding shell
 * (fonts, dark ground, header, footer, unsubscribe) is kit-template.html, which
 * lives in Kit once and is picked by KIT_EMAIL_TEMPLATE_ID.
 *
 * Email is not the web. Everything here is a table, every style that matters is
 * inline, and anything clever has a plain fallback:
 *   - the hero's shader image is a CSS background over a solid #050C0F, so
 *     Outlook (which drops the image) still gets light text on a dark ground;
 *   - the button is a padded link inside a coloured cell, not a <button>;
 *   - video is a poster image linked to the player on the page, because Gmail
 *     and Outlook do not play <video> at all.
 * Width is fluid up to 600px, and kit-template.html carries the phone sizes.
 */
import { marked } from 'marked';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const C = {
  ground: '#050C0F', deep: '#0A2027', peacock: '#208EC5', glow: '#45B5ED', azure: '#2F6FE8',
  text: '#DEEAEC', text2: '#B4C6CA', text3: '#8CA2A6', rule: '#1B2427', onAccent: '#04171B',
};
export const SERIF = "'Newsreader',Georgia,'Times New Roman',serif";
export const SANS = "'Schibsted Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Markdown to email-safe HTML: inline styles on every element that renders. */
export const prose = (md, { size = 19, color = C.text2 } = {}) => {
  const clean = String(md)
    .replace(/<T k="[^"]*">([\s\S]*?)<\/T>/g, '$1')     // theme markers: keep the words
    .replace(/<\/?[A-Z][^>]*>/g, '');                    // any other MDX component
  const P = `margin:0 0 18px;font-family:${SERIF};font-size:${size}px;line-height:1.6;color:${color};font-weight:400;`;
  return marked.parse(clean, { async: false })
    .replace(/<p>/g, `<p class="prose" style="${P}">`)
    .replace(/<strong>/g, `<strong style="color:${C.text};font-weight:600;">`)
    .replace(/<em>/g, `<em style="font-style:italic;color:${C.text};">`)
    .replace(/<a href=/g, `<a style="color:${C.glow};text-decoration:underline;text-underline-offset:2px;" href=`)
    .replace(/<ul>/g, `<ul style="margin:0 0 18px;padding-left:22px;font-family:${SERIF};font-size:${size}px;line-height:1.6;color:${color};">`)
    .trim();
};

const eyebrow = (text) =>
  `<p style="margin:0 0 14px;font-family:${SANS};font-size:11px;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;color:${C.text3};font-weight:500;">${esc(text)}</p>`;

const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr><td bgcolor="${C.peacock}" style="border-radius:999px;background-color:${C.peacock};background-image:linear-gradient(102deg,${C.glow},${C.peacock} 55%,${C.azure});">
    <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:15px;line-height:1;font-weight:600;color:${C.onAccent};text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr>
</table>`;

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Video metadata written by scripts/video-assets.mjs, or null. */
export const videoMeta = (root, videoPath) => {
  if (!videoPath) return null;
  const dir = videoPath.replace(/^\//, '').replace(/[^/]+$/, '');
  const metaFile = join(root, 'public', dir, 'video.json');
  const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
  return { dir: '/' + dir, duration: meta.duration ?? null };
};

/** utm_source=newsletter, utm_medium=email, utm_campaign=<slug>. */
export const withUtm = (url) => {
  const u = new URL(url);
  const slug = u.pathname.replace(/\/$/, '').split('/').pop() || 'home';
  u.searchParams.set('utm_source', 'newsletter');
  u.searchParams.set('utm_medium', 'email');
  u.searchParams.set('utm_campaign', slug);
  return u.toString();
};

/**
 * @param {object} p
 * @param {'post'|'note'} p.kind
 * @param {string} p.url        absolute URL of the piece
 * @param {string} p.assets     absolute origin for images (the site, or a local path for previews)
 * @param {string} [p.title] @param {string} [p.description] @param {string} [p.thesis] markdown
 * @param {string} [p.body]     markdown, used for notes and for posts without a thesis
 * @param {number} [p.minutes]
 * @param {{dir:string,duration:number|null}|null} [p.video]
 */
export const renderContent = (input) => {
  // Every link back to the site carries UTM tags, so each email's traffic
  // shows up as its own source on the readership dashboard (GoatCounter reads
  // utm_source as the referrer, utm_campaign as the campaign).
  const p = { ...input, url: withUtm(input.url) };
  const pad = 'padding-left:44px;padding-right:44px;';
  const rows = [];

  if (p.kind === 'note') {
    rows.push(`<tr><td class="px" style="${pad}padding-top:8px;padding-bottom:8px;">
      ${eyebrow('A short note')}
      ${p.title ? `<h1 class="h2" style="margin:0 0 18px;font-family:${SERIF};font-size:28px;line-height:1.2;font-weight:400;color:${C.text};">${esc(p.title)}</h1>` : ''}
      ${prose(p.body)}
    </td></tr>`);
    rows.push(`<tr><td class="px" style="${pad}padding-top:28px;padding-bottom:44px;">${button(p.url, 'Read it on the site')}</td></tr>`);
    return table(rows);
  }

  const kicker = ['New essay', p.minutes ? `${p.minutes} min read` : null].filter(Boolean).join('  ·  ');
  const bg = `${p.assets}/email/surface.jpg`;

  // Hero: the site's surface behind the title, as on the homepage.
  rows.push(`<tr><td class="hero" background="${bg}" bgcolor="${C.ground}" valign="top"
      style="background-color:${C.ground};background-image:url('${bg}');background-size:cover;background-position:center bottom;background-repeat:no-repeat;border-radius:20px;padding:46px 44px 150px;">
      ${eyebrow(kicker)}
      <h1 class="h1" style="margin:0;font-family:${SERIF};font-size:42px;line-height:1.12;font-weight:300;letter-spacing:-.01em;color:${C.text};">
        <a href="${p.url}" target="_blank" style="color:${C.text};text-decoration:none;">${esc(p.title)}</a>
      </h1>
      ${p.description ? `<p class="lede" style="margin:18px 0 0;font-family:${SERIF};font-size:21px;line-height:1.45;font-weight:300;color:${C.text2};">${esc(p.description)}</p>` : ''}
    </td></tr>`);

  // The thesis, which the page shows as "The short version".
  const short = p.thesis || (p.body ? p.body.split(/\n\s*\n/).slice(0, 2).join('\n\n') : '');
  if (short) {
    rows.push(`<tr><td class="px" style="${pad}padding-top:40px;">
      ${eyebrow('The short version')}
      ${prose(short)}
    </td></tr>`);
  }

  if (p.video) {
    const watch = `${p.url}#video`;   // p.url already carries the UTM tags
    const dur = p.video.duration ? `in ${mmss(p.video.duration)}` : 'as a short video';
    rows.push(`<tr><td class="px" style="${pad}padding-top:34px;">
      <a href="${watch}" target="_blank" style="display:block;text-decoration:none;">
        <img src="${p.assets}${p.video.dir}email-poster.jpg" width="512" alt="Play the video: ${esc(p.title)}"
          style="display:block;width:100%;max-width:512px;height:auto;border:1px solid ${C.rule};border-radius:16px;" />
      </a>
      <p style="margin:12px 0 0;font-family:${SANS};font-size:13.5px;line-height:1.5;color:${C.text3};">
        The argument ${dur}. <a href="${watch}" target="_blank" style="color:${C.glow};text-decoration:none;">Watch it on the site&nbsp;&rarr;</a>
      </p>
    </td></tr>`);
  }

  rows.push(`<tr><td class="px" style="${pad}padding-top:36px;padding-bottom:48px;">${button(p.url, 'Read the full essay')}</td></tr>`);
  return table(rows);
};

const table = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.join('\n')}</table>`;

/** The full email as a subscriber would see it, for local previews only. */
export const preview = (template, content) =>
  template
    .replace('{{ message_content }}', content)
    .replace(/{{\s*unsubscribe_url\s*}}/g, '#unsubscribe')
    .replace(/{{\s*address\s*}}/g, 'Postal address from your Kit settings');
