// js/ollama-chat.js

class OllamaChat {
    // All fields are now public
    centerPane;
    ollamaModels = []; // To store available models
    messages = []; // To store chat history for context
    MSG_START_INDEX = 0; // New property to mark the start of messages to send to Ollama
    fileStore = []; // To store file content from chat
    abortController = null; // To manage ongoing fetch requests
    attachedContext = ''; // Private variable to store attached context
    attachedFiles = []; // To store attached files for display and context
    static FIRST_CHAT = true; // Changed to public static

    // UI Elements
    uiElements = {};
    currentModelDetails;

    // New properties for response time estimation
    responseTokenHistory = [];
    promptEvalRate = 0;
    responseEvalRate = 0;
    ollamaSystemIntegration; // New property for system integration
    contextCompressor; // New property for context compression

    constructor(centerPaneElementId) {
        this.centerPane = document.getElementById(centerPaneElementId);
        if (!this.centerPane) {
            console.error(`Center pane element with ID '${centerPaneElementId}' not found.`);
            return;
        }
        this.initializeChat();
        this.contextCompressor = new ContextCompressor(this);
        this.loadOllamaAddress(); // Load saved address on startup
        this.fetchOllamaModels(); // Fetch models on startup
    }

    setSystemIntegration(integration) {
        this.ollamaSystemIntegration = integration;
    }

    initializeChat() {
        this.uiElements = initializeOllamaChatUI(this.centerPane);
        addOllamaChatEventListeners(this.uiElements, {
            onSendMessage: () => this.sendMessage(),
            onStopChatProcessing: () => this.stopChatProcessing(),
            onAddFileClick: () => this.handleAddFileClick(),
            onClearChatHistory: () => this.clearChatHistory(),
            onSaveChat: () => this.saveChat(),
            onLoadChat: () => this.loadChat(),
            onFileCardClick: (chatId, fileNumber) => this.handleFileCardClick(chatId, fileNumber),
            onAttachedFileCardClick: (fileId) => this.handleAttachedFileCardClick(fileId),
            onRemoveAttachedFile: (fileId) => this.removeAttachedFile(fileId),
            onChatBubbleRightClick: (event) => this.handleChatBubbleRightClick(event),
            onRefreshModels: () => this.fetchOllamaModels(),
            onOllamaAddressChange: () => {
                localStorage.setItem('ollamaAddress', this.uiElements.ollamaAddressInput.value.trim());
                this.fetchOllamaModels();
            },
            onToggleOllamaSetup: () => toggleOllamaSetupUI(this.uiElements.ollamaSetupSection, this.uiElements.ollamaSetupHeader),
            onOllamaModelChange: () => {
                localStorage.setItem('ollamaSelectedModel', this.uiElements.ollamaModelDropdown.value);
                this.fetchModelDetails();
            }
        });
    }

    stopChatProcessing() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            this.uiElements.sendButton.disabled = false;
            this.uiElements.stopButton.disabled = true;
        }
    }

    clearChatHistory() {
        this.uiElements.chatHistoryContainer.innerHTML = '';
        this.messages = []; // Clear the message history
        this.fileStore = []; // Clear the file store
        this.attachedFiles = []; // Clear attached files
        this.attachedContext = ''; // Clear attached context
        this.renderAttachedFiles(); // Update the attached files display
        
        if (window.rightPane) {
            window.rightPane.clearCanvas(); // Clear the right pane canvas
        }
        this.displayMessage('System', 'Chat history cleared.', ['system']);
        updateContextProgressBarUI(this.uiElements.contextProgressBar, this.uiElements.contextProgressLabel, this.currentModelDetails, 0, 0); // Reset context length count
        
        // Reset response time estimation
        this.responseTokenHistory = [];
        this.promptEvalRate = 0;
        this.responseEvalRate = 0;
        if (this.uiElements.responseTimeSection) {
            this.uiElements.responseTimeSection.style.display = 'none';
        }
        OllamaChat.FIRST_CHAT = true; // Reset FIRST_CHAT on clear chat
    }

    // Public method to add content to attachedContext
    addAttachedContext(text) {
        this.attachedContext += text + '\n';
    }

    // Public method to clear attachedContext
    clearAttachedContext() {
        this.attachedContext = '';
    }

    // Public method for the tool to send messages
    sendToolMessage(content) {
        this.displayMessage('Tool', content, ['tool']);
    }

    // Public method for the tool to read messages
    getMessages() {
        return this.messages;
    }

    // Public method to set MSG_START_INDEX
    setMsgStartIndex(index) {
        if (index >= 0 && index <= this.messages.length) {
            this.MSG_START_INDEX = index;
            this.displayMessage('System', `Message start index set to ${index}.`, ['system']);
        } else {
            this.displayMessage('System', `Invalid message start index: ${index}. Must be between 0 and ${this.messages.length}.`, ['system', 'error']);
        }
    }

    loadOllamaAddress() {
        const savedAddress = localStorage.getItem('ollamaAddress');
        if (savedAddress) {
            this.uiElements.ollamaAddressInput.value = savedAddress;
        }
    }

    async fetchOllamaModels() {
        const address = this.uiElements.ollamaAddressInput.value.trim();
        this.uiElements.ollamaModelDropdown.innerHTML = '<option value="">Loading models...</option>';
        this.uiElements.ollamaModelDropdown.disabled = true;
        
        this.ollamaModels = await fetchOllamaModels(address, (sender, msg, type) => this.displayMessage(sender, msg, [type]));
        
        this.populateModelDropdown();
        this.fetchModelDetails();
        this.uiElements.ollamaModelDropdown.disabled = this.ollamaModels.length === 0;
    }

    populateModelDropdown() {
        this.uiElements.ollamaModelDropdown.innerHTML = '';
        if (this.ollamaModels.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models available';
            this.uiElements.ollamaModelDropdown.appendChild(option);
            return;
        }

        this.ollamaModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            this.uiElements.ollamaModelDropdown.appendChild(option);
        });

        // Select previously chosen model if available
        const savedModel = localStorage.getItem('ollamaSelectedModel');
        if (savedModel && this.ollamaModels.some(model => model.name === savedModel)) {
            this.uiElements.ollamaModelDropdown.value = savedModel;
        } else if (this.ollamaModels.length > 0) {
            this.uiElements.ollamaModelDropdown.value = this.ollamaModels[0].name;
        }
    }

    async fetchModelDetails() {
        const selectedModel = this.uiElements.ollamaModelDropdown.value;
        const address = this.uiElements.ollamaAddressInput.value.trim();
        
        this.currentModelDetails = await fetchModelDetails(address, selectedModel, (sender, msg, type) => this.displayMessage(sender, msg, [type]));
        updateContextProgressBarUI(this.uiElements.contextProgressBar, this.uiElements.contextProgressLabel, this.currentModelDetails, 0, 0);
    }

    updateContextProgressBar(promptTokens, responseTokens) {
        updateContextProgressBarUI(this.uiElements.contextProgressBar, this.uiElements.contextProgressLabel, this.currentModelDetails, promptTokens, responseTokens);
    }

    updateResponseTimeCard(totalContextTokens) {
        updateResponseTimeCardUI(
            this.uiElements.responseTimeSection,
            this.uiElements.responseTimeLabel,
            this.uiElements.promptRateLabel,
            this.uiElements.responseRateLabel,
            this.responseTokenHistory,
            this.promptEvalRate,
            this.responseEvalRate,
            totalContextTokens
        );
    }

    async sendMessage(isAutomatic = false, messageContent = '') {
        if (!isAutomatic) {
            messageContent = this.uiElements.chatInput.value.trim();
            if (!messageContent) return;
            if (this.ollamaSystemIntegration) {
                this.ollamaSystemIntegration.resetToolCallCount(); // Reset tool call count on user-initiated message
            }
        }

        if (OllamaChat.FIRST_CHAT) {
            OllamaChat.FIRST_CHAT = false;
            if (this.ollamaSystemIntegration) {
                const systemMessageContent = await this.ollamaSystemIntegration.generateSystemMessage();
                if (systemMessageContent) {
                    this.messages.push({ role: 'system', content: systemMessageContent });
                }
            }
        }

        let userDisplayContent = messageContent;
        const currentChatId = this.messages.length;
        
        if (this.attachedFiles.length > 0 && !isAutomatic) { // Only attach files for user-initiated messages
            this.attachedFiles.forEach(file => {
                this.fileStore.push({
                    chatIndex: currentChatId,
                    fileNumber: file.id,
                    fileContent: file.content,
                    fileName: file.name,
                    isUserAttached: true
                });
            });
            
            const fileCards = this.attachedFiles.map(file => 
                `<!attached-file id=${file.id} name=${file.name}>`
            ).join('');
            userDisplayContent += '\n\n' + fileCards;
        }

        if (!isAutomatic) { // Only display user message for user-initiated messages
            this.displayMessage('User', userDisplayContent, ['user']);
        }

        let messageToSend = messageContent;
        if (this.attachedContext && !isAutomatic) { // Only attach context for user-initiated messages
            messageToSend += '\n\n' + this.attachedContext;
            this.clearAttachedContext();
            this.attachedFiles = [];
            this.renderAttachedFiles();
        }
        
        if (!isAutomatic) {
            this.uiElements.chatInput.value = '';
        }

        const ollamaAddress = this.uiElements.ollamaAddressInput.value.trim();
        const selectedModel = this.uiElements.ollamaModelDropdown.value;

        if (!ollamaAddress || !selectedModel) {
            this.displayMessage('System', 'Please configure Ollama server address and select a model.', ['system', 'error']);
            return;
        }

        this.displayMessage('Ollama', '...', ['ollama', 'loading']);
        this.uiElements.sendButton.disabled = true;
        this.uiElements.stopButton.disabled = false;
        this.abortController = new AbortController();

        try {
            const messagesToSend = this.messages.slice(this.MSG_START_INDEX);
            const processedMessages = prepareMessagesForSending(messagesToSend, this.fileStore, messageToSend);
            
            let ollamaMessageElement = this.uiElements.chatHistoryContainer.querySelector('.ollama-message.ollama-loading:last-child');
            if (!ollamaMessageElement) {
                throw new Error('Failed to create or find Ollama message element');
            }
            let ollamaContentElement = ollamaMessageElement.querySelector('.ollama-message-content');
            ollamaContentElement.textContent = '';
            ollamaMessageElement.classList.remove('ollama-loading');

            const streamProcessor = new OllamaStreamProcessor(this.fileStore, ollamaContentElement, this.messages.length);

            await sendOllamaChatMessage(
                ollamaAddress,
                selectedModel,
                processedMessages,
                this.abortController,
                (chunk) => {
                    streamProcessor.processChunk(chunk);
                    this.uiElements.chatHistoryContainer.scrollTop = this.uiElements.chatHistoryContainer.scrollHeight;
                },
                async (data) => {
                    const finalContent = streamProcessor.finalizeStream();
                    this.messages.push({ role: 'assistant', content: finalContent });

                    const { prompt_eval_count, eval_count, prompt_eval_duration, eval_duration } = data;
                    if (prompt_eval_duration > 0) this.promptEvalRate = prompt_eval_count / (prompt_eval_duration / 1e9);
                    if (eval_duration > 0) this.responseEvalRate = eval_count / (eval_duration / 1e9);

                    if (eval_count > 0) {
                        this.responseTokenHistory.push(eval_count);
                        if (this.responseTokenHistory.length > 5) this.responseTokenHistory.shift();
                    }
                    
                    this.updateResponseTimeCard(prompt_eval_count + eval_count);
                    this.updateContextProgressBar(prompt_eval_count, eval_count);

                    // 1. Process tool calls first
                    if (this.ollamaSystemIntegration) {
                        await this.ollamaSystemIntegration.processOllamaResponse(finalContent);
                    }

                    // 2. Then, check if context compression is needed
                    await this.contextCompressor.compressIfNeeded(data);

                    if (this.contextCompressor.isCompressing) {
                        // If compression is triggered, send the summarization message automatically
                        await this.sendMessage(true, 'Summarize the conversation so far.');
                        this.contextCompressor.isCompressing = false; // Reset the flag after sending
                    } 
                    
                    // 3. Check if compression was just completed on the PREVIOUS turn to update the context
                    else if (this.messages.length > 1 && this.messages[this.messages.length - 1].role === 'assistant' && this.messages[this.messages.length - 2].role === 'tool') {
                        OllamaChat.FIRST_CHAT = true; // Reset to first chat mode after compression
                        this.setMsgStartIndex(this.messages.length - 1); // Point to the newly added summary message
                    }
                },
                (sender, msg, type) => this.displayMessage(sender, msg, [type])
            );

        } catch (error) {
            if (error.name !== 'AbortError') {
                const loadingMessage = this.uiElements.chatHistoryContainer.querySelector('.ollama-message.ollama-loading:last-child');
                if (loadingMessage) loadingMessage.remove();
                this.displayMessage('System', `Error communicating with Ollama: ${error.message}`, ['system', 'error']);
            }
        } finally {
            this.abortController = null;
            this.uiElements.sendButton.disabled = false;
            this.uiElements.stopButton.disabled = true;
        }
    }

    // Public method for the tool to send messages and trigger an automatic Ollama response
    async sendAutomaticMessage(content) {
        // Add the tool's message to the chat history
        this.messages.push({ role: 'tool', content: content });
        this.displayMessage('Tool', content, 'tool', true); // Always store tool messages
        
        // Immediately trigger a new Ollama request with the updated history
        // The messageContent for this automatic send can be empty or a specific prompt for continuation
        await this.sendMessage(true, ''); 
    }

    displayMessage(sender, content, types, shouldStoreMessage = true) {
        processAndDisplayMessage(sender, content, types, this.uiElements, this.messages, this.fileStore, shouldStoreMessage);
    }

    handleFileCardClick(chatId, fileNumber) {
        const file = this.fileStore.find(f => f.chatIndex === chatId && f.fileNumber === fileNumber);
        if (file) {
            if (window.rightPane) {
                window.rightPane.putToCanvas(file.fileContent);
                window.rightPane.setFileName(`File ${fileNumber + 1} (Chat ${chatId})`);
            } else {
                console.error('RightPane instance not found.');
                this.displayMessage('System', 'Error: Right pane not available to display file content.', ['system', 'error']);
            }
        } else {
            console.error(`File with chatId ${chatId} and fileNumber ${fileNumber} not found.`);
            this.displayMessage('System', `Error: File not found in store (chatId: ${chatId}, fileNumber: ${fileNumber}).`, ['system', 'error']);
        }
    }

    handleAttachedFileCardClick(fileId) {
        // Look for the file in the persistent file store using the file ID
        const file = this.fileStore.find(f => f.fileNumber === fileId && f.isUserAttached);
        if (file) {
            if (window.rightPane) {
                window.rightPane.putToCanvas(file.fileContent);
                window.rightPane.setFileName(file.fileName);
            } else {
                console.error('RightPane instance not found.');
                this.displayMessage('System', 'Error: Right pane not available to display file content.', ['system', 'error']);
            }
        } else {
            console.error(`Attached file with id ${fileId} not found.`);
            this.displayMessage('System', `Error: Attached file not found (id: ${fileId}).`, ['system', 'error']);
        }
    }

    async handleChatBubbleRightClick(event) {
        const chatBubble = event.target.closest('.ollama-message');
        if (chatBubble) {
            event.preventDefault(); // Prevent the default context menu

            const contentElement = chatBubble.querySelector('.ollama-message-content');
            if (contentElement) {
                const textToCopy = contentElement.textContent;
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    this.displayMessage('System', 'Chat bubble content copied to clipboard!', ['system']);
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    this.displayMessage('System', 'Failed to copy text to clipboard.', ['system', 'error']);
                }
            }
        }
    }

    handleAddFileClick() {
        handleAddFileClick(
            (fileName, content) => this.addFileToAttachedFiles(fileName, content),
            (sender, msg, type) => this.displayMessage(sender, msg, [type])
        );
    }

    addFileToAttachedFiles(fileName, content, filePath) {
        const fileId = Date.now().toString(); // Simple unique ID
        const attachedFile = {
            id: fileId,
            name: fileName,
            content: content,
            path: filePath // Store the full path
        };
        
        this.attachedFiles.push(attachedFile);
        this.renderAttachedFiles();
        this.updateAttachedContext();
    }

    removeAttachedFile(fileId) {
        this.attachedFiles = this.attachedFiles.filter(file => file.id !== fileId);
        this.renderAttachedFiles();
        this.updateAttachedContext();
    }

    renderAttachedFiles() {
        renderAttachedFilesUI(this.uiElements.attachedFilesContainer, this.attachedFiles);
    }

    updateAttachedContext() {
        this.attachedContext = this.attachedFiles.map(file => 
            `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``
        ).join('\n\n');
    }

    static addFileToContext(fileContent, fileName = 'Unknown File', filePath = 'Unknown Path') {
        const chatInstance = window.ollamaChatInstance;
        if (chatInstance) {
            chatInstance.addFileToAttachedFiles(fileName, fileContent, filePath);
        } else {
            console.error('OllamaChat instance not found.');
        }
    }

    static isFirstChat() {
        return OllamaChat.FIRST_CHAT;
    }

    saveChat() {
        const chatData = {
            messages: this.messages,
            fileStore: this.fileStore,
            attachedFiles: this.attachedFiles,
            msgStartIndex: this.MSG_START_INDEX // Include MSG_START_INDEX
        };
        const json = JSON.stringify(chatData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ollama_chat_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.displayMessage('System', 'Chat history saved successfully!', ['system']);
    }

    loadChat() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const chatData = JSON.parse(e.target.result);
                        this.messages = chatData.messages || [];
                        this.fileStore = chatData.fileStore || [];
                        this.attachedFiles = chatData.attachedFiles || [];
                        this.MSG_START_INDEX = chatData.msgStartIndex !== undefined ? chatData.msgStartIndex : 0; // Restore MSG_START_INDEX
                        this.renderChatHistory();
                        this.renderAttachedFiles();
                        this.displayMessage('System', 'Chat history loaded successfully!', ['system']);
                    } catch (parseError) {
                        this.displayMessage('System', `Error parsing chat file: ${parseError.message}`, ['system', 'error']);
                    }
                };
                reader.readAsText(file);
            } catch (error) {
                this.displayMessage('System', `Error loading chat file: ${error.message}`, ['system', 'error']);
            }
        };
        input.click();
    }

    renderChatHistory() {
        this.uiElements.chatHistoryContainer.innerHTML = ''; // Clear current display
        this.messages.forEach((msg, index) => {
            let displayContent = msg.content;
            
            // Re-insert file cards for messages that had them
            const filesForMessage = this.fileStore.filter(f => f.chatIndex === index && f.isUserAttached);
            if (filesForMessage.length > 0) {
                const fileCards = filesForMessage.map(file => 
                    `<!attached-file id=${file.fileNumber} name=${file.fileName}>`
                ).join('');
                displayContent += '\n\n' + fileCards;
            }

            // Re-insert file cards for files stored in fileStore but not attached
            const nonAttachedFilesForMessage = this.fileStore.filter(f => f.chatIndex === index && !f.isUserAttached);
            if (nonAttachedFilesForMessage.length > 0) {
                const fileCards = nonAttachedFilesForMessage.map(file => 
                    `<!file chatId=${file.chatIndex} fileNumber=${file.fileNumber}>`
                ).join('');
                displayContent += '\n\n' + fileCards;
            }

            this.displayMessage(msg.role, displayContent, [msg.role], false); // Do not store messages again when rendering history
        });
        this.uiElements.chatHistoryContainer.scrollTop = this.uiElements.chatHistoryContainer.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ollamaChatInstance = new OllamaChat('center-pane');
});
