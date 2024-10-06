// content.js

(async function() {
    // Fetch the chat widget HTML
    const response = await fetch(chrome.runtime.getURL('chat-widget.html'));
    const chatWidgetHTML = await response.text();

    // Create a container div and set its innerHTML
    const container = document.createElement('div');
    container.innerHTML = chatWidgetHTML;

    // Append the container to the body
    document.body.appendChild(container);

    // Inject CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = chrome.runtime.getURL('chat-widget.css');
    document.head.appendChild(cssLink);

    // Inject JS
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('chat-widget.js');
    document.body.appendChild(script);

    // Set chat icon URL
    document.getElementById('chat-icon').src = chrome.runtime.getURL('assets/chat.svg');

    // MIME type detection function
    function getMimeType(url) {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open('HEAD', url);
            request.onreadystatechange = () => {
                if (request.readyState === request.DONE) {
                    if (request.status === 200) {
                        const headers = request.getAllResponseHeaders();
                        const contentTypeHeader = headers.split('\n').find(header =>
                            header.toLowerCase().startsWith('content-type')
                        );
                        if (contentTypeHeader) {
                            resolve(contentTypeHeader.split(':')[1].trim());
                        } else {
                            reject(new Error('Content-Type header not found'));
                        }
                    } else {
                        reject(new Error(`HTTP error! status: ${request.status}`));
                    }
                }
            };
            request.send();
        });
    }

    // MIME type to file extension mapping
    const mimeToExtension = {
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'text/plain': 'txt',
        'text/html': 'html',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'application/zip': 'zip',
        // Add more MIME types and extensions as needed
    };

    async function getFileLinks() {
        const links = document.querySelectorAll('a[href*="/mod/resource/view.php"], a[href*="/mod/folder/view.php"]');
        const filePromises = Array.from(links).map(async link => {
            let url = link.href;
            let filename = link.textContent.trim().replace(/\s+/g, '_');

            // Handle onclick attribute for window.open cases
            const onclick = link.getAttribute('onclick');
            if (onclick) {
                const match = onclick.match(/window\.open\('([^']+)'/);
                if (match) {
                    url = match[1];
                }
            }

            // Ensure the URL includes the redirect parameter
            if (!url.includes('redirect=1')) {
                url += (url.includes('?') ? '&' : '?') + 'redirect=1';
            }

            try {
                const mimeType = await getMimeType(url);
                const extension = mimeToExtension[mimeType] || 'bin';

                // Ensure filename has the correct extension
                if (!filename.toLowerCase().endsWith(`.${extension}`)) {
                    filename += `.${extension}`;
                }

                return { url, filename, mimeType };
            } catch (error) {
                console.error(`Error getting MIME type for ${url}:`, error);
                return { url, filename: `${filename}.txt`, mimeType: 'text/plain' };
            }
        });

        return Promise.all(filePromises);
    }

    // Function to fetch a file as bytes
    async function fetchFileAsBytes(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        return new Uint8Array(await blob.arrayBuffer());
    }

    // Function to fetch and upload all files
    async function fetchAndUploadAllFiles() {
        const fileLinks = await getFileLinks();
        for (const file of fileLinks) {
            try {
                // Check if the file has already been uploaded
                const isUploaded = await new Promise((resolve) => {
                    chrome.storage.local.get('uploadedFiles', (result) => {
                        const uploadedFiles = result.uploadedFiles || [];
                        resolve(uploadedFiles.includes(file.filename));
                    });
                });

                if (isUploaded) {
                    console.log(`${file.filename} already uploaded, skipping.`);
                    continue;
                }

                // Fetch the file as bytes
                const bytes = await fetchFileAsBytes(file.url);

                // Create a Blob object from the bytes
                const blob = new Blob([bytes], { type: file.mimeType });

                // Prepare the form data
                const formData = new FormData();
                formData.append('file', blob, file.filename);

                // Upload the file to the /upload endpoint
                const uploadResponse = await fetch('http://127.0.0.1:5000/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (uploadResponse.ok) {
                    console.log(`Uploaded ${file.filename} successfully.`);
                    // Notify background script of successful upload
                    chrome.runtime.sendMessage({ action: "uploadComplete", filename: file.filename });
                } else {
                    const errorText = await uploadResponse.text();
                    console.error(`Failed to upload ${file.filename}:`, uploadResponse.statusText, errorText);
                }
            } catch (error) {
                console.error(`Error processing ${file.filename}:`, error);
            }
        }
        console.log('All files fetched and uploaded.');
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "checkAndUploadFiles") {
            fetchAndUploadAllFiles();
        }
    });
})();