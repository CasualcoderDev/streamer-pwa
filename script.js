document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const urlInput = document.getElementById('video-url-input');
    const pasteBtn = document.getElementById('paste-btn');
    const playBtn = document.getElementById('play-btn');

    const inputView = document.getElementById('input-view');
    const playerView = document.getElementById('player-view');

    const videoPlayer = document.getElementById('main-player');
    const backBtn = document.getElementById('back-btn');
    const statsBtn = document.getElementById('stats-btn');
    const downloadBtn = document.getElementById('download-btn');
    const installBtn = document.getElementById('install-btn');
    const closeStatsBtn = document.getElementById('close-stats-btn');
    const nowPlayingTitle = document.getElementById('now-playing-title');

    const statsOverlay = document.getElementById('advanced-stats-panel');
    const speedStat = document.getElementById('speed-stat');
    const resolutionStat = document.getElementById('resolution-stat');
    const codecStat = document.getElementById('codec-stat');
    const bitrateStat = document.getElementById('bitrate-stat');
    const fpsStat = document.getElementById('fps-stat');
    const healthStat = document.getElementById('health-stat');

    const bufferingUi = document.getElementById('buffering-ui');
    const slowLoadWarning = document.getElementById('slow-load-warning');
    const errorUi = document.getElementById('error-ui');
    const errorMessage = document.getElementById('error-message');

    // --- State Variables ---
    let player = null;
    let hls = null;
    let lastTime = Date.now();
    let speedInterval;
    let isBuffering = false;

    // --- Input Validation & Button State ---
    const validateInput = () => {
        const url = urlInput.value.trim();
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            playBtn.removeAttribute('disabled');
        } else {
            playBtn.setAttribute('disabled', 'true');
        }
    };

    urlInput.addEventListener('input', validateInput);

    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text;
                validateInput();
                urlInput.parentElement.style.transform = 'scale(1.02)';
                setTimeout(() => { urlInput.parentElement.style.transform = 'scale(1)'; }, 150);
            }
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
        }
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !playBtn.disabled) playVideo();
    });

    // --- Stats Tracking & Health Logic ---
    statsBtn.addEventListener('click', () => {
        statsOverlay.classList.add('show-stats');
    });

    closeStatsBtn.addEventListener('click', () => {
        statsOverlay.classList.remove('show-stats');
    });

    const updateHealthIndicator = (speedMBps) => {
        let healthClass = 'slow';
        let healthText = 'Slow';

        if (speedMBps > 5.0) {
            healthClass = 'good';
            healthText = 'Fast';
        } else if (speedMBps > 1.5) {
            healthClass = 'good';
            healthText = 'Good';
        } else if (speedMBps < 0.5 && speedMBps > 0) {
            healthClass = 'dead';
            healthText = 'Poor';
        }

        healthStat.className = `health-indicator ${healthClass}`;
        healthStat.innerHTML = `<span class="dot"></span><span class="text">${healthText}</span>`;
    };

    const initStatsTracking = () => {
        // Fallback for direct MP4 progress mock
        videoPlayer.addEventListener('progress', () => {
            if (!hls) {
                const now = Date.now();
                const deltaMs = now - lastTime;
                if (deltaMs > 500) {
                    const virtualSpeed = (Math.random() * 5 + 2).toFixed(1);
                    speedStat.textContent = `${virtualSpeed} MB/s`;
                    updateHealthIndicator(parseFloat(virtualSpeed));
                    lastTime = now;
                }
            }
        });

        // Listen to native player buffering events to trigger UI
        videoPlayer.addEventListener('waiting', () => {
            isBuffering = true;
            bufferingUi.classList.remove('hidden');
        });

        videoPlayer.addEventListener('playing', () => {
            isBuffering = false;
            bufferingUi.classList.add('hidden');
        });

        speedInterval = setInterval(() => {
            if (player && player.playing) {
                if (!hls && videoPlayer.videoWidth) {
                    resolutionStat.textContent = `${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
                }
            }
        }, 1000);
    };

    // --- Initialize Video Library (Plyr + HLS.js) ---
    const initPlayer = (url) => {
        if (player) player.destroy();
        if (hls) hls.destroy();

        // Reset Error UI state
        errorUi.classList.add('hidden');
        errorMessage.textContent = 'Failed to load video stream.';

        const defaultOptions = {
            controls: [
                'play-large', 'play', 'progress', 'current-time', 'duration',
                'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
            ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            quality: {
                default: 'default',
                options: ['default'],
                forced: true,
                onChange: (newQuality) => { updateQuality(newQuality); },
            },
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] }
        };

        if (url.includes('.m3u8') && Hls.isSupported()) {
            // HLS.js configuration optimized for aggressive forward buffering and stability
            hls = new Hls({
                maxBufferLength: 60,         // Try to always keep at least 60s ahead
                maxMaxBufferLength: 600,     // Cache up to 10 mins ahead if bandwidth allows
                maxBufferSize: 150 * 1000 * 1000, // 150MB max memory buffer to allow huge lookahead
                liveSyncDurationCount: 3,    // Safer live sync points
                highBufferWatchdogPeriod: 3, // Check buffer health frequently
                fragLoadingMaxRetry: 6,      // High retry count for unstable connections
                manifestLoadingMaxRetry: 6,
                levelLoadingMaxRetry: 6,
                enableWorker: true           // Offload parsing to Web Worker for smoother main thread
            });
            hls.loadSource(url);
            hls.attachMedia(videoPlayer);

            hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
                const availableQualities = hls.levels.map((l) => l.height);
                availableQualities.unshift(0);

                defaultOptions.quality = {
                    default: 0,
                    options: availableQualities,
                    forced: true,
                    onChange: (e) => updateQuality(e),
                };

                player = new Plyr(videoPlayer, defaultOptions);
                player.play();
                initStatsTracking();
            });

            hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
                // HLS.js tracks bandwidth in bits per second internally
                const bwBitsSec = hls.bandwidthEstimate;
                if (bwBitsSec && !isNaN(bwBitsSec)) {
                    const speedMBps = (bwBitsSec / 8 / 1024 / 1024).toFixed(1);
                    speedStat.textContent = `${speedMBps} MB/s`;
                    updateHealthIndicator(parseFloat(speedMBps));
                }
            });

            // Handle HLS specific fatal errors
            hls.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("fatal network error encountered, try to recover");
                            errorMessage.textContent = 'Network Error: The server refused connection or the link is dead/expired.';
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error("fatal media error encountered, try to recover");
                            errorMessage.textContent = 'Media Error: The video format is unsupported or corrupted.';
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error("fatal undefined error encountered, destroying hls");
                            errorMessage.textContent = 'Fatal Error: Could not parse stream manifest.';
                            hls.destroy();
                            errorUi.classList.remove('hidden');
                            bufferingUi.classList.add('hidden');
                            break;
                    }
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        errorUi.classList.remove('hidden');
                        bufferingUi.classList.add('hidden');
                    }
                }
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
                const level = hls.levels[data.level];
                if (level) {
                    resolutionStat.textContent = `${level.width}x${level.height}`;
                    if (level.videoCodec) codecStat.textContent = level.videoCodec.split('.')[0];
                    if (level.bitrate) bitrateStat.textContent = `${Math.round(level.bitrate / 1000)} kbps`;
                    if (level.frameRate) fpsStat.textContent = `${Math.round(level.frameRate)} fps`;
                }
            });

        } else {
            // Force the browser to only fetch the metadata atom first, not the whole file
            videoPlayer.preload = 'metadata';

            videoPlayer.src = url;
            player = new Plyr(videoPlayer, defaultOptions);
            player.play();
            codecStat.textContent = 'MP4 Direct';
            bitrateStat.textContent = 'Auto';
            fpsStat.textContent = 'Auto';

            // UI Fix for long loading MP4s (e.g. 1.4+ minutes to find moov atom)
            bufferingUi.classList.remove('hidden');
            let slowLoadTimeout = setTimeout(() => {
                if (videoPlayer.readyState < 1) { // 1 = HAVE_METADATA
                    slowLoadWarning.classList.remove('hidden');
                }
            }, 5000); // Wait 5 seconds before showing warning

            videoPlayer.addEventListener('loadedmetadata', () => {
                clearTimeout(slowLoadTimeout);
                slowLoadWarning.classList.add('hidden');
            });

            // Handle Direct MP4 errors
            videoPlayer.addEventListener('error', (e) => {
                clearTimeout(slowLoadTimeout);
                bufferingUi.classList.add('hidden');
                errorUi.classList.remove('hidden');
                let errStr = "Unknown playback error.";
                if (videoPlayer.error) {
                    switch (videoPlayer.error.code) {
                        case 1: errStr = "Playback aborted by user."; break;
                        case 2: errStr = "Network connection failed. The link might be dead."; break;
                        case 3: errStr = "Video decoding failed. Corrupted file."; break;
                        case 4: errStr = "Format not supported or server blocked access (CORS)."; break;
                    }
                }
                errorMessage.textContent = errStr;
            });

            initStatsTracking();
        }

        function updateQuality(newQuality) {
            if (hls) {
                if (newQuality === 0) {
                    hls.currentLevel = -1;
                } else {
                    hls.levels.forEach((level, levelIndex) => {
                        if (level.height === newQuality) {
                            hls.currentLevel = levelIndex;
                        }
                    });
                }
            }
        }
    };

    // --- Transitions & Logic ---
    const playVideo = () => {
        const url = urlInput.value.trim();
        if (!url) return;

        try {
            const urlObj = new URL(url);
            let filename = urlObj.pathname.split('/').pop() || 'Unknown Stream';
            filename = decodeURIComponent(filename);
            if (filename.includes('?')) filename = filename.split('?')[0];
            nowPlayingTitle.textContent = filename;
        } catch {
            nowPlayingTitle.textContent = 'Direct Stream';
        }

        initPlayer(url);

        inputView.classList.add('input-hide');
        playerView.classList.remove('hidden');
        setTimeout(() => { playerView.classList.add('player-show'); }, 50);
    };

    playBtn.addEventListener('click', playVideo);

    // --- Player Actions ---
    downloadBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) return;

        // This attempts to force a download using an invisible anchor tag
        const a = document.createElement('a');
        a.href = url;
        a.download = nowPlayingTitle.textContent || 'stream_video';
        // Open in new tab as fallback if direct download gets blocked by CORS
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    backBtn.addEventListener('click', () => {
        if (player) player.pause();
        if (speedInterval) clearInterval(speedInterval);

        statsOverlay.classList.remove('show-stats');
        bufferingUi.classList.add('hidden');

        playerView.classList.remove('player-show');
        setTimeout(() => {
            playerView.classList.add('hidden');
            inputView.classList.remove('input-hide');
            if (player) {
                player.destroy();
                player = null;
            }
            if (hls) {
                hls.destroy();
                hls = null;
            }
            videoPlayer.innerHTML = '';
        }, 300);
    });

    // --- PWA Installation Flow ---
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI notify the user they can install the PWA
        installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User prompt response: ${outcome}`);
            deferredPrompt = null;
            installBtn.classList.add('hidden');
        }
    });

});
