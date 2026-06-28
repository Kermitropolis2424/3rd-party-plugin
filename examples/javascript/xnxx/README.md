# Hedon Haven xnxx.com Plugin

This is a third-party plugin for Hedon Haven that adds basic xnxx.com support (video metadata and direct stream extraction).

Files in this folder:

- manifest.json — plugin metadata
- package.json — Node dependencies (axios, cheerio)
- index.js — plugin implementation (exports canHandle, getInfo, getStreams, search)

Installation / Usage

1. From the Hedon Haven app or your local environment, copy this folder into the third-party plugins directory or follow the app's instructions for adding JavaScript plugins.

2. Install dependencies in the plugin folder:

```bash
cd examples/javascript/xnxx
npm install
```

3. Restart Hedon Haven (or the plugin loader) so it picks up the new plugin.

Notes and caveats

- xnxx hosts adult content. Ensure you comply with local laws and the terms of service before using this plugin.
- This plugin attempts to extract direct MP4 or HLS (.m3u8) URLs from the video page by looking for <source> tags, OpenGraph metadata, or common inline JavaScript structures. Some videos may be protected or served by dynamic JS/CDN mechanisms and may not be extractable by this plugin.
- The plugin sets a standard browser User-Agent and Referer header to help media servers permit access. Some streams still may require cookies, geo/IP checks, or special headers.
- Use responsibly and respect robots.txt and site terms.

If a video fails to play, open an issue in the repository with the video URL and the plugin will be improved.
