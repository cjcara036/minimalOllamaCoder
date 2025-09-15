// js/ollama-system-integration.js

class OllamaSystemIntegration {
    // All fields are now public
    ollamaChat;
    fileExplorer;
    systemMessageGenerated = false;
    toolCallCount = 0; // To track consecutive tool calls
    MAX_TOOL_CALLS = window.MAX_AUTOMATED_REQUESTS; // Limit to prevent infinite loops, configurable via sysconfig

    constructor(ollamaChatInstance, fileExplorerInstance) {
        this.ollamaChat = ollamaChatInstance;
        this.fileExplorer = fileExplorerInstance;
    }

    resetToolCallCount() {
        this.toolCallCount = 0;
    }

    // Generates the initial system message with rules, file structure, and tool documentation
    async generateSystemMessage() {
        if (this.systemMessageGenerated) {
            return ''; // Only generate once per session
        }

        let message = "You are a code editor assistant. \n\n";
        message += "RULES:\n";
        message += "- When updating code, always provide the full code of the file being updated and always enclose it in markdown fenced code block symbols.\n";
        message += "- Use the tool calls available below to accomplish the User requests.\n";
        message += "- Multiple tool calls are allowed in a single response.\n";
        message += "- Use only the read_file tool call once per file\n";
        message += "- Notify the user when you are done with their request and provide a report on what was done to accomplish said request.\n\n";
        message += "Available Tool Calls:\n";
        message += "- <read_file><target>{full_file_path}</target></read_file>: Use this to read the content of a file. The `full_file_path` must be the complete path from the root of the selected directory (e.g., `folder/subfolder/file.js`). The tool's response will include the file content in a fenced code block. Example:\n";
        message += "  <read_file><target>path/to/file.js</target></read_file>\n";
        message += "- <write_file><target>{full_file_path}</target><content>```[language]\\n{file_content}\\n```</content></write_file>: Use this to write content to a file. The `full_file_path` must be the complete path from the root of the selected directory (e.g., `folder/subfolder/file.js`). The `content` parameter MUST contain the `file_content` enclosed in a markdown fenced code block (```) with an optional language identifier. Example:\n";
        message += "  <write_file><target>path/to/file.js</target><content>```javascript\\nconsole.log('Hello, World!');\\n```</content></write_file>\n";
        message += "Current File System Structure (full paths from root):\n";
        const fileStructure = this.fileExplorer.getFileStructure();
        if (fileStructure) {
            message += this.formatFileStructure(fileStructure, ''); // Start with empty base path
        } else {
            message += "No directory selected or file structure not available.\n";
        }
        
        this.systemMessageGenerated = true;
        return message;
    }

    formatFileStructure(node, currentPath) {
        let output = '';
        const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;

        if (node.kind === 'file') {
            output += `- ${fullPath}\n`;
        } else if (node.kind === 'directory') {
            // Only list directory name if it has children, otherwise it's just part of the path
            if (node.children && node.children.length > 0) {
                // output += `- ${fullPath}/\n`; // Optional: list directories themselves
            }
            if (node.children) {
                node.children.forEach(child => {
                    output += this.formatFileStructure(child, fullPath);
                });
            }
        }
        return output;
    }

    // New method to send a system message with the updated file structure
    updateFileStructureMessage() {
        let message = "File system structure has been updated (full paths from root):\n\n";
        const fileStructure = this.fileExplorer.getFileStructure();
        if (fileStructure) {
            message += this.formatFileStructure(fileStructure, '');
        } else {
            message += "No directory selected or file structure not available.\n";
        }
        this.ollamaChat.sendToolMessage(message);
    }

    // Processes an Ollama response for tool calls
    async processOllamaResponse(responseContent) {
        let toolResponse = '';
        const processedReadFiles = new Set();
        const writeFilesToExecute = new Map(); // filePath -> content

        // Collect all read_file tool calls
        const readFileRegex = /<read_file>\s*<target>(.*?)<\/target>\s*<\/read_file>/g;
        let match;
        const readFilePromises = [];

        while ((match = readFileRegex.exec(responseContent)) !== null) {
            const filePath = match[1].trim();
            if (!processedReadFiles.has(filePath)) {
                processedReadFiles.add(filePath);
                readFilePromises.push((async () => {
                    const fileContent = await this.handleReadFile(filePath);
                    if (fileContent !== null) {
                        return `<read_file><target>${filePath}</target></read_file>\n\`\`\`\n${fileContent}\n\`\`\`\n`;
                    } else {
                        return `<read_file><target>${filePath}</target></read_file>\nError: File not found or could not be read.\n`;
                    }
                })());
            }
        }

        // Collect all write_file tool calls, keeping only the last one for each file
        const writeFileRegex = /<write_file>\s*<target>(.*?)<\/target>\s*<content>\s*```(?:\w+)?\n([\s\S]*?)\n```\s*<\/content>\s*<\/write_file>/g;
        while ((match = writeFileRegex.exec(responseContent)) !== null) {
            const filePath = match[1].trim();
            let contentToWrite = match[2];

            contentToWrite = contentToWrite.split('\n').filter(line => line.trim() !== '').join('\n');
            if (contentToWrite.length > 0 && !contentToWrite.endsWith('\n')) {
                contentToWrite += '\n';
            }
            writeFilesToExecute.set(filePath, contentToWrite);
        }

        // Execute read_file calls
        const readResults = await Promise.all(readFilePromises);
        toolResponse += readResults.join('');

        // Execute write_file calls
        const writePromises = [];
        for (const [filePath, contentToWrite] of writeFilesToExecute.entries()) {
            writePromises.push((async () => {
                const writeResult = await this.handleWriteFile(filePath, contentToWrite);
                if (writeResult) {
                    return `<write_file><target>${filePath}</target></write_file>\nFile written successfully: ${filePath}\n`;
                } else {
                    return `<write_file><target>${filePath}</target></write_file>\nError: Could not write to file: ${filePath}\n`;
                }
            })());
        }
        const writeResults = await Promise.all(writePromises);
        toolResponse += writeResults.join('');

        if (toolResponse) {
            this.toolCallCount++;
            if (this.toolCallCount > this.MAX_TOOL_CALLS) {
                this.ollamaChat.sendToolMessage(`System: Exceeded maximum consecutive tool calls (${this.MAX_TOOL_CALLS}). Stopping automatic continuation.`);
                this.resetToolCallCount();
                return false;
            }
            await this.ollamaChat.sendAutomaticMessage(toolResponse);
            return true; // Indicates a tool call was processed
        } else {
            this.resetToolCallCount(); // Reset if no tool calls were made
        }
        return false; // No tool calls found
    }

    async handleReadFile(filePath) {
        try {
            const rootDirectoryName = this.fileExplorer.currentDirectoryHandle ? this.fileExplorer.currentDirectoryHandle.name : '';
            let relativePath = filePath;
            if (rootDirectoryName && filePath.startsWith(rootDirectoryName + '/')) {
                relativePath = filePath.substring(rootDirectoryName.length + 1);
            } else if (rootDirectoryName && filePath === rootDirectoryName) {
                // If the path is just the root directory name, it's not a file to read in this context
                console.error(`Attempted to read the root directory itself: ${filePath}`);
                return null;
            }

            const fileHandle = await this.fileExplorer.getFileHandleByPath(relativePath);
            if (fileHandle) {
                const file = await fileHandle.getFile();
                return await file.text();
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }
        return null;
    }

    async handleWriteFile(filePath, content) {
        try {
            const rootDirectoryName = this.fileExplorer.currentDirectoryHandle ? this.fileExplorer.currentDirectoryHandle.name : '';
            let relativePath = filePath;
            if (rootDirectoryName && filePath.startsWith(rootDirectoryName + '/')) {
                relativePath = filePath.substring(rootDirectoryName.length + 1);
            } else if (rootDirectoryName && filePath === rootDirectoryName) {
                console.error(`Attempted to write to the root directory itself: ${filePath}`);
                return false;
            }

            const fileHandle = await this.fileExplorer.createOrGetFileHandleByPath(relativePath);
            if (fileHandle) {
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                // Trigger a refresh of the file explorer to show changes
                this.fileExplorer.refreshFileSystem();
                return true;
            }
        } catch (error) {
            console.error(`Error writing to file ${filePath}:`, error);
        }
        return false;
    }
}
