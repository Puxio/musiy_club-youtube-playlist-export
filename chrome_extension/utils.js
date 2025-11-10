// utils.js
// Shared utility functions for the Chrome extension

// Function to sanitize a string to be safe for use as a filename
// Replaces non-alphanumeric characters with underscores and converts to lowercase
function sanitizeFilename(str) {
    if (typeof str !== 'string') {
        // Convert to string if it's not already (e.g., if it's a number)
        str = String(str);
    }
    // Replace any character that is not a letter or number with an underscore
    // Convert the resulting string to lowercase
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Function to create the XSPF XML content from playlist title and track list
// playlistTitle: The name of the playlist/album
// tracks: An array of objects, where each object has 'title', 'artist', and 'url' properties
function createXSPF(playlistTitle, tracks) {
    // Start building the XML string with the XSPF header
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<playlist version="1" xmlns="http://xspf.org/ns/0/">\n';
    // Add the playlist title, ensuring any XML special characters are escaped
    xmlContent += `  <title>${escapeXml(playlistTitle)}</title>\n`;
    xmlContent += '  <trackList>\n';
    // Iterate through the tracks array and add each track to the XML
    tracks.forEach(track => {
        xmlContent += '    <track>\n';
        // Add track title, escaping special characters
        xmlContent += `      <title>${escapeXml(track.title)}</title>\n`;
        // Add track creator (artist), escaping special characters
        xmlContent += `      <creator>${escapeXml(track.artist)}</creator>\n`;
        // Add track location (URL), escaping special characters
        xmlContent += `      <location>${escapeXml(track.url)}</location>\n`;
        xmlContent += '    </track>\n';
    });
    xmlContent += '  </trackList>\n';
    xmlContent += '</playlist>';
    // Return the complete XML string
    return xmlContent;
}

// Function to escape XML special characters in a string
// This is crucial to prevent XML parsing errors if titles, artists, or URLs contain these characters
function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') {
        // Ensure the input is a string before processing
        unsafe = String(unsafe);
    }
    // Replace each special character with its corresponding XML entity
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '<';   // Less than
            case '>': return '>';   // Greater than
            case '&': return '&amp;';  // Ampersand
            case '\'': return '&apos;'; // Apostrophe
            case '"': return '&quot;';  // Quotation mark
            default: return c;         // Return the character if not a special one (should not happen due to regex)
        }
    });
}

// Function to trigger the download of the XSPF file using the Chrome Downloads API
// content: The string containing the XSPF XML data
// filename: The desired name for the downloaded file (e.g., "my_playlist.xspf")
function downloadXSPF(content, filename) {
    // Create a Blob object from the XSPF content string
    // Specify the MIME type for XSPF files
    const blob = new Blob([content], { type: 'application/xspf+xml' });
    // Create a temporary URL for the Blob object
    const url = URL.createObjectURL(blob);

    // Use the Chrome Downloads API to initiate the download
    chrome.downloads.download({
        url: url,              // The temporary URL of the Blob
        filename: filename,    // The name to save the file as
        saveAs: true          // Show the save dialog to the user (optional, can be false to save in default location)
    }, (downloadId) => {
        // Callback function executed after the download is initiated
        if (chrome.runtime.lastError) {
            // Check if an error occurred during the download initiation
            console.error('Download error:', chrome.runtime.lastError.message);
            // Optionally alert the user (not recommended for production extensions)
            // alert('Error during download: ' + chrome.runtime.lastError.message);
        } else {
            // Log the download ID if successful
            console.log('Download started with ID:', downloadId);
            // It's good practice to revoke the Blob URL after the download starts
            // to free up memory. A short timeout ensures the download has started.
            setTimeout(() => URL.revokeObjectURL(url), 1000); // Revoke URL after 1 second
        }
    });
}

// Make these utility functions available globally within the extension context
// This allows them to be used in content_script.js and background.js
if (typeof module !== 'undefined' && module.exports) {
    // For environments that support CommonJS modules (like Node.js, though less relevant for extensions)
    module.exports = { sanitizeFilename, createXSPF, escapeXml, downloadXSPF };
} else {
    // For standard browser/extension environments
    window.sanitizeFilename = sanitizeFilename;
    window.createXSPF = createXSPF;
    window.escapeXml = escapeXml;
    // downloadXSPF is primarily used by the background script
    window.downloadXSPF = downloadXSPF;
}