let isLlamaMode = false;
let sessionId = null;
let threadId = null;

// Toggle chat widget visibility
document.getElementById('chat-toggle-button').addEventListener('click', function() {
    var chatWidget = document.getElementById('chat-widget');
    if (chatWidget.style.display === 'none' || chatWidget.style.display === '') {
        chatWidget.style.display = 'flex';
    } else {
        chatWidget.style.display = 'none';
    }
});

document.getElementById('chat-close-button').addEventListener('click', function() {
    var chatWidget = document.getElementById('chat-widget');
    chatWidget.style.display = 'none';
});

// Function to add a user message
function addUserMessage(message) {
    var chatMessages = document.getElementById('chat-messages');
    var messageContainer = document.createElement('div');
    messageContainer.className = 'chat-message user';
    var messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;
    messageContainer.appendChild(messageContent);
    chatMessages.appendChild(messageContainer);
    scrollToBottom();
}

// Function to add a responder message
function addResponderMessage(message) {
    var chatMessages = document.getElementById('chat-messages');
    var messageContainer = document.createElement('div');
    messageContainer.className = 'chat-message responder';
    var avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iODAwcHgiIGhlaWdodD0iODAwcHgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj4KICAgIDwhLS0gVXBsb2FkZWQgdG86IFNWRyBSZXBvLCB3d3cuc3ZncmVwby5jb20sIEdlbmVyYXRvcjogU1ZHIFJlcG8gTWl4ZXIgVG9vbHMgLS0+CiAgICA8dGl0bGU+aWNfZmx1ZW50X2JvdF8yNF9maWxsZWQ8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0i8J+UjS1Qcm9kdWN0LUljb25zIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8ZyBpZD0iaWNfZmx1ZW50X2JvdF8yNF9maWxsZWQiIGZpbGw9IiMyMTIxMjEiIGZpbGwtcnVsZT0ibm9uemVybyI+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0xNy43NTMwNTExLDEzLjk5OTkyMSBDMTguOTk1NjkxOCwxMy45OTk5MjEgMjAuMDAzMDUxMSwxNS4wMDcyODA0IDIwLjAwMzA1MTEsMTYuMjQ5OTIxIEwyMC4wMDMwNTExLDE3LjE1NTAwMDggQzIwLjAwMzA1MTEsMTguMjQ4Njc4NiAxOS41MjU1OTU3LDE5LjI4Nzg1NzkgMTguNjk1Nzc5MywyMC4wMDAyNzMzIEMxNy4xMzAzMzE1LDIxLjM0NDI0NCAxNC44ODk5OTYyLDIyLjAwMTA3MTIgMTIsMjIuMDAxMDcxMiBDOS4xMTA1MDI0NywyMi4wMDEwNzEyIDYuODcxNjg0MzYsMjEuMzQ0NDY5MSA1LjMwODgxNzI3LDIwLjAwMDc4ODUgQzQuNDgwMTk2MjUsMTkuMjg4Mzk4OCA0LjAwMzU0MTUzLDE4LjI1MDAwMDIgNC4wMDM1NDE1MywxNy4xNTcyNDA4IEw0LjAwMzU0MTUzLDE2LjI0OTkyMSBDNC4wMDM1NDE1MywxNS4wMDcyODA0IDUuMDEwOTAwODQsMTMuOTk5OTIxIDYuMjUzNTQxNTMsMTMuOTk5OTIxIEwxNy43NTMwNTExLDEzLjk5OTkyMSBaIE0xMS44OTg1NjA3LDIuMDA3MzQwOTMgTDEyLjAwMDMzMTIsMi4wMDA0OTQzMiBDMTIuMzgwMDI3LDIuMDAwNDk0MzIgMTIuNjkzODIyMiwyLjI4MjY0ODIgMTIuNzQzNDg0NiwyLjY0ODcyMzc2IEwxMi43NTAzMzEyLDIuNzUwNDk0MzIgTDEyLjc0OTU0MTUsMy40OTk0OTQzMiBMMTYuMjUsMy41IEMxNy40OTI2NDA3LDMuNSAxOC41LDQuNTA3MzU5MzEgMTguNSw1Ljc1IEwxOC41LDEwLjI1NDU5MSBDMTguNSwxMS40OTcyMzE3IDE3LjQ5MjY0MDcsMTIuNTA0NTkxIDE2LjI1LDEyLjUwNDU5MSBMNy43NSwxMi41MDQ1OTEgQzYuNTA3MzU5MzEsMTIuNTA0NTkxIDUuNSwxMS40OTcyMzE3IDUuNSwxMC4yNTQ1OTEgTDUuNSw1Ljc1IEM1LjUsNC41MDczNTkzMSA2LjUwNzM1OTMxLDMuNSA3Ljc1LDMuNSBMMTEuMjQ5NTQxNSwzLjQ5OTQ5NDMyIEwxMS4yNTAzMzEyLDIuNzUwNDk0MzIgQzExLjI1MDMzMTIsMi4zNzA3OTg1NSAxMS41MzI0ODUxLDIuMDU3MDAzMzYgMTEuODk4NTYwNywyLjAwNzM0MDkzIEwxMi4wMDAzMzEyLDIuMDAwNDk0MzIgTDExLjg5ODU2MDcsMi4wMDczNDA5MyBaIE05Ljc0OTI4OTA1LDYuNSBDOS4wNTkzMjU3Niw2LjUgOC41LDcuMDU5MzI1NzYgOC41LDcuNzQ5Mjg5MDUgQzguNSw4LjQzOTI1MjM1IDkuMDU5MzI1NzYsOC45OTg1NzgxMSA5Ljc0OTI4OTA1LDguOTk4NTc4MTEgQzEwLjQzOTI1MjMsOC45OTg1NzgxMSAxMC45OTg1NzgxLDguNDM5MjUyMzUgMTAuOTk4NTc4MSw3Ljc0OTI4OTA1IEMxMC45OTg1NzgxLDcuMDU5MzI1NzYgMTAuNDM5MjUyMyw2LjUgOS43NDkyODkwNSw2LjUgWiBNMTQuMjQyMDI1NSw2LjUgQzEzLjU1MjA2MjIsNi41IDEyLjk5MjczNjQsNy4wNTkzMjU3NiAxMi45OTI3MzY0LDcuNzQ5Mjg5MDUgQzEyLjk5MjczNjQsOC40MzkyNTIzNSAxMy41NTIwNjIyLDguOTk4NTc4MTEgMTQuMjQyMDI1NSw4Ljk5ODU3ODExIEMxNC45MzE5ODg4LDguOTk4NTc4MTEgMTUuNDkxMzE0NSw4LjQzOTI1MjM1IDE1LjQ5MTMxNDUsNy43NDkyODkwNSBDMTUuNDkxMzE0NSw3LjA1OTMyNTc2IDE0LjkzMTk4ODgsNi41IDE0LjI0MjAyNTUsNi41IFoiIGlkPSLwn46oLUNvbG9yIj4KDTwvcGF0aD4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg=="


    var messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;
    messageContainer.appendChild(avatar);
    messageContainer.appendChild(messageContent);
    chatMessages.appendChild(messageContainer);
    scrollToBottom();
}

// Function to scroll chat to the bottom
function scrollToBottom() {
    var chatBody = document.getElementById('chat-body');
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Handle send button click
document.getElementById('chat-send-button').addEventListener('click', sendMessage);

// Handle enter key press in input field
document.getElementById('chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
        e.preventDefault();
    }
});

// Modify the sendMessage function to use the appropriate chat service
function sendMessage() {
    var chatInput = document.getElementById('chat-input');
    var message = chatInput.value.trim();
    if (message !== '') {
        addUserMessage(message);
        chatInput.value = '';
        if (isLlamaMode) {
            sendLlamaMessage(message);
        } else {
            askQuestion(message, threadId).then(function(response) {
                threadId = response.threadId;
                addResponderMessage(filterAnswer(response.answer));
            });
        }
    }
}

function filterAnswer(answer) {
    const unwantedPattern = /【.*】/g;
    return answer.replace(unwantedPattern, '');
}

async function askQuestion(question, threadId = null) {
    try {
        const response = await fetch('http://127.0.0.1:5000/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: question,
                thread_id: threadId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(data.answer);
        return {
            answer: data.answer,
            threadId: data.thread_id
        };
    } catch (error) {
        console.error('Error asking question:', error);
        return {
            answer: 'Sorry, there was an error processing your question.',
            threadId: null
        };
    }
}

async function sendLlamaMessage(message) {
    try {
        const response = await fetch('http://127.0.0.1:5000/llama3', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: message,
                session_id: sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        sessionId = data.session_id;
        addResponderMessage(data.answer);
    } catch (error) {
        console.error('Error sending message to Llama:', error);
        addResponderMessage('Sorry, there was an error processing your message with Llama.');
    }
}

// Chat switcher functionality
document.getElementById('chat-switcher').addEventListener('click', function() {
    isLlamaMode = !isLlamaMode;
    this.textContent = isLlamaMode ? 'Switch to OpenAI' : 'Switch to Llama';
    document.getElementById('chat-messages').innerHTML = '';
    threadId = null;
    sessionId = null;
    addResponderMessage(isLlamaMode ? "Switched to Llama chat. How can I assist you?" : "Switched to OpenAI chat. How can I assist you?");
});
