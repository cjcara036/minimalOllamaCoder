// js/ollama-stream-processor.js

class OllamaStreamProcessor {
    #streamedContentBuffer = '';
    #rawContentBuffer = ''; // New buffer for raw, unsanitized content
    #displayBuffer = '';
    #fileCaptureBuffer = '';
    #inFile = false;
    #fileNumber = 0;
    #currentChatIndex = 0;
    #awaitingFirstNewlineInFile = false;

    #inThinkTag = false;
    #thinkBuffer = '';
    #tagDetectionBuffer = '';

    #fileStore = [];
    #ollamaContentElement;

    constructor(fileStore, ollamaContentElement, currentChatIndex) {
        this.#fileStore = fileStore;
        this.#ollamaContentElement = ollamaContentElement;
        this.#currentChatIndex = currentChatIndex;
    }

    processChunk(newContent) {
        this.#rawContentBuffer += newContent; // Append raw content to the new buffer
        const processedContent = this.#processThinkTagsWithSlidingWindow(newContent);
        this.#streamedContentBuffer += processedContent;

        if (CODE_TO_CANVAS) {
            let continueProcessing = true;
            while (continueProcessing) {
                continueProcessing = false;

                if (this.#inFile) {
                    if (this.#awaitingFirstNewlineInFile) {
                        const newlineIndex = this.#streamedContentBuffer.indexOf('\n');
                        if (newlineIndex !== -1) {
                            this.#streamedContentBuffer = this.#streamedContentBuffer.slice(newlineIndex + 1);
                            this.#awaitingFirstNewlineInFile = false;
                            continueProcessing = this.#streamedContentBuffer.length > 0;
                        }
                    } else {
                        const delimiterIndex = this.#streamedContentBuffer.indexOf("```");
                        if (delimiterIndex !== -1) {
                            const part = this.#streamedContentBuffer.slice(0, delimiterIndex);
                            this.#fileCaptureBuffer += part;
                            window.rightPane.appendToCanvas(part);

                            this.#fileStore.push({ chatIndex: this.#currentChatIndex, fileNumber: this.#fileNumber, fileContent: this.#fileCaptureBuffer });
                            const fileTag = `<!file chatId=${this.#currentChatIndex} fileNumber=${this.#fileNumber}>`;
                            this.#displayBuffer += fileTag;
                            this.#fileNumber++;
                            this.#fileCaptureBuffer = '';
                            this.#inFile = false;

                            this.#streamedContentBuffer = this.#streamedContentBuffer.slice(delimiterIndex + 3);
                            if (this.#streamedContentBuffer.startsWith('\n')) {
                                this.#streamedContentBuffer = this.#streamedContentBuffer.slice(1);
                            }
                            continueProcessing = this.#streamedContentBuffer.length > 0;
                        } else {
                            const bufferTail = this.#streamedContentBuffer.slice(-2);
                            const processableContent = this.#streamedContentBuffer.slice(0, -2);
                            
                            if (processableContent.length > 0) {
                                this.#fileCaptureBuffer += processableContent;
                                window.rightPane.appendToCanvas(processableContent);
                                this.#streamedContentBuffer = bufferTail;
                            }
                        }
                    }
                } else {
                    const delimiterIndex = this.#streamedContentBuffer.indexOf("```");
                    if (delimiterIndex !== -1) {
                        const part = this.#streamedContentBuffer.slice(0, delimiterIndex);
                        this.#displayBuffer += escapeHTML(part);

                        window.rightPane.clearCanvas();
                        this.#inFile = true;
                        this.#awaitingFirstNewlineInFile = true;

                        this.#streamedContentBuffer = this.#streamedContentBuffer.slice(delimiterIndex + 3);
                        continueProcessing = this.#streamedContentBuffer.length > 0;
                    } else {
                        this.#displayBuffer += escapeHTML(this.#streamedContentBuffer);
                        this.#streamedContentBuffer = '';
                    }
                }
            }
            renderDisplayBufferUI(this.#ollamaContentElement, this.#displayBuffer);
        } else {
            this.#displayBuffer += escapeHTML(this.#streamedContentBuffer);
            this.#streamedContentBuffer = '';
            renderDisplayBufferUI(this.#ollamaContentElement, this.#displayBuffer);
        }
    }

    finalizeStream() {
        this.processChunk(''); // Process any last bits

        if (this.#inThinkTag && this.#thinkBuffer.trim()) {
            const thinkId = `think-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const thinkSection = `<div class="think-section collapsed" data-think-id="${thinkId}">
                <div class="think-header" onclick="window.toggleThinkSection('${thinkId}')">
                    <div class="think-header-text">
                        <span class="material-symbols-outlined">psychology</span>
                        <span>Thinking... (unclosed)</span>
                    </div>
                    <span class="think-toggle material-symbols-outlined">expand_more</span>
                </div>
                <div class="think-content">${escapeHTML(this.#thinkBuffer.trim())}</div>
            </div>`;
            this.#displayBuffer += thinkSection;
        }

        if (this.#inFile) {
            this.#fileStore.push({ chatIndex: this.#currentChatIndex, fileNumber: this.#fileNumber, fileContent: this.#fileCaptureBuffer });
            const fileTag = `<!file chatId=${this.#currentChatIndex} fileNumber=${this.#fileNumber}>`;
            this.#displayBuffer += fileTag;
            window.rightPane.clearCanvas();
        }
        
        renderDisplayBufferUI(this.#ollamaContentElement, this.#displayBuffer, true);
        return this.#rawContentBuffer; // Return the raw content for tool parsing
    }

    #processThinkTagsWithSlidingWindow(newContent) {
        this.#tagDetectionBuffer += newContent;
        if (this.#tagDetectionBuffer.length > 8) {
            this.#tagDetectionBuffer = this.#tagDetectionBuffer.slice(-8);
        }

        let processed = '';
        let i = 0;
        
        while (i < newContent.length) {
            if (this.#inThinkTag) {
                if (newContent.substring(i).startsWith('</think>')) {
                    const thinkId = `think-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const thinkSection = `<div class="think-section collapsed" data-think-id="${thinkId}">
                        <div class="think-header" onclick="window.toggleThinkSection('${thinkId}')">
                            <div class="think-header-text">
                                <span class="material-symbols-outlined">psychology</span>
                                <span>Thinking...</span>
                            </div>
                            <span class="think-toggle material-symbols-outlined">expand_more</span>
                        </div>
                        <div class="think-content">${escapeHTML(this.#thinkBuffer.trim())}</div>
                    </div>`;
                    
                    processed += thinkSection;
                    i += 8;
                    this.#inThinkTag = false;
                    this.#thinkBuffer = '';
                } else {
                    this.#thinkBuffer += newContent[i];
                    i++;
                }
            } else {
                if (newContent.substring(i).startsWith('<think>')) {
                    i += 7;
                    this.#inThinkTag = true;
                    this.#thinkBuffer = '';
                } else {
                    processed += newContent[i];
                    i++;
                }
            }
        }
        
        return processed;
    }
}
