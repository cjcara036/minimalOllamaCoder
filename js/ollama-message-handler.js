// js/ollama-message-handler.js

function processAndDisplayMessage(sender, content, types, uiElements, messages, fileStore, shouldStoreMessage = true) {
    const messageElement = createMessageElementUI(sender, content, ...types);
    const contentElement = messageElement.querySelector('.ollama-message-content');

    let messageToStore = content;
    let contentToDisplay = content;

    if (shouldStoreMessage && (types.includes('user') || types.includes('tool'))) {
        const parts = content.split('```');
        if (parts.length > 1) {
            let newContent = '';
            const currentChatIndex = messages.length;
            let fileNumOffset = fileStore.filter(f => f.chatIndex === currentChatIndex).length;
            
            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 0) {
                    newContent += parts[i];
                } else {
                    const code = parts[i].trim();
                    fileStore.push({ chatIndex: currentChatIndex, fileNumber: fileNumOffset, fileContent: code });
                    newContent += `<!file chatId=${currentChatIndex} fileNumber=${fileNumOffset}>`;
                    fileNumOffset++;
                }
            }
            contentToDisplay = newContent;
            messageToStore = newContent;
        }
    }

    renderDisplayBufferUI(contentElement, contentToDisplay, true);
    
    uiElements.chatHistoryContainer.appendChild(messageElement);
    uiElements.chatHistoryContainer.scrollTop = uiElements.chatHistoryContainer.scrollHeight;

    if (shouldStoreMessage && !types.includes('system')) {
        const role = types.includes('user') ? 'user' : 'assistant';
        messages.push({ role, content: messageToStore });
    }
}

function prepareMessagesForSending(messages, fileStore, currentUserMessage) {
    const processedMessages = messages.map(msg => {
        if (typeof msg.content !== 'string') {
            return msg;
        }
        let newContent = msg.content;
        
        newContent = newContent.replace(/<!file chatId=(\d+) fileNumber=(\d+)>/g, (match, chatId, fileNumber) => {
            const file = fileStore.find(f => f.chatIndex === parseInt(chatId, 10) && f.fileNumber === parseInt(fileNumber, 10));
            return file ? "\\n```\\n" + file.fileContent + "\\n```" : match;
        });
        
        newContent = newContent.replace(/<!attached-file id=([^>\\s]+) name=([^>]+)>/g, (match, fileId, fileName) => {
            const file = fileStore.find(f => f.fileNumber === fileId && f.isUserAttached);
            return file ? "\\n```\\n" + file.fileContent + "\\n```" : match;
        });
        
        return { ...msg, content: newContent };
    });

    processedMessages.push({ role: 'user', content: currentUserMessage });
    return processedMessages;
}
