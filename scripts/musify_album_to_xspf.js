/**
 * XSPF Playlist Generator for Musify.club
 * * This script is designed to run in the DevTools console of an Album/Playlist
 * page on musify.club. It extracts track details, constructs the XSPF file,
 * and initiates the download.
 * * NOTE: This version uses the intermediate track URL (from data-play-url)
 * instead of attempting an asynchronous fetch to the final MP3 URL, which 
 * is blocked by CORS policy in the browser environment. External players
 * (like VLC) will handle the necessary HTTP redirect to the final MP3 link.
 */
(function() {
    // --- Configuration & Selectors (Confirmed as working) ---
    const PLAY_ELEMENT_SELECTOR = '.play'; // Element containing the intermediate link (data-play-url)
    const BASE_URL = 'https://musify.club'; // Base URL (without trailing slash)
    
    // Selectors for track metadata within a '.playlist__item'
    const TRACK_ITEM_SELECTOR = '.playlist__item';
    const DURATION_ELEMENT_SELECTOR = 'div.track__details:not(.track__rating) span.text-muted';
    const TRACK_NUMBER_ELEMENT_SELECTOR = 'div.playlist__position';
    const TRACK_ARTIST_SELECTOR = 'a'; // Anchor tag for the Artist name
    const TRACK_TITLE_SELECTOR = 'a.strong'; // Anchor tag for the Track Title
    
    // Selectors for Album metadata
    const ALBUM_HEADER_SELECTOR = 'header.content__title h1';
    const ALBUM_IMAGE_SELECTOR = 'img.album-img';
    const ALBUM_INFO_LIST_SELECTOR = 'ul.album-info';
    // --- End Selectors ---

    // --- XML Escaping Helper ---
    const escapeXml = (unsafe) => {
       if (unsafe === null || unsafe === undefined) return '';
       return unsafe.toString().replace(/[<>&'"]/g, function (c) {
           switch (c) {
               case '<': return '&lt;';
               case '>': return '&gt;';
               case '&': return '&amp;';
               case "'": return '&apos;';
               case '"': return '&quot;';
           }
           return '';
       });
    };
    // --- End XML Escaping Helper ---
    
    // --- Album Info Extraction and Setup ---
    const albumInfoList = document.querySelector(ALBUM_INFO_LIST_SELECTOR);
    const isAlbumPage = !!albumInfoList;
    
    let albumArtist = 'Unknown Artist';
    let albumTitle = 'Unknown Album';
    let albumYear = 'UnknownYear';
    let albumImageUrl = null;
    let suggestedFilename = 'playlist.xspf'; 

    // Extract Artist and Year (if on an album page)
    if (isAlbumPage) {
        const byArtistElement = document.querySelector(`${ALBUM_INFO_LIST_SELECTOR} [itemprop=byArtist]`);
        if (byArtistElement) { albumArtist = byArtistElement.textContent.trim(); }
        const datePublishedElement = document.querySelector(`${ALBUM_INFO_LIST_SELECTOR} [itemprop=datePublished]`);
        if (datePublishedElement && datePublishedElement.hasAttribute('datetime')) {
            const datetimeValue = datePublishedElement.getAttribute('datetime');
            if (datetimeValue && datetimeValue.length >= 4) { albumYear = datetimeValue.slice(0, 4); }
        }
    }

    // Extract Title and construct the filename
    const albumHeaderElement = document.querySelector(ALBUM_HEADER_SELECTOR);
    if (albumHeaderElement) {
        let potentialTitleText = albumHeaderElement.textContent.trim();
        // Clean up title by removing artist and year (if present)
        if (albumArtist !== 'Unknown Artist' && potentialTitleText.startsWith(albumArtist)) {
            if (potentialTitleText.startsWith(`${albumArtist} - `)) {
                potentialTitleText = potentialTitleText.substring(`${albumArtist} - `.length).trim();
            }
        }
        if (albumYear !== 'UnknownYear' && potentialTitleText.endsWith(`(${albumYear})`)) {
             potentialTitleText = potentialTitleText.substring(0, potentialTitleText.lastIndexOf(`(${albumYear})`)).trim();
        } else if (albumYear !== 'UnknownYear' && potentialTitleText.endsWith(`${albumYear}`)) {
             potentialTitleText = potentialTitleText.substring(0, potentialTitleText.lastIndexOf(`${albumYear}`)).trim();
        }

        albumTitle = potentialTitleText || 'Unknown Album';
        // Add the required prefix and sanitize the filename
        suggestedFilename = `${albumArtist} (${albumYear}) - ${albumTitle} [Musify_club].xspf`.replace(/[\\/:*?"<>|]/g, '_');
        console.log(`Suggested filename: ${suggestedFilename}`);
    } else {
        console.warn(`Album header (${ALBUM_HEADER_SELECTOR}) not found. Cannot suggest filename or populate album tag.`);
    }

    // Extract Image URL
    const albumImageElement = document.querySelector(ALBUM_IMAGE_SELECTOR);
    if (albumImageElement && albumImageElement.src) {
        albumImageUrl = albumImageElement.src;
        console.log(`[Album Image] Found potential album image URL.`);
    }
    // --- End Album Info Extraction ---

    
    // --- Core Playlist Item Processing ---
    const allPlaylistItems = document.querySelectorAll(TRACK_ITEM_SELECTOR);
    const xspfTrackEntries = [];
    
    console.log(`--- Starting XSPF Playlist Extraction for ${allPlaylistItems.length} items ---`);

    if (allPlaylistItems.length === 0) {
        console.warn(`❌ No ${TRACK_ITEM_SELECTOR} elements found on the page. Check the selector.`);
        return; 
    }

    allPlaylistItems.forEach(function(playlistItem, index) {
        
        let url = null;
        const playElement = playlistItem.querySelector(PLAY_ELEMENT_SELECTOR);
        
        if (playElement) {
             let dataPlayUrl = playElement.getAttribute('data-play-url');
             if (dataPlayUrl) {
                // Ensure dataPlayUrl starts with '/' if necessary
                if (dataPlayUrl && !dataPlayUrl.startsWith('/')) {
                    dataPlayUrl = '/' + dataPlayUrl;
                }
                // Use the INTERMEDIATE URL (which redirects to MP3)
                url = BASE_URL + dataPlayUrl; 
             }
        }

        if (!url) {
            console.warn(`[Item Index ${index + 1}] Skip: Could not find the intermediate URL from data-play-url.`);
            return; 
        }

        // Synchronous track metadata extraction
        let durationInSeconds = -1;
        let trackTitle = 'Unknown Track';
        let trackArtist = 'Unknown Artist';
        let trackNumber = null;

        const artistLink = playlistItem.querySelector(TRACK_ARTIST_SELECTOR);
        if (artistLink) { trackArtist = artistLink.textContent.trim() || 'Unknown Artist'; }
        const trackLinkStrong = playlistItem.querySelector(TRACK_TITLE_SELECTOR);
        if (trackLinkStrong) { trackTitle = trackLinkStrong.textContent.trim() || 'Unknown Track'; }
        
        // Duration extraction (MM:SS to milliseconds)
        const durationElement = playlistItem.querySelector(DURATION_ELEMENT_SELECTOR);
        if (durationElement) {
            const timeParts = durationElement.textContent.trim().split(':');
            if (timeParts.length === 2) {
                const minutes = parseInt(timeParts[0], 10);
                const seconds = parseInt(timeParts[1], 10);
                if (!isNaN(minutes) && !isNaN(seconds)) { durationInSeconds = (minutes * 60) + seconds; }
            }
        }
        
        // Track number extraction
        const trackNumElement = playlistItem.querySelector(TRACK_NUMBER_ELEMENT_SELECTOR);
        if (trackNumElement) {
            const numText = trackNumElement.textContent.trim();
            if (numText !== '') { trackNumber = numText; }
        }

        // Construct XSPF <track> Entry
        let trackXml = '    <track>\n';
        trackXml += `      <location>${escapeXml(url)}</location>\n`; // Use intermediate URL
        if (durationInSeconds !== -1) { trackXml += `      <duration>${durationInSeconds * 1000}</duration>\n`; }
        if (trackArtist !== 'Unknown Artist') { trackXml += `      <creator>${escapeXml(trackArtist)}</creator>\n`; }
        if (trackTitle !== 'Unknown Track') { trackXml += `      <title>${escapeXml(trackTitle)}</title>\n`; }
        if (albumTitle !== 'Unknown Album') { trackXml += `      <album>${escapeXml(albumTitle)}</album>\n`; }
        if (trackNumber !== null) { trackXml += `      <trackNum>${escapeXml(trackNumber)}</trackNum>\n`; }
        trackXml += '    </track>';
        
        xspfTrackEntries.push(trackXml);
    });
    
    if (xspfTrackEntries.length > 0) {
        console.log(`✅ Formatting complete. Found ${xspfTrackEntries.length} valid tracks.`);

        // --- Construct the full XSPF content ---
        let xspfContent = '<?xml version="1.0" encoding="UTF-8"?>\n<playlist version="1.0" xmlns="http://xspf.org/ns/0/">\n';
        const pageUrl = location.href;
        if (pageUrl) { xspfContent += `  <location>${escapeXml(pageUrl)}</location>\n`; }
        // Conditionally add album image
        if (isAlbumPage && albumImageUrl) { xspfContent += `  <image>${escapeXml(albumImageUrl)}</image>\n`; }
        xspfContent += '  <trackList>\n';
        xspfContent += xspfTrackEntries.join('\n'); 
        xspfContent += '\n  </trackList>\n</playlist>';

        // --- Initiate Download ---
        const blob = new Blob([xspfContent], { type: 'application/xspf+xml' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`🎉 XSPF file "${suggestedFilename}" downloaded successfully.`);

    } else {
         console.warn('❌ No valid XSPF tracks created. Check selectors and intermediate URL extraction.');
    }
    console.log('--- End Processing ---');
})();
