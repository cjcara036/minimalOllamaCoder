// js/ollama-file-handling.js

/**
 * Handles the click event for adding a file, triggering file selection.
 * @param {function(string, string): void} addFileToAttachedFilesCallback Callback to add the file to attached files.
 * @param {function(string, string): void} displayMessageCallback Callback to display system messages.
 */
function handleAddFileClick(addFileToAttachedFilesCallback, displayMessageCallback) {
    if ('showOpenFilePicker' in window) {
        selectFileUsingAPI(addFileToAttachedFilesCallback, displayMessageCallback);
    } else {
        selectFileUsingInput(addFileToAttachedFilesCallback, displayMessageCallback);
    }
}

/**
 * Selects a file using the File System Access API.
 * @param {function(string, string): void} addFileToAttachedFilesCallback Callback to add the file to attached files.
 * @param {function(string, string): void} displayMessageCallback Callback to display system messages.
 */
async function selectFileUsingAPI(addFileToAttachedFilesCallback, displayMessageCallback) {
    try {
        const fileHandles = await window.showOpenFilePicker({
            multiple: false,
            types: [{
                description: 'Text files',
                accept: {
                    'text/*': ['.txt', '.js', '.css', '.html', '.json', '.md', '.py', '.java', '.cpp', '.c', '.xml', '.yml', '.yaml']
                }
            }]
        });

        if (fileHandles.length > 0) {
            const fileHandle = fileHandles[0];
            const file = await fileHandle.getFile();
            const content = await file.text();
            addFileToAttachedFilesCallback(file.name, content);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error selecting file:', error);
            displayMessageCallback('System', `Failed to select file: ${error.message}`, 'system error');
        }
    }
}

/**
 * Selects a file using a traditional file input (fallback).
 * @param {function(string, string): void} addFileToAttachedFilesCallback Callback to add the file to attached files.
 * @param {function(string, string): void} displayMessageCallback Callback to display system messages.
 */
function selectFileUsingInput(addFileToAttachedFilesCallback, displayMessageCallback) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.js,.css,.html,.json,.md,.py,.java,.cpp,.c,.xml,.yml,.yaml,text/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                addFileToAttachedFilesCallback(file.name, e.target.result);
            };
            reader.onerror = () => {
                displayMessageCallback('System', `Failed to read file: ${file.name}`, 'system error');
            };
            reader.readAsText(file);
        }
        document.body.removeChild(fileInput);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
}

/**
 * Updates the attached context string from the list of attached files.
 * @param {Array<object>} attachedFiles The list of attached files.
 * @returns {string} The updated attached context string.
 */
function updateAttachedContext(attachedFiles) {
    return attachedFiles.map(file => 
        `${file.name}\n\`\`\`\n${file.content}\n\`\`\``
    ).join('\n\n');
}
