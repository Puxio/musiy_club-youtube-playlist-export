// popup.js
// This script controls the behavior and UI of the extension's popup window.

// Wait for the popup's HTML document to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // Get references to the key UI elements defined in popup.html
    const exportBtn = document.getElementById('export-btn');       // The export button
    const statusMessage = document.getElementById('status-message'); // Status text area
    const errorMessage = document.getElementById('error-message');   // Error message area
    const successMessage = document.getElementById('success-message'); // Success message area

    // Initially, show a message indicating the extension is checking the current tab
    statusMessage.textContent = "Checking current tab...";

    // Request the current tab status from the background script
    // This helps determine if the active tab is a supported playlist/album page
    chrome.runtime.sendMessage({ action: "getTabStatus" }, (response) => {
        if (chrome.runtime.lastError) {
            // If the background script doesn't respond immediately or throws an error,
            // it might mean it hasn't received the page detection message from the content script yet,
            // or there was an issue. Default to a state where the button is disabled.
            console.warn("Could not get tab status immediately:", chrome.runtime.lastError.message);
            statusMessage.textContent = "Navigate to a playlist or an album page.";
            exportBtn.disabled = true;
        } else {
            // If the background responded successfully, update the UI based on its status
            console.log("Received initial tab status from background:", response);
            updateUI(response.valid);
        }
    });

    // Listen for messages sent *from* the background script to the popup
    // This is how the background script informs the popup about changes (e.g., page detected, export result)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("Popup received message from background:", request);

        // Handle message indicating a relevant page was detected in the current tab
        if (request.action === "pageDetected") {
            updateUI(true); // Enable the export button
            statusMessage.textContent = `Ready to export from ${request.site} (${request.type}).`;
            // Hide any previous error or success messages
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
        }
        // Handle message indicating no relevant page was detected
        else if (request.action === "pageNotDetected") {
            updateUI(false); // Disable the export button
            statusMessage.textContent = "Navigate to a playlist or an album page.";
            // Hide any previous error or success messages
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
        }
        // Handle message indicating an error occurred during the export process
        else if (request.action === "exportError") {
            // Show the error message received from the background
            errorMessage.textContent = `Error: ${request.message}`;
            errorMessage.style.display = 'block'; // Make the error message visible
            successMessage.style.display = 'none'; // Hide success message if it was shown
            statusMessage.textContent = "Export failed."; // Update status
            exportBtn.disabled = false; // Re-enable the button so the user can try again
        }
        // Handle message indicating the export process was successful
        else if (request.action === "exportSuccess") {
            // Show the success message with the filename
            successMessage.textContent = `Exported: ${request.filename}`;
            successMessage.style.display = 'block'; // Make the success message visible
            errorMessage.style.display = 'none'; // Hide error message if it was shown
            statusMessage.textContent = "Export completed!"; // Update status
            exportBtn.disabled = false; // Re-enable the button
            // Optional: You might want to clear the success message after a few seconds
            // setTimeout(() => { successMessage.style.display = 'none'; }, 5000);
        }
    });

    // Function to update the popup's UI elements (button state, messages) based on validity
    // isValid: Boolean indicating if the current tab is a valid page for export
    function updateUI(isValid) {
        // Enable or disable the export button based on the validity flag
        exportBtn.disabled = !isValid;

        if (isValid) {
            // If valid, set button text and status message accordingly
            exportBtn.textContent = "Export to XSPF";
            statusMessage.textContent = "Playlist or album found. Click to export.";
            // Hide any previous error or success messages
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
        } else {
            // If not valid, set button text and status message accordingly
            exportBtn.textContent = "N/A"; // Or keep it disabled with no specific text
            statusMessage.textContent = "Navigate to a playlist or an album page.";
            // Hide any previous error or success messages
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
        }
    }

    // Add an event listener to the export button
    exportBtn.addEventListener('click', () => {
        console.log("Export button clicked.");
        // Hide any previous error or success messages when a new export is started
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
        // Optionally, update the status message while export is processing
        statusMessage.textContent = "Exporting...";
        // Disable the button temporarily to prevent multiple clicks during export
        exportBtn.disabled = true;

        // Send a message to the background script to initiate the export process
        chrome.runtime.sendMessage({ action: "exportPlaylist" });
        // Note: The background script will handle the process and send back success/error messages
        // which this popup listens for using the chrome.runtime.onMessage listener above.
    });
});