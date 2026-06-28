// Hedon Haven xnxx.com plugin
// Exports: name, version, canHandle(url), getInfo(url), getStreams(url), search(query)
// Uses axios + cheerio to fetch and parse pages and extract direct video URLs when possible.

const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36';

function name() { return 'xnxx'; }
function version() { return '1.0.0'; }

function canHandle(url) {
  if (!url) return false;
  return /^(https?:\/\/)?(www\.)?(xnxx\.com)\//i.test(url);
}

async function fetchPage(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.xnxx.com/'
    },
    timeout: 15000
  });
  return res.data;
}

function findUrlsInScripts(html) {
  const urls = new Set();
  const mp4Regex = /https?:\\/\\/[^\n'"\s<>]+\\.mp4(?:\?[^'"\s<>]*)?/gi;
  const m3u8Regex = /https?:\\/\\/[^\n'"\s<>]+\\.m3u8(?:\?[^'"\s<>]*)?/gi;

  let match;
  while ((match = mp4Regex.exec(html)) !== null) {
    urls.add(match[0]);
  }
  while ((match = m3u8Regex.exec(html)) !== null) {
    urls.add(match[0]);
  }
  return Array.from(urls);
}

function parseMediaDefinitionsFromScripts(html) {
  // Some xnxx pages include a JS array called "mediaDefinitions" or similar.
  // Try to find JSON-like arrays that contain file: or video_url entries.
  const results = [];
  // Attempt to match mediaDefinitions = [...] or var mediaDefinitions = [...]
  const mdRegex = /mediaDefinitions\s*=\s*(\[.*?\]);/s;
  const mdMatch = html.match(mdRegex);
  if (mdMatch && mdMatch[1]) {
    try {
      const jsonText = mdMatch[1]
        .replace(/(['\"])?(file|label|type)(['\"])?\s*:/g, '"$2":') // normalize keys
        .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":') // quote keys
        .replace(/\'/g, '"');
      const arr = JSON.parse(jsonText);
      arr.forEach(item => {
        if (item.file) results.push(item.file);
        if (item.videoUrl) results.push(item.videoUrl);
      });
    } catch (e) {
      // ignore parse errors
    }
  }
  return Array.from(new Set(results));
}

async function getInfo(url) {
  if (!canHandle(url)) throw new Error('Cannot handle url');
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || '';
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
  const thumbnail = $('meta[property="og:image"]').attr('content') || $('img.thumbnail, img.thumb').first().attr('src') || '';
  const uploader = $(".profile .name, .profile a").first().text().trim() || '';
  const duration = $('span.duration, .video-sizes time').first().text().trim() || '';

  let formats = await getStreams(url, html);

  return {
    site: 'xnxx',
    title,
    description,
    thumbnail,
    uploader,
    duration,
    formats
  };
}

async function getStreams(url, preloadedHtml) {
  if (!canHandle(url)) throw new Error('Cannot handle url');
  const html = preloadedHtml || await fetchPage(url);
  const $ = cheerio.load(html);

  const formats = [];

  // 1) <source> tags in HTML5 video
  $('source').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const type = $(el).attr('type') || '';
    if (src) formats.push({ url: src, mime: type || guessMime(src), quality: null });
  });

  // 2) meta og:video
  const ogVideo = $('meta[property="og:video:secure_url"]').attr('content') || $('meta[property="og:video"]').attr('content');
  if (ogVideo) formats.push({ url: ogVideo, mime: guessMime(ogVideo), quality: null });

  // 3) try to parse known JS structures
  const mediaDefs = parseMediaDefinitionsFromScripts(html);
  mediaDefs.forEach(u => formats.push({ url: u, mime: guessMime(u), quality: null }));

  // 4) fallback: search for direct .mp4 and .m3u8 URLs inside scripts
  const scriptUrls = findUrlsInScripts(html);
  scriptUrls.forEach(u => formats.push({ url: u, mime: guessMime(u), quality: null }));

  // 5) dedupe and normalize
  const seen = new Set();
  const normalized = [];
  for (const f of formats) {
    if (!f || !f.url) continue;
    let u = f.url.trim();
    // sometimes URLs are protocol-relative
    if (u.startsWith('//')) u = 'https:' + u;
    if (u.includes('blob:')) continue; // ignore blob URLs
    if (seen.has(u)) continue;
    seen.add(u);
    normalized.push({ url: u, mime: f.mime || guessMime(u), quality: f.quality });
  }

  return normalized;
}

function guessMime(url) {
  if (!url) return '';
  if (/\.m3u8(\?|$)/i.test(url)) return 'application/x-mpegURL';
  if (/\.mp4(\?|$)/i.test(url)) return 'video/mp4';
  return '';
}

async function search(query, limit = 20) {
  // Basic search using site's query param - may vary by region. This is a best-effort implementation.
  if (!query) return [];
  const qs = encodeURIComponent(query);
  const searchUrl = `https://www.xnxx.com/?k=${qs}`;
  const html = await fetchPage(searchUrl);
  const $ = cheerio.load(html);

  const results = [];
  // xnxx search results typically have .thumb-block or .thumb under a .photo link
  $('.thumb-block, .photo, .thumb').each((i, el) => {
    if (results.length >= limit) return;
    const a = $(el).find('a').first();
    const href = a.attr('href');
    const title = a.attr('title') || $(el).find('a').text().trim() || $(el).find('.title').text().trim();
    const thumb = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
    if (href && title) {
      let full = href;
      if (href.startsWith('/')) full = 'https://www.xnxx.com' + href;
      results.push({ title: title.trim(), url: full, thumbnail: thumb || '' });
    }
  });

  return results;
}

module.exports = {
  name,
  version,
  canHandle,
  getInfo,
  getStreams,
  search
};
