# Streamer PWA

A blazing-fast, privacy-first Progressive Web App (PWA) designed to stream direct video files and HLS `.m3u8` playlists beautifully. Built with a modern, responsive macOS "glassmorphism" aesthetic.

## Features

- **Advanced HLS Streaming Engine:** Leverages `hls.js` with deeply tuned, aggressive configurations for forward-caching to guarantee stutter-free playback even on unstable connections.
- **Service Worker Caching:** intelligently intercepts and caches streaming video chunks locally in your browser memory (up to 500MB) to allow seamless seeking and reverse-scrubbing.
- **Stats for Nerds:** A premium, frosted-glass statistics panel showing live, real-time metrics including Video Codec, exact Resolution, actual Bitrate, Framerate, and a smart Network Health Indicator.
- **Smart Loading UI:** Dynamic buffering indicators that calculate and respond to network conditions, including custom timeouts for poorly encoded, massive `MP4` files.
- **Native Quality Switching:** Flawless integration with the Plyr media interface for instantly switching video qualities (1080p, 720p, etc.) and audio/subtitle tracks on multi-track `.m3u8` streams.
- **PWA Ready:** Fully installable to your Desktop (Windows/Mac) or Mobile Device (iOS/Android) Home Screen like a native app.
- **Direct Downloads:** Native "Download Video" integration for pulling `.mp4` and `.webm` files directly to your hard drive.
- **Fully Responsive:** Fluid, adaptive layout that forces perfect 1:1 square video aspect ratios on narrow mobile phone screens without ruining or stretching the video content.

## Installation / Usage

Since this is a client-side PWA, there is no backend server required.

1. **Deploy:** Upload all files (`index.html`, `style.css`, `script.js`, `manifest.json`, `service-worker.js`) to any static hosting service (GitHub Pages, Vercel, Netlify, etc.)
2. **Access:** Open the hosted `https://` URL on any device.
3. **Install:** Click the "Install App" button that dynamically appears on the homepage to add the Streamer permanently to your device!

## Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript** - No heavy frontend frameworks like React or Vue.
- **[Plyr](https://plyr.io/)** - For the beautiful, customizable HTML5 media controls.
- **[hls.js](https://github.com/video-dev/hls.js/)** - For the robust HTTP Live Streaming client that stitches and decodes `.m3u8` chunks natively in the browser.
- **Phosphor Icons** - For the clean, modern SVG icon suite.
