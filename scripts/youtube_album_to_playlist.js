// Helper function to extract the playlist ID from the current browser URL
function getPlaylistIdFromCurrentUrl() {
  const url = window.location.href; // Gets the current page's URL

  // Regex to capture the playlist ID from various YouTube URL formats
  // Examples it handles:
  // - https://www.youtube.com/playlist?list=PLcCUOL3_Hly8RNuTy8lw1CV3wTKdKJuTU
  // - https://www.youtube.com/watch?v=VIDEO_ID&list=PLcCUOL3_Hly8RNuTy8lw1CV3wTKdKJuTU
  const playlistIdMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);

  if (playlistIdMatch && playlistIdMatch[1]) {
    return playlistIdMatch[1]; // Returns the captured playlist ID
  } else {
    console.warn("No playlist ID found in the current URL.");
    return null; // Return null if no ID is found
  }
}

// --- Main Code Block ---
async function getPlaylistVideosAndGenerateXSPF() {
  // Attempt to get the playlist ID from the current page's URL
  const playlistId = getPlaylistIdFromCurrentUrl();

  if (!playlistId) {
    console.error("Cannot proceed: Playlist ID not found in the URL. Ensure you are on a valid YouTube playlist page (e.g., https://www.youtube.com/playlist?list=...).");
    return; // Exit the function if no ID is found
  }

  // Check if the playlist is an ALBUM (ID starts with "OLAK")
  const isAlbum = playlistId.startsWith('OLAK');

  // Choose an Invidious instance. You can find a list of instances here: https://docs.invidious.io/instances/
  const invidiousInstance = 'https://inv.nadeko.net';
  const apiUrl = `${invidiousInstance}/api/v1/playlists/${playlistId}`;

  try {
    const response = await fetch(apiUrl);

    // Check if the HTTP request was successful (status 200 OK)
    if (!response.ok) {
      // If you get a 404 or similar error, the playlist ID might be wrong,
      // or the Invidious instance might be unreachable/not have the API active.
      throw new Error(`HTTP Error! Status: ${response.status} - Check playlist ID or Invidious instance.`);
    }

    const data = await response.json(); // Parse the response as JSON

    // Check if the playlist contains videos
    if (data.videos && data.videos.length > 0) {
      let xspfContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xspfContent += `<playlist version="1" xmlns="http://xspf.org/ns/0/">\n`;
      xspfContent += `  <trackList>\n`;

      // Get the artist name from the *first* video if it's an album, as this
      // often represents the album artist. We'll clean it immediately.
      let albumArtist = 'Unknown Artist';
      if (isAlbum && data.videos[0] && data.videos[0].author) {
          albumArtist = data.videos[0].author;
          if (albumArtist.endsWith(' - Topic')) {
              albumArtist = albumArtist.replace(' - Topic', '').trim(); // Trim any extra space after removal
          }
      }

      data.videos.forEach(video => {
        // Standard YouTube video link format
        const youtubeLink = `https://www.youtube.com/watch?v=${video.videoId}`;
        // Position in the playlist (add +1 to make it 1-based, if available)
        const position = video.index !== undefined ? video.index + 1 : 'N/A';
        // Use 'let' for artist and title as they might be modified
        let title = video.title || 'Unknown Title';
        let artist = video.author || 'Unknown Artist';
        // Duration in milliseconds for XSPF format
        const duration = video.lengthSeconds !== undefined ? video.lengthSeconds * 1000 : 0;

        // *** LOGICA CORRETTA PER IL PARSING DEL TITOLO ***
        // 1. First, check if it's a non-album playlist AND the artist name does not end with " - Topic".
        if (!isAlbum && !artist.endsWith(' - Topic')) {
            console.log('Original title:', title);

            // Regex per catturare artista, numero traccia e titolo in un'unica operazione
            const regex = /^(.+?)\s*-\s*\d+\s*[.-]\s*(.+)$/;
            const match = title.match(regex);

            if (match) {
                artist = match[1].trim();
                title = match[2].trim();
            } else {
                // Se la regex non trova il formato, prova lo split semplice
                const parts = title.split(' - ', 2);
                if (parts.length === 2) {
                    artist = parts[0].trim();
                    title = parts[1].trim();
                }
            }

            console.log('Parsed artist:', artist);
            console.log('Parsed title:', title);
        }

        // 2. Second, UNCONDITIONALLY remove " - Topic" from the artist name if present.
        if (artist.endsWith(' - Topic')) {
            artist = artist.replace(' - Topic', '').trim();
        }

        // Append <track> tags with details to the XSPF content
        xspfContent += `    <track>\n`;
        xspfContent += `      <trackNum>${position}</trackNum>\n`;
        xspfContent += `      <title>${escapeXml(title)}</title>\n`; // Escape for special characters
        xspfContent += `      <creator>${escapeXml(artist)}</creator>\n`; // Escape for special characters
        xspfContent += `      <location>${escapeXml(youtubeLink)}</location>\n`; // Escape for special characters
        xspfContent += `      <duration>${duration}</duration>\n`;
        // Thumbnail part was removed as per user's request
        xspfContent += `    </track>\n`;
      });

      xspfContent += `  </trackList>\n`;
      xspfContent += `</playlist>`;

      let playlistTitle = data.title || 'Unknown Playlist';
      let fileName;

      // If it's an ALBUM, modify the filename to be "Artist - AlbumName [Youtube].xspf"
      if (isAlbum) {
          // Remove "Album" (and any associated dash/space) from the playlist title
          // Use a regex to catch "Album - ", "- Album", "Album", or " - Album"
          playlistTitle = playlistTitle.replace(/(\s*-\s*Album|\s*Album\s*-|\s*Album)\s*/gi, '').trim();

          // Construct the new filename: "Artist - Title [Youtube].xspf"
          // Ensure there's only one dash between artist and title, and clean up extra spaces
          fileName = `${albumArtist} - ${playlistTitle} [Youtube].xspf`.replace(/  +/g, ' ').trim();
      } else {
          // For non-albums, use the original format: "Playlist Title [Youtube].xspf"
          fileName = `${playlistTitle} [Youtube].xspf`;
      }


      // Now, save the XSPF content as a file
      saveXSPFFile(xspfContent, fileName);

      console.log(`XSPF content generated and attempting download as: ${fileName}`);
      console.log('Check your downloads folder.');

    } else {
      console.log('No videos found in this playlist or invalid playlist ID.');
    }

  } catch (error) {
    console.error('An error occurred during playlist retrieval or XSPF generation:', error, '\nEnsure the Invidious instance URL is correct and the playlist ID is valid.');
  }
}

// Helper function to escape special XML characters
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '<'; // Less than sign
            case '>': return '>'; // Greater than sign
            case '&': return '&'; // Ampersand
            case '\'': return ''; // Corrected: Single quote or apostrophe
            case '"': return '"'; // Double quote
        }
    });
}

// Function to save the generated XSPF content as a file via Blob
function saveXSPFFile(content, fileName) {
    // Create a Blob object with the XML content and correct MIME type
    const blob = new Blob([content], { type: 'application/xspf+xml;charset=utf-8' });

    // Create a temporary URL for the Blob
    const url = URL.createObjectURL(blob);

    // Create a hidden <a> element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // Set the file name for download

    // Simulate a click on the <a> element to trigger the download
    document.body.appendChild(a); // Appending is often needed for Firefox
    a.click();

    // Clean up: remove the <a> element and revoke the Blob URL to free up memory
    document.body.removeChild(a); // Remove from DOM
    URL.revokeObjectURL(url); // Release the object URL
}

// --- Launch the main function on script execution ---
// IMPORTANT: This code is intended to be run in a browser environment.
// If you are on a YouTube page directly, you will likely need a browser extension
// (e.g., using a Content Script) due to browser security restrictions
// like Content Security Policy (CSP) and Same-Origin Policy).
getPlaylistVideosAndGenerateXSPF();
