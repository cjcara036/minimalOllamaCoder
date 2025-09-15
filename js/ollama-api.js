// js/ollama-api.js

/**
 * Fetches available Ollama models from the specified address.
 * @param {string} address The Ollama server address.
 * @param {function(string, string, string): void} displayMessageCallback Callback to display system messages.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of Ollama models.
 */
async function fetchOllamaModels(address, displayMessageCallback) {
    if (!address) {
        displayMessageCallback('System', 'Please set the Ollama server address first.', 'system error');
        return [];
    }

    displayMessageCallback('System', 'Fetching available Ollama models...', 'system');

    try {
        const response = await fetch(`${address}/api/tags`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        displayMessageCallback('System', `Found ${data.models.length} models.`, 'system');
        return data.models || [];
    } catch (error) {
        console.error('Error fetching Ollama models:', error);
        displayMessageCallback('System', `Failed to fetch models: ${error.message}. Check server address and ensure Ollama is running.`, 'system error');
        return [];
    }
}

/**
 * Fetches details for a specific Ollama model.
 * @param {string} address The Ollama server address.
 * @param {string} selectedModel The name of the selected model.
 * @param {function(string, string, string): void} displayMessageCallback Callback to display system messages.
 * @returns {Promise<object|null>} A promise that resolves to the model details or null if an error occurs.
 */
async function fetchModelDetails(address, selectedModel, displayMessageCallback) {
    if (!selectedModel || !address) return null;

    try {
        const response = await fetch(`${address}/api/show`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: selectedModel }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching model details:', error);
        displayMessageCallback('System', `Failed to fetch details for model ${selectedModel}: ${error.message}`, 'system error');
        return null;
    }
}

/**
 * Sends a chat message to the Ollama server and streams the response.
 * @param {string} ollamaAddress The Ollama server address.
 * @param {string} selectedModel The name of the selected model.
 * @param {Array<object>} messages The chat history messages.
 * @param {string} currentMessageContent The content of the current user message.
 * @param {AbortController} abortController The AbortController for cancelling the request.
 * @param {function(string): void} onChunkReceived Callback for each chunk of streamed content.
 * @param {function(object): void} onDoneReceived Callback when the stream is complete.
 * @param {function(string, string, string): void} displayMessageCallback Callback to display system messages.
 * @returns {Promise<void>} A promise that resolves when the streaming is complete.
 */
async function sendOllamaChatMessage(
    ollamaAddress,
    selectedModel,
    messages,
    abortController,
    onChunkReceived,
    onDoneReceived,
    displayMessageCallback
) {
    const signal = abortController.signal;

    try {
        const response = await fetch(`${ollamaAddress}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages,
                stream: true,
            }),
            signal: signal,
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                onDoneReceived({}); // Signal completion
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim() === '') continue;
                try {
                    const data = JSON.parse(line);
                    if (data.done) {
                        onDoneReceived(data);
                        return; // Exit function after done message
                    }
                    if (data.message && data.message.content) {
                        onChunkReceived(data.message.content);
                    }
                } catch (parseError) {
                    console.warn('Error parsing Ollama stream chunk:', parseError, 'Chunk:', line);
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted by user.');
        } else {
            console.error('Error sending message to Ollama:', error);
            displayMessageCallback('System', `Error communicating with Ollama: ${error.message}`, 'system error');
        }
        throw error; // Re-throw to be caught by the caller for final cleanup
    }
}
