// content_script.js
// Runs in pages matching manifest.json. Detects playlist/album pages and notifies background.

// Immediately detect on load and set up SPA URL-change detection
(function initContentScript() {
    // Run initial detection now (in case document already loaded)
    detectAndNotify(window.location.href);

    // Listen for full page load as well (covers initial load)
    window.addEventListener('load', () => {
        detectAndNotify(window.location.href);
    });

    // --- SPA URL change detection (YouTube is a SPA) ---
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        detectAndNotify(location.href);
      }
    });
    observer.observe(document, { subtree: true, childList: true });
})();

// Helper that runs detection and sends message to background
function detectAndNotify(currentUrl) {
    const pageType = detectPageType(currentUrl);
    if (pageType) {
        chrome.runtime.sendMessage({
            action: "pageDetected",
            type: pageType.type,
            site: pageType.site,
            url: currentUrl
        });
        console.log("Content script: Detected relevant page -", pageType, currentUrl);
    } else {
        chrome.runtime.sendMessage({ action: "pageNotDetected" });
        console.log("Content script: No relevant playlist/album page found for URL:", currentUrl);
    }
}

// Function to determine type/site based on URL
function detectPageType(url) {
    // --- YouTube Detection ---
    // Playlist page: https://www.youtube.com/playlist?list=...
    if (url.includes('youtube.com/playlist?list=')) {
        return { type: 'playlist', site: 'youtube' };
    }
    // Video in a playlist: https://www.youtube.com/watch?v=...&list=...
    if (url.includes('youtube.com/watch?v=') && url.includes('list=')) {
        return { type: 'playlist', site: 'youtube' };
    }

    // --- Musify.club Detection ---
    if (url.includes('musify.club/album/')) {
        return { type: 'album', site: 'musify' };
    }
    if (url.includes('musify.club/playlist/')) {
        return { type: 'playlist', site: 'musify' };
    }

    // No match
    return null;
}

// Note: Extraction of track data is performed by scripts injected by the background (e.g., scripts/youtube.js).
// This content script only detects pages and notifies the background so background.handleExport can inject/extract.