/**
 * KHInsider XSPF Playlist Generator - V3.3
 * * Description:
 * Extracts direct audio links and full-res album cover from KHInsider.
 * * Usage:
 * Run in DevTools console on a KHInsider album page.
 */
(function() {
    try {
        console.log("--- Starting KHInsider XSPF Extraction (V3.3) ---");

        const playlistTable = document.getElementById('songlist');
        if (!playlistTable) {
            console.error("❌ Table #songlist not found! Ensure you are on an album page.");
            return;
        }

        // 1. Global Album Metadata
        const albumTitle = document.querySelector('h2')?.innerText.trim() || "Unknown Album";
        
        // Extract full-res image from the anchor's href inside .albumImage
        const albumImageAnchor = document.querySelector('.albumImage a');
        const albumImageUrl = albumImageAnchor ? albumImageAnchor.href : "";
        
        if (albumImageUrl) {
            console.log("📸 Full-res album cover detected:", albumImageUrl);
        }
        
        const sanitizedFilename = `${albumTitle.replace(/[\\/:*?"<>|]/g, '_')} [Khinsider].xspf`;

        // 2. Collect and Filter Track Rows
        const rows = Array.from(playlistTable.querySelectorAll('tr')).filter(row => {
            return row.querySelector('a[href*="/game-soundtracks/album/"]') && !row.querySelector('th');
        });

        if (rows.length === 0) {
            console.error("❌ No tracks found in the playlist table.");
            return;
        }

        console.log(`🚀 Found ${rows.length} tracks. Starting extraction loop...`);

        /**
         * Helper: Fetches the track page to get the direct CDN link
         */
        const getDirectLink = async (pageUrl) => {
            try {
                const response = await fetch(pageUrl);
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                // The songDownloadLink class is the most reliable way to find the MP3 link
                return doc.querySelector('.songDownloadLink')?.closest('a')?.href || null;
            } catch (err) {
                return null;
            }
        };

        /**
         * Main Logic: Iterate through tracks and build XSPF
         */
        const processTracks = async () => {
            const xspfTrackEntries = [];
            
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const trackLink = row.querySelector('a[href*="/game-soundtracks/album/"]');
                
                if (!trackLink) continue;

                const trackTitle = trackLink.innerText.trim();
                const trackPageUrl = trackLink.href;
                
                // Progress log (confirmed working after filter check)
                console.log(`[${i + 1}/${rows.length}] Extracting: ${trackTitle}...`);
                
                const directAudioUrl = await getDirectLink(trackPageUrl);
                
                if (!directAudioUrl) {
                    console.warn(`⚠️ Failed to retrieve link for: ${trackTitle}`);
                    continue;
                }

                // Duration extraction logic
                const cells = Array.from(row.querySelectorAll('td'));
                const durationCell = cells.find(td => /^\d+:\d+(:\d+)?$/.test(td.innerText.trim()));
                let durationMs = 0;
                if (durationCell) {
                    const parts = durationCell.innerText.trim().split(':').map(Number);
                    durationMs = parts.length === 2 ? (parts[0] * 60 + parts[1]) * 1000 : (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
                }

                xspfTrackEntries.push(`    <track>
      <location>${directAudioUrl.replace(/&/g, '&amp;')}</location>
      <title>${trackTitle.replace(/&/g, '&amp;')}</title>
      <album>${albumTitle.replace(/&/g, '&amp;')}</album>
      <trackNum>${i + 1}</trackNum>
      ${durationMs > 0 ? `<duration>${durationMs}</duration>` : ''}
    </track>`);
            }

            // 3. Assemble and Download XSPF
            let xspfContent = `<?xml version="1.0" encoding="UTF-8"?>\n<playlist version="1.0" xmlns="http://xspf.org/ns/0/">\n`;
            xspfContent += `  <title>${albumTitle.replace(/&/g, '&amp;')}</title>\n`;
            
            if (albumImageUrl) {
                xspfContent += `  <image>${albumImageUrl.replace(/&/g, '&amp;')}</image>\n`;
            }
            
            xspfContent += `  <trackList>\n${xspfTrackEntries.join('\n')}\n  </trackList>\n</playlist>`;

            const blob = new Blob([xspfContent], { type: 'application/xspf+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = sanitizedFilename;
            document.body.appendChild(a); // Append to body to ensure click works in all browsers
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log(`✅ Success! Playlist V3.3 downloaded: ${sanitizedFilename}`);
        };

        processTracks();

    } catch (globalError) {
        console.error("❌ A critical error occurred in V3.3:", globalError);
    }
})();