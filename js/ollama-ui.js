// js/ollama-ui.js

/**
 * Initializes the UI elements for the Ollama chat.
 * @param {HTMLElement} centerPane The main center pane element.
 * @returns {object} An object containing references to key UI elements.
 */
function initializeOllamaChatUI(centerPane) {
    centerPane.innerHTML = `
        <div id="chat-history-container" class="ollama-chat-history-container"></div>
        <div id="attached-files-container" class="attached-files-container"></div>
        <div id="chat-input-section" class="ollama-chat-input-section">
            <textarea id="chat-input" class="ollama-chat-input" placeholder="Type your message..."></textarea>
            <div class="chat-buttons-column">
                <button id="add-file-button" class="ollama-chat-add-file-button material-symbols-outlined">attach_file</button>
                <button id="clear-chat-button" class="ollama-chat-clear-button material-symbols-outlined">delete_sweep</button>
                <button id="save-chat-button" class="ollama-chat-save-button material-symbols-outlined">save</button>
                <button id="load-chat-button" class="ollama-chat-load-button material-symbols-outlined">folder_open</button>
                <button id="stop-button" class="ollama-chat-stop-button material-symbols-outlined" disabled>stop</button>
                <button id="send-button" class="ollama-chat-send-button material-symbols-outlined">send</button>
            </div>
        </div>
        <div id="context-length-section" class="context-length-section">
            <span class="context-length-label">Context Length:</span>
            <div class="progress-bar-container">
            <div id="context-progress-bar" class="progress-bar"></div>
            </div>
            <div id="context-progress-label">0 / 0 tokens</div>
        </div>
        <div id="response-time-section" class="context-length-section" style="display: none;">
            <span class="context-length-label">Est. Response Time:</span>
            <div id="response-time-label" class="context-progress-label" style="flex-grow: 0; margin-right: 10px;">0.00s</div>
            <div class="rate-details" style="font-size: 0.8em; display: flex; gap: 10px; align-items: center;">
                <span>Prompt: <span id="prompt-rate-label">0.00</span> t/s</span>
                <span>Response: <span id="response-rate-label">0.00</span> t/s</span>
            </div>
        </div>
        <div id="ollama-setup-section" class="ollama-setup-section">
            <div id="ollama-setup-header" class="ollama-setup-header collapsed">
                <span>Ollama Setup</span>
                <span class="material-symbols-outlined">expand_more</span>
            </div>
            <div id="ollama-setup-content" class="ollama-setup-content">
                <div class="ollama-setup-item">
                    <label for="ollama-address-input" class="ollama-label">Ollama Server Address:</label>
                    <input type="text" id="ollama-address-input" class="ollama-input" value="http://localhost:11434">
                </div>
                <div class="ollama-setup-item">
                    <label for="ollama-model-dropdown" class="ollama-label">Select Model:</label>
                    <select id="ollama-model-dropdown" class="ollama-dropdown"></select>
                    <button id="refresh-models-button" class="ollama-button material-symbols-outlined">refresh</button>
                </div>
            </div>
        </div>
    `;

    return {
        chatHistoryContainer: centerPane.querySelector('#chat-history-container'),
        attachedFilesContainer: centerPane.querySelector('#attached-files-container'),
        chatInput: centerPane.querySelector('#chat-input'),
        addFileButton: centerPane.querySelector('#add-file-button'),
        sendButton: centerPane.querySelector('#send-button'),
        stopButton: centerPane.querySelector('#stop-button'),
        ollamaAddressInput: centerPane.querySelector('#ollama-address-input'),
        ollamaModelDropdown: centerPane.querySelector('#ollama-model-dropdown'),
        ollamaSetupSection: centerPane.querySelector('#ollama-setup-section'),
        ollamaSetupHeader: centerPane.querySelector('#ollama-setup-header'),
        ollamaSetupContent: centerPane.querySelector('#ollama-setup-content'),
        contextLengthSection: centerPane.querySelector('#context-length-section'),
        contextProgressBar: centerPane.querySelector('#context-progress-bar'),
        contextProgressLabel: centerPane.querySelector('#context-progress-label'),
        responseTimeSection: centerPane.querySelector('#response-time-section'),
        responseTimeLabel: centerPane.querySelector('#response-time-label'),
        promptRateLabel: centerPane.querySelector('#prompt-rate-label'),
        responseRateLabel: centerPane.querySelector('#response-rate-label'),
        clearChatButton: centerPane.querySelector('#clear-chat-button'),
        saveChatButton: centerPane.querySelector('#save-chat-button'),
        loadChatButton: centerPane.querySelector('#load-chat-button'),
        refreshModelsButton: centerPane.querySelector('#refresh-models-button')
    };
}

/**
 * Adds event listeners to the UI elements.
 * @param {object} elements An object containing references to key UI elements.
 * @param {object} handlers An object containing handler functions for the events.
 */
function addOllamaChatEventListeners(elements, handlers) {
    elements.sendButton.addEventListener('click', handlers.onSendMessage);
    elements.stopButton.addEventListener('click', handlers.onStopChatProcessing);
    elements.addFileButton.addEventListener('click', handlers.onAddFileClick);
    elements.clearChatButton.addEventListener('click', handlers.onClearChatHistory);
    elements.saveChatButton.addEventListener('click', handlers.onSaveChat);
    elements.loadChatButton.addEventListener('click', handlers.onLoadChat);

    elements.chatHistoryContainer.addEventListener('click', (event) => {
        const target = event.target.closest('.file-card');
        if (target) {
            if (target.dataset.chatId && target.dataset.fileNumber) {
                handlers.onFileCardClick(parseInt(target.dataset.chatId, 10), parseInt(target.dataset.fileNumber, 10));
            } else if (target.dataset.attachedFileId) {
                handlers.onAttachedFileCardClick(target.dataset.attachedFileId);
            }
        }
    });

    elements.attachedFilesContainer.addEventListener('click', (event) => {
        const removeButton = event.target.closest('.attached-file-remove');
        if (removeButton) {
            handlers.onRemoveAttachedFile(removeButton.dataset.fileId);
        }
    });

    elements.chatHistoryContainer.addEventListener('contextmenu', handlers.onChatBubbleRightClick);
    elements.chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handlers.onSendMessage();
        }
    });
    elements.refreshModelsButton.addEventListener('click', handlers.onRefreshModels);
    elements.ollamaAddressInput.addEventListener('change', handlers.onOllamaAddressChange);
    elements.ollamaSetupHeader.addEventListener('click', handlers.onToggleOllamaSetup);
    elements.ollamaModelDropdown.addEventListener('change', handlers.onOllamaModelChange);
}

/**
 * Toggles the visibility of the Ollama setup section.
 * @param {HTMLElement} ollamaSetupSection The setup section element.
 * @param {HTMLElement} ollamaSetupHeader The header of the setup section.
 */
function toggleOllamaSetupUI(ollamaSetupSection, ollamaSetupHeader) {
    const isExpanded = ollamaSetupSection.classList.toggle('expanded');
    if (isExpanded) {
        ollamaSetupHeader.classList.remove('collapsed');
    } else {
        ollamaSetupHeader.classList.add('collapsed');
    }
}

/**
 * Renders the attached files in the UI.
 * @param {HTMLElement} container The container for attached files.
 * @param {Array<object>} attachedFiles The list of attached files.
 */
function renderAttachedFilesUI(container, attachedFiles) {
    if (attachedFiles.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = attachedFiles.map(file => `
        <div class="attached-file-card">
            <span class="material-symbols-outlined">description</span>
            <span class="attached-file-name">${escapeHTML(file.name)}</span>
            <button class="attached-file-remove material-symbols-outlined" data-file-id="${file.id}" title="Remove file">close</button>
        </div>
    `).join('');
}

/**
 * Updates the context length progress bar and label.
 * @param {HTMLElement} progressBar The progress bar element.
 * @param {HTMLElement} progressLabel The label element for progress.
 * @param {object|null} currentModelDetails Details of the currently selected model.
 * @param {number} promptTokens Number of tokens in the prompt.
 * @param {number} responseTokens Number of tokens in the response.
 */
function updateContextProgressBarUI(progressBar, progressLabel, currentModelDetails, promptTokens, responseTokens) {
    if (!currentModelDetails) {
        progressBar.style.width = '0%';
        progressLabel.textContent = 'Model context size unknown';
        return;
    }

    const parameters = currentModelDetails.parameters;
    let contextLength = 0;

    if (parameters && typeof parameters === 'string') {
        const contextSizeParam = parameters.split('\n').find(param => param.startsWith('num_ctx') || param.startsWith('n_ctx'));
        if (contextSizeParam) {
            contextLength = parseInt(contextSizeParam.split(/\s+/)[1], 10);
        }
    }

    if (contextLength > 0) {
        const totalTokens = promptTokens + responseTokens;
        const percentage = (totalTokens / contextLength) * 100;
        progressBar.style.width = `${percentage}%`;
        progressLabel.textContent = `${totalTokens} / ${contextLength} tokens`;
    } else {
        progressBar.style.width = '0%';
        progressLabel.textContent = 'Could not determine context size';
    }
}

/**
 * Updates the response time estimation card.
 * @param {HTMLElement} responseTimeSection The response time section element.
 * @param {HTMLElement} responseTimeLabel The label for total response time.
 * @param {HTMLElement} promptRateLabel The label for prompt evaluation rate.
 * @param {HTMLElement} responseRateLabel The label for response evaluation rate.
 * @param {Array<number>} responseTokenHistory History of response token counts.
 * @param {number} promptEvalRate Prompt evaluation rate.
 * @param {number} responseEvalRate Response evaluation rate.
 * @param {number} totalContextTokens Total tokens in context (prompt + response).
 */
function updateResponseTimeCardUI(responseTimeSection, responseTimeLabel, promptRateLabel, responseRateLabel, responseTokenHistory, promptEvalRate, responseEvalRate, totalContextTokens) {
    if (responseTokenHistory.length === 0) return;

    const avgResponseTokens = responseTokenHistory.reduce((a, b) => a + b, 0) / responseTokenHistory.length;

    let totalTime = 0;
    if (promptEvalRate > 0 && responseEvalRate > 0) {
        const promptEvalTime = totalContextTokens / promptEvalRate;
        const responseParseTime = avgResponseTokens / responseEvalRate;
        totalTime = promptEvalTime + responseParseTime;
    }

    responseTimeSection.style.display = 'flex';
    responseTimeLabel.textContent = `${totalTime.toFixed(2)}s`;
    promptRateLabel.textContent = promptEvalRate.toFixed(2);
    responseRateLabel.textContent = responseEvalRate.toFixed(2);
}

/**
 * Creates a message element for the chat history.
 * @param {string} sender The sender of the message.
 * @param {string} content The content of the message.
 * @param {string[]} types CSS classes to apply to the message.
 * @returns {HTMLElement} The created message element.
 */
function createMessageElementUI(sender, content, ...types) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('ollama-message');
    types.forEach(type => {
        type.split(' ').forEach(cls => {
            if (cls) messageElement.classList.add(`ollama-${cls}`);
        });
    });

    const senderElement = document.createElement('div');
    senderElement.classList.add('ollama-message-sender');
    senderElement.textContent = sender;
    messageElement.appendChild(senderElement);

    const contentElement = document.createElement('div');
    contentElement.classList.add('ollama-message-content');
    contentElement.textContent = content;
    messageElement.appendChild(contentElement);

    const timestampElement = document.createElement('div');
    timestampElement.classList.add('ollama-message-timestamp');
    timestampElement.textContent = formatTimestamp(new Date()); // Get current time
    senderElement.appendChild(timestampElement);

    return messageElement;
}

/**
 * Formats a Date object into a human-readable time string (e.g., "3:40 PM").
 * @param {Date} date The date object to format.
 * @returns {string} The formatted time string.
 */
function formatTimestamp(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}

/**
 * Renders the display buffer into a given element, handling file cards and think sections.
 * @param {HTMLElement} element The element to render content into.
 * @param {string} bufferContent The content to render.
 * @param {boolean} isStreamComplete Whether the stream is complete, for final processing.
 */
function renderDisplayBufferUI(element, bufferContent, isStreamComplete = false) {
    let processedContent = bufferContent.replace(/<!file chatId=(\d+) fileNumber=(\d+)>/g, (match, chatId, fileNumber) => {
        return `<div class="file-card" data-chat-id="${chatId}" data-file-number="${fileNumber}">
                    <span class="material-symbols-outlined">description</span>
                    <span class="file-card-text">File ${parseInt(fileNumber) + 1} (Chat ${chatId})</span>
                </div>`;
    });
    
    processedContent = processedContent.replace(/<!attached-file id=([^>\s]+) name=([^>]+)>/g, (match, fileId, fileName) => {
        return `<div class="file-card attached-file-card-display" data-attached-file-id="${fileId}">
                    <span class="material-symbols-outlined">attach_file</span>
                    <span class="file-card-text">${escapeHTML(fileName)}</span>
                </div>`;
    });

    // Only process think tags when streaming is complete to avoid fragmented tag issues
    if (isStreamComplete) {
        processedContent = processThinkTags(processedContent);
    }
    
    element.innerHTML = processedContent;
}

/**
 * Processes content for think tags and wraps them in collapsible sections.
 * @param {string} content The content to process.
 * @returns {string} The content with think tags processed.
 */
function processThinkTags(content) {
    // First, handle properly closed <think>...</think> tags
    let processedContent = content.replace(/<think>([\s\S]*?)<\/think>/g, (match, thinkContent) => {
        const thinkId = `think-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return `<div class="think-section collapsed" data-think-id="${thinkId}">
                    <div class="think-header" onclick="window.toggleThinkSection('${thinkId}')">
                        <div class="think-header-text">
                            <span class="material-symbols-outlined">psychology</span>
                            <span>Thinking...</span>
                        </div>
                        <span class="think-toggle material-symbols-outlined">expand_more</span>
                    </div>
                    <div class="think-content">${escapeHTML(thinkContent.trim())}</div>
                </div>`;
    });

    // Handle unclosed <think> tags (treat everything after as think content)
    processedContent = processedContent.replace(/<think>(?![\s\S]*<\/think>)([\s\S]*)$/g, (match, thinkContent) => {
        const thinkId = `think-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return `<div class="think-section collapsed" data-think-id="${thinkId}">
                    <div class="think-header" onclick="window.toggleThinkSection('${thinkId}')">
                        <div class="think-header-text">
                            <span class="material-symbols-outlined">psychology</span>
                            <span>Thinking... (unclosed)</span>
                        </div>
                        <span class="think-toggle material-symbols-outlined">expand_more</span>
                    </div>
                    <div class="think-content">${escapeHTML(thinkContent.trim())}</div>
                </div>`;
    });

    return processedContent;
}
