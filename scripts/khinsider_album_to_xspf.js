/**
 * KHInsider XSPF Playlist Generator - V3.2
 * * Description:
 * This script extracts direct audio links from downloads.khinsider.com album pages.
 * It performs asynchronous fetch requests to each track subpage to retrieve 
 * the final CDN URL, bypassing the intermediate HTML pages.
 * * Instructions:
 * 1. Open an album page on downloads.khinsider.com
 * 2. Open Browser DevTools (F12) and go to the Console tab.
 * 3. Paste and run this script.
 */
(function() {
    console.log("--- Starting KHInsider XSPF Extraction (V3.2) ---");

    // 1. Identify the Playlist Table (Target ID: #songlist)
    const playlistTable = document.getElementById('songlist');
    if (!playlistTable) {
        console.error("❌ Table #songlist not found! Please ensure you are on a valid album page.");
        return;
    }

    // 2. Album Metadata Extraction
    const albumTitle = document.querySelector('h2')?.innerText.trim() || "Unknown Album";
    const albumImage = document.querySelector('.album-front-cover img')?.src || "";
    
    // Final filename format: "Album Title [Khinsider].xspf"
    const sanitizedFilename = `${albumTitle.replace(/[\\/:*?"<>|]/g, '_')} [Khinsider].xspf`;

    // 3. Collect Track Rows
    // Filter rows to find those containing album track links, excluding header/footer <tr>
    const rows = Array.from(playlistTable.querySelectorAll('tr')).filter(row => {
        return row.querySelector('a[href*="/game-soundtracks/album/"]') && !row.querySelector('th');
    });

    console.log(`🚀 Found ${rows.length} tracks. Processing direct links (please wait)...`);

    /**
     * Helper: Fetches the track subpage and scrapes the direct audio download link
     * @param {string} pageUrl - The URL of the specific track page
     */
    const getDirectLink = async (pageUrl) => {
        try {
            const response = await fetch(pageUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Scrape the actual file link from the primary download button/link
            const directLink = doc.querySelector('.songDownloadLink')?.closest('a')?.href;
            return directLink || null;
        } catch (err) {
            console.error(`Error fetching data for: ${pageUrl}`, err);
            return null;
        }
    };

    /**
     * Main Async Execution Loop
     */
    const processTracks = async () => {
        const xspfTrackEntries = [];
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const trackLink = row.querySelector('a[href*="/game-soundtracks/album/"]');
            
            if (!trackLink) continue;

            const trackTitle = trackLink.innerText.trim();
            const trackPageUrl = trackLink.href;
            
            console.log(`[${i + 1}/${rows.length}] Extracting: ${trackTitle}...`);
            
            const directAudioUrl = await getDirectLink(trackPageUrl);
            
            if (!directAudioUrl) {
                console.warn(`⚠️ Warning: Could not find direct link for ${trackTitle}. Skipping.`);
                continue;
            }

            // Extract Duration (Handles formats: MM:SS or H:MM:SS)
            const cells = Array.from(row.querySelectorAll('td'));
            const durationCell = cells.find(td => /^\d+:\d+(:\d+)?$/.test(td.innerText.trim()));
            let durationMs = 0;
            if (durationCell) {
                const parts = durationCell.innerText.trim().split(':').map(Number);
                if (parts.length === 2) durationMs = (parts[0] * 60 + parts[1]) * 1000;
                if (parts.length === 3) durationMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
            }

            // Build the XSPF XML entry for the track
            xspfTrackEntries.push(`    <track>
      <location>${directAudioUrl.replace(/&/g, '&amp;')}</location>
      <title>${trackTitle.replace(/&/g, '&amp;')}</title>
      <album>${albumTitle.replace(/&/g, '&amp;')}</album>
      <trackNum>${i + 1}</trackNum>
      ${durationMs > 0 ? `<duration>${durationMs}</duration>` : ''}
    </track>`);
        }

        if (xspfTrackEntries.length === 0) {
            console.error("❌ No audio tracks were extracted successfully.");
            return;
        }

        // 4. Assemble XSPF XML structure
        const xspfContent = `<?xml version="1.0" encoding="UTF-8"?>
<playlist version="1.0" xmlns="http://xspf.org/ns/0/">
  <title>${albumTitle.replace(/&/g, '&amp;')}</title>
  ${albumImage ? `<image>${albumImage.replace(/&/g, '&amp;')}</image>` : ''}
  <trackList>
${xspfTrackEntries.join('\n')}
  </trackList>
</playlist>`;

        // 5. Generate Blob and trigger download
        const blob = new Blob([xspfContent], { type: 'application/xspf+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sanitizedFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`✅ Playlist ready! Filename: ${sanitizedFilename}`);
    };

    processTracks();
})();