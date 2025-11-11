/**
 * SCRIPT 1: REDIRECTION HANDLER (Run on youtube.com)
 * Extracts the playlist ID from the current YouTube URL and redirects 
 * the browser to the chosen Invidious instance to circumvent CORS policies.
 */
function redirectToInvidiousPlaylist() {
    // ⭐️ CONFIGURATION: Set your preferred Invidious instance here
    const invidiousInstance = 'https://yewtu.be'; 

    const url = window.location.href;
    const playlistIdMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);

    if (playlistIdMatch && playlistIdMatch[1]) {
        const playlistId = playlistIdMatch[1];
        const newUrl = `${invidiousInstance}/playlist?list=${playlistId}`;
        
        console.log(`✅ Redirecting to: ${newUrl}`);
        // Redirect the browser to the new URL
        window.location.href = newUrl;
    } else {
        console.error("⛔ Cannot proceed: Playlist ID not found in the current URL. Ensure you are on a valid YouTube playlist page.");
    }
}

// === EXECUTION START ===
redirectToInvidiousPlaylist();
