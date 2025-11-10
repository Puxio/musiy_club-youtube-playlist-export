// background.js
// Service Worker for the Chrome extension.
// Handles messages from content scripts and popups.
// Coordinates the injection of site-specific scripts and the download process.

// Variable to store information about the currently active tab
// This is updated when a content script on a relevant page sends a message
let currentTabInfo = null;

// Listen for messages sent from content scripts or other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script received message:", request);

    // Handle message from content script indicating a relevant page was detected
    if (request.action === "pageDetected") {
        // Store the tab ID, URL, content type (playlist/album), and site name
        currentTabInfo = {
            tabId: sender.tab.id, // ID of the tab where the message originated
            url: request.url,     // URL of the page
            type: request.type,   // Type of content ('playlist', 'album')
            site: request.site    // Name of the site ('youtube', 'musify')
        };
        // Optional: Update the extension icon or other UI elements based on this info
        console.log("Background: Updated tab info for export:", currentTabInfo);
    }
    // Handle message from content script indicating no relevant page was detected
    else if (request.action === "pageNotDetected") {
        // Clear the stored tab info if the current page is not valid
        currentTabInfo = null;
        console.log("Background: Cleared tab info, no valid page.");
    }
    // Handle message from popup requesting playlist/album export
    else if (request.action === "exportPlaylist") {
        // Check if we have valid information about the current tab
        if (currentTabInfo) {
            console.log("Background: Export request received for:", currentTabInfo);
            // Start the export process using the stored tab information
            handleExport(currentTabInfo);
            // Return true to indicate this listener is asynchronous and sendResponse will be used later
            return true;
        } else {
            // If no valid tab info is available, send an error message back to the popup
            console.error("Background: Export requested, but no valid tab info available.");
            sendResponse({ error: "No valid playlist or album page found in the current tab." });
        }
    }
    // Optional: Handle message from popup requesting current tab status
    else if (request.action === "getTabStatus") {
        // Send back whether a valid page was detected
        sendResponse({ valid: currentTabInfo !== null });
    }
    // Optional: Handle messages for export success/error to update popup UI
    else if (request.action === "exportSuccess" || request.action === "exportError") {
        // Forward the message to the popup (if it's still open) to update its UI
        // This requires the popup to also listen for messages from the background
        // Example: chrome.runtime.sendMessage(request); // Relay the message
        console.log(`Background: Relaying ${request.action} to popup.`);
        // Relay the message to the popup if it's listening
        // chrome.runtime.sendMessage(request);
    }

    // sendResponse should only be used if returning data synchronously or if 'return true' was used above
    // For the 'exportPlaylist' case, handleExport is async, so the response is sent within its catch block.
});

// Main function to handle the export process
async function handleExport(tabInfo) {
    const { tabId, url, site, type } = tabInfo; // Destructure the tab information

    try {
        let playlistData = null; // Array to hold track information [{title, artist, url}, ...]
        let playlistTitle = null; // String for the playlist/album title

        // --- Site-Specific Logic ---
        if (site === 'youtube') {
            console.log("Background: Starting YouTube export process.");
            // 1. Inject necessary scripts into the YouTube page:
            //    - utils.js: For shared functions (though XSPF creation happens here)
            //    - redirect-youtube.js: To handle Invidious CORS issues
            //    - youtube.js: The script containing the extraction logic
            await chrome.scripting.executeScript({
                target: { tabId: tabId }, // Target the specific tab
                files: ["utils.js", "scripts/redirect-youtube.js", "scripts/youtube.js"] // Files to inject
            });
            console.log("Background: Injected YouTube scripts.");

            // 2. Execute the extraction function defined in youtube.js within the page context
            //    This function should return an object like { title: "...", tracks: [...] }
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                // Execute an anonymous function that calls the global function defined in youtube.js
                func: () => window.getYoutubePlaylistInfo ? window.getYoutubePlaylistInfo() : null
            });

            // 3. Check if the extraction function returned valid data
            if (results && results[0] && results[0].result) {
                playlistData = results[0].result.tracks; // Extract the tracks array
                playlistTitle = results[0].result.title; // Extract the title
                console.log(`Background: Extracted ${playlistData.length} tracks from YouTube: ${playlistTitle}`);
            } else {
                throw new Error("Failed to extract data from YouTube page. Check if youtube.js is correctly defining window.getYoutubePlaylistInfo.");
            }
        } else if (site === 'musify') {
            console.log("Background: Starting Musify export process.");
            // 1. Inject necessary scripts into the Musify page:
            //    - utils.js: For shared functions
            //    - musify.js: The script containing the extraction logic
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ["utils.js", "scripts/musify.js"] // Files to inject
            });
            console.log("Background: Injected Musify scripts.");

            // 2. Execute the extraction function defined in musify.js within the page context
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                // Execute an anonymous function that calls the global function defined in musify.js
                func: () => window.getMusifyPlaylistInfo ? window.getMusifyPlaylistInfo() : null
            });

            // 3. Check if the extraction function returned valid data
            if (results && results[0] && results[0].result) {
                playlistData = results[0].result.tracks; // Extract the tracks array
                playlistTitle = results[0].result.title; // Extract the title
                console.log(`Background: Extracted ${playlistData.length} tracks from Musify: ${playlistTitle}`);
            } else {
                throw new Error("Failed to extract data from Musify page. Check if musify.js is correctly defining window.getMusifyPlaylistInfo.");
            }
        } else {
            // If the site is not recognized, throw an error
            throw new Error(`Unsupported site: ${site}`);
        }

        // --- Common Logic After Data Extraction ---
        // Verify that both title and data are available before proceeding
        if (playlistData && playlistTitle) {
            // Generate the XSPF XML content using the utility function
            const xspfContent = createXSPF(playlistTitle, playlistData);
            // Sanitize the title to create a safe filename
            const filename = `${sanitizeFilename(playlistTitle)}.xspf`;
            // Trigger the download of the generated XSPF file
            downloadXSPF(xspfContent, filename);
            console.log("Background: Export completed successfully for:", playlistTitle);

            // Optional: Send a success message back to the popup
            // chrome.runtime.sendMessage({ action: "exportSuccess", filename: filename });
        } else {
            // If title or data is missing, throw an error
            throw new Error("Missing playlist title or track data after extraction.");
        }

    } catch (error) {
        // Catch any errors that occur during the export process
        console.error("Background: Error during export:", error);
        // Send an error message back to the popup so the user knows what went wrong
        chrome.runtime.sendMessage({ action: "exportError", message: error.message });
    }
}

// --- Utility Functions ---
// These functions are defined here in the background script context
// They replicate the logic from utils.js for use within the background script itself.
// (Alternatively, you could try to import utils.js here if it's made available,
//  but defining them directly is often simpler for the background script)

// Function to sanitize filename (replicated from utils.js)
function sanitizeFilename(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Function to create XSPF XML content (replicated from utils.js)
function createXSPF(playlistTitle, tracks) {
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<playlist version="1" xmlns="http://xspf.org/ns/0/">\n';
    xmlContent += `  <title>${escapeXml(playlistTitle)}</title>\n`;
    xmlContent += '  <trackList>\n';
    tracks.forEach(track => {
        xmlContent += '    <track>\n';
        xmlContent += `      <title>${escapeXml(track.title)}</title>\n`;
        xmlContent += `      <creator>${escapeXml(track.artist)}</creator>\n`;
        xmlContent += `      <location>${escapeXml(track.url)}</location>\n`;
        xmlContent += '    </track>\n';
    });
    xmlContent += '  </trackList>\n';
    xmlContent += '</playlist>';
    return xmlContent;
}

// Function to escape XML special characters (replicated from utils.js)
function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') {
        unsafe = String(unsafe);
    }
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '<';
            case '>': return '>';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

// Function to trigger the download using the Chrome Downloads API (replicated from utils.js)
function downloadXSPF(content, filename) {
    const blob = new Blob([content], { type: 'application/xspf+xml' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true // Show save dialog
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error('Download error:', chrome.runtime.lastError.message);
            // Optionally relay error back to popup
            chrome.runtime.sendMessage({ action: "exportError", message: chrome.runtime.lastError.message });
        } else {
            console.log('Download started with ID:', downloadId);
            // Revoke the object URL after a short delay to free memory
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    });
}