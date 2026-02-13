/**
 * KHInsider XSPF Playlist Generator - V3.2
 * * Description:
 * This script extracts direct MP3 links from downloads.khinsider.com album pages.
 * It performs asynchronous fetch requests to each track's subpage to bypass 
 * the intermediate HTML redirect, ensuring the XSPF file contains the actual 
 * audio stream URL.
 * * Usage:
 * 1. Navigate to an album page on downloads.khinsider.com
 * 2. Open DevTools (F12) and paste this script into the Console.
 * 3. Wait for the extraction to complete.
 */
(function() {
    console.log("--- Starting KHInsider XSPF Extraction (V3.2) ---");

    // 1. Identify the Playlist Table (ID is #songlist)
    const playlistTable = document.getElementById('songlist');
    if (!playlistTable) {
        console.error("❌ Table #songlist not found! Make sure you are on an album page.");
        return;
    }

    // 2. Album Metadata Extraction
    const albumTitle = document.querySelector('h2')?.innerText.trim() || "Unknown Album";
    const albumImage = document.querySelector('.album-front-cover img')?.src || "";
    
    // Custom filename format as requested: "Album Title [Khinsider].xspf"
    const sanitizedFilename = `${albumTitle.replace(/[\\/:*?"<>|]/g, '_')} [Khinsider].xspf`;

    // 3. Collect Track Rows
    // Filter rows to include only those containing track links, excluding headers/footers
    const rows = Array.from(playlistTable.querySelectorAll('tr')).filter(row => {
        return row.querySelector('a[href*="/game-soundtracks/album/"]') && !row.querySelector('th');
    });

    console.log(`🚀 Found ${rows.length} tracks. Extracting direct links...`);

    /**
     * Helper: Fetches the track page and scrapes the direct MP3 download link
     * @param {string} pageUrl - The URL of the track's subpage
     */
    const getDirectLink = async (pageUrl) => {
        try {
            const response = await fetch(pageUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Scrape the primary download link (usually the first .songDownloadLink)
            const directLink = doc.querySelector('.songDownloadLink')?.closest('a')?.href;
            return directLink || null;
        } catch (err) {
            console.error(`Error fetching page: ${pageUrl}`, err);
            return null;
        }
    };

    /**
     * Main processing loop
     */
    const processTracks = async () => {
        const xspfTrackEntries = [];
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const trackLink = row.querySelector('a[href*="/game-soundtracks/album/"]');
            
            // Skip invalid rows
            if (!trackLink) continue;

            const trackTitle = trackLink.innerText.trim();
            const trackPageUrl = trackLink.href;
            
            console.log(`[${i + 1}/${rows.length}] Fetching direct link for: ${trackTitle}...`);
            
            const directMp3Url = await getDirectLink(trackPageUrl);
            
            if (!directMp3Url) {
                console.warn(`⚠️ Skipping ${trackTitle}: Direct link not found.`);
                continue;
            }

            // Extract Duration (Format: MM:SS or H:MM:SS)
            const cells = Array.from(row.querySelectorAll('td'));
            const durationCell = cells.find(td => /^\d+:\d+(:\d+)?$/.test(td.innerText.trim()));
            let durationMs = 0;
            if (durationCell) {
                const parts = durationCell.innerText.trim().split(':').map(Number);
                if (parts.length === 2) durationMs = (parts[0] * 60 + parts[1]) * 1000;
                if (parts.length === 3) durationMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
            }

            // Construct XSPF XML entry for this track
            xspfTrackEntries.push(`    <track>
      <location>${directMp3Url.replace(/&/g, '&amp;')}</location>
      <title>${trackTitle.replace(/&/g, '&amp;')}</title>
      <album>${albumTitle.replace(/&/g, '&amp;')}</album>
      <trackNum>${i + 1}</trackNum>
      ${durationMs > 0 ? `<duration>${durationMs}</duration>` : ''}
    </track>`);
        }

        if (xspfTrackEntries.length === 0) {
            console.error("❌ No valid tracks were processed.");
            return;
        }

        // 4. Assemble full XSPF Content
        const xspfContent = `<?xml version="1.0" encoding="UTF-8"?>
<playlist version="1.0" xmlns="http://xspf.org/ns/0/">
  <title>${albumTitle.replace(/&/g, '&amp;')}</title>
  ${albumImage ? `<image>${albumImage.replace(/&/g, '&amp;')}</image>` : ''}
  <trackList>
${xspfTrackEntries.join('\n')}
  </trackList>
</playlist>`;

        // 5. Trigger File Download
        const blob = new Blob([xspfContent], { type: 'application/xspf+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sanitizedFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`✅ Success! Playlist downloaded as: ${sanitizedFilename}`);
    };

    processTracks();
})();