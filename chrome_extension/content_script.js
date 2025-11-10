// content_script.js
// This script runs within the context of web pages matching the specified URLs in manifest.json
// Its main purpose is to detect if the current page is a relevant playlist/album page
// and communicate this information to the background script.

// Listen for the 'load' event to ensure the page DOM is fully loaded before running detection logic
window.addEventListener('load', () => {
    // Get the current URL of the tab where the script is running
    const currentUrl = window.location.href;

    // Use a helper function to determine the type of page and the site
    const pageType = detectPageType(currentUrl);

    // Check if the current page is one we can handle (playlist/album on a supported site)
    if (pageType) {
        // If a relevant page is detected, send a message to the background script
        // This allows the background script to know the context and enable the popup accordingly
        chrome.runtime.sendMessage({
            action: "pageDetected", // Action indicating a relevant page was found
            type: pageType.type,    // Type of content (e.g., 'playlist', 'album')
            site: pageType.site,    // The website (e.g., 'youtube', 'musify')
            url: currentUrl         // Include the URL for potential future use by the background script
        });
        console.log("Content script: Detected relevant page -", pageType);
    } else {
        // If the page is not relevant, inform the background script
        // This might be used by the background script to disable the popup or show a different message
        console.log("Content script: No relevant playlist/album page found on this URL.");
        chrome.runtime.sendMessage({ action: "pageNotDetected" });
    }
});

// Function to determine the type of page and the site based on the URL
// Returns an object { type: '...', site: '...' } if a match is found, otherwise null
function detectPageType(url) {
    // --- YouTube Detection ---
    // Check for YouTube playlist URLs (e.g., https://www.youtube.com/playlist?list=...)
    if (url.includes('youtube.com/playlist?list=')) {
        return { type: 'playlist', site: 'youtube' };
    }
    // Check for YouTube video URLs that are part of a playlist (e.g., https://www.youtube.com/watch?v=...&list=...)
    // This covers cases where a user is watching a video within a playlist context
    if (url.includes('youtube.com/watch?v=') && url.includes('list=')) {
        return { type: 'playlist', site: 'youtube' }; // Treat as playlist for now
    }
    // Add more YouTube-specific patterns here if needed (e.g., for albums if they have a distinct URL)

    // --- Musify.club Detection ---
    // Check for Musify.club album URLs (e.g., https://musify.club/album/...)
    if (url.includes('musify.club/album/')) {
        return { type: 'album', site: 'musify' };
    }
    // Check for Musify.club playlist URLs (e.g., https://musify.club/playlist/...)
    if (url.includes('musify.club/playlist/')) {
        return { type: 'playlist', site: 'musify' };
    }
    // Add more site-specific detection logic here as you support new sites

    // If no patterns match, return null
    return null;
}

// Note: The actual data extraction (e.g., track titles, artists, URLs) will be handled
// by the background script using chrome.scripting.executeScript to run
// site-specific extraction scripts (like your youtube.js, musify.js) in the page's context.
// This content script focuses on *detection* and *communication*.