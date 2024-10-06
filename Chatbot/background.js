chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.url.match(/https:\/\/estudijas\.rtu\.lv\/course\/view\.php\?id=\d+/)) {
        chrome.tabs.sendMessage(details.tabId, { action: "checkAndUploadFiles" });
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "uploadComplete") {
        // Store the uploaded filename
        chrome.storage.local.get('uploadedFiles', (result) => {
            let uploadedFiles = result.uploadedFiles || [];
            uploadedFiles.push(message.filename);
            chrome.storage.local.set({ uploadedFiles: uploadedFiles }, () => {
                console.log('File stored:', message.filename);
            });
        });
    }
});