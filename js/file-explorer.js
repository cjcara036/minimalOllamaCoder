// JavaScript for the file explorer in the left pane

class FileExplorer {
    // All fields are now public
    fileStructure = null;
    leftPane;
    fileExplorerContainer;
    selectDirectoryButton;
    currentDirectoryHandle = null; // Store the currently selected directory handle
    lastUsedDirectoryHandle = null; // Store the last used directory handle for directory picker
    refreshIntervalId = null; // To store the interval ID for refreshing
    expandedFolders = new Set(); // To store paths of currently expanded folders
    rightClickContext = [
        {
            optionName: "Add file to Chat Context",
            optionContent: "OllamaChat.addFileToContext(%FILECONTENT%, %FILENAME%, %FILELOC%)"
        }
    ];

    constructor(leftPaneElementId) {
        this.leftPane = document.getElementById(leftPaneElementId);
        if (!this.leftPane) {
            console.error(`Left pane element with ID '${leftPaneElementId}' not found.`);
            return;
        }
        this.initializeUI();
        this.addEventListeners();
        this.restoreLastBrowseDirectory();
        this.startAutoRefresh(); // Start auto-refresh when initialized
    }

    initializeUI() {
        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'file-explorer-button-wrapper';
        this.leftPane.prepend(buttonWrapper);

        this.selectDirectoryButton = document.createElement('button');
        this.selectDirectoryButton.id = 'select-directory-button';
        this.selectDirectoryButton.className = 'file-explorer-button';
        buttonWrapper.appendChild(this.selectDirectoryButton);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-symbols-outlined';
        iconSpan.textContent = 'folder_open'; // Folder icon
        this.selectDirectoryButton.appendChild(iconSpan);

        const textSpan = document.createElement('span');
        textSpan.className = 'file-explorer-button-text';
        textSpan.textContent = 'Select Folder';
        this.selectDirectoryButton.appendChild(textSpan);

        this.fileExplorerContainer = document.createElement('div');
        this.fileExplorerContainer.id = 'file-explorer-container';
        this.fileExplorerContainer.className = 'file-explorer-container';
        this.leftPane.appendChild(this.fileExplorerContainer);
    }

    addEventListeners() {
        this.selectDirectoryButton.addEventListener('click', async () => {
            try {
                if ('showDirectoryPicker' in window) {
                    // Prepare directory picker options
                    const pickerOptions = {};

                    // Add startIn option if we have a stored directory
                    if (this.lastUsedDirectoryHandle) {
                        try {
                            // Verify the handle is still accessible
                            const permission = await this.lastUsedDirectoryHandle.queryPermission({ mode: 'readwrite' });
                            if (permission === 'granted' || permission === 'prompt') {
                                pickerOptions.startIn = this.lastUsedDirectoryHandle;
                            }
                        } catch (error) {
                            console.log('Last browse directory no longer accessible, will use default');
                        }
                    }

                    const directoryHandle = await window.showDirectoryPicker(pickerOptions);
                    await this.verifyPermission(directoryHandle);
                    this.currentDirectoryHandle = directoryHandle; // Store the handle
                    this.lastUsedDirectoryHandle = directoryHandle; // Store as last used directory
                    await this.storeBrowseDirectoryHandle(directoryHandle); // Store for future use
                    await this.buildAndDisplayFileSystem(directoryHandle, this.fileExplorerContainer);
                    this.startAutoRefresh(); // Restart refresh with new directory

                    // Update the file structure in the chat, but only if it's not the first chat
                    // The initial file structure is sent as part of the system message on first chat.
                    if (window.ollamaSystemIntegration && !OllamaChat.isFirstChat()) {
                        window.ollamaSystemIntegration.updateFileStructureMessage();
                    }
                } else {
                    alert('File System Access API is not supported in this browser.');
                    console.error('File System Access API is not supported.');
                }
            } catch (error) {
                console.error('Error selecting directory:', error);
                if (error.name === 'AbortError') {
                    console.log('User cancelled directory selection.');
                } else {
                    alert('Failed to select directory. Please check console for details.');
                }
            }
        });

        // Close context menu if clicking anywhere else
        document.addEventListener('click', () => {
            const existingMenu = document.getElementById('file-explorer-context-menu');
            if (existingMenu) {
                existingMenu.remove();
            }
        });
    }

    // Method to restore the last used browse directory from stored data
    async restoreLastBrowseDirectory() {
        try {
            // Try to restore from IndexedDB if available
            if ('indexedDB' in window) {
                const storedHandle = await this.getStoredBrowseDirectoryHandle();
                if (storedHandle) {
                    // Verify the handle is still valid
                    const permission = await storedHandle.queryPermission({ mode: 'readwrite' });
                    if (permission === 'granted') {
                        this.lastUsedDirectoryHandle = storedHandle;
                    }
                }
            }
        } catch (error) {
            console.log('Could not restore last browse directory:', error);
        }
    }

    // Method to get stored browse directory handle from IndexedDB
    async getStoredBrowseDirectoryHandle() {
        return new Promise((resolve) => {
            const request = indexedDB.open('FilePicker', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('directories')) {
                    db.createObjectStore('directories');
                }
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['directories'], 'readonly');
                const store = transaction.objectStore('directories');
                const getRequest = store.get('lastUsedBrowseDirectory');
                
                getRequest.onsuccess = () => {
                    resolve(getRequest.result || null);
                };
                
                getRequest.onerror = () => {
                    resolve(null);
                };
            };
            
            request.onerror = () => {
                resolve(null);
            };
        });
    }

    // Method to store browse directory handle in IndexedDB
    async storeBrowseDirectoryHandle(directoryHandle) {
        try {
            const request = indexedDB.open('FilePicker', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('directories')) {
                    db.createObjectStore('directories');
                }
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['directories'], 'readwrite');
                const store = transaction.objectStore('directories');
                store.put(directoryHandle, 'lastUsedBrowseDirectory');
            };
        } catch (error) {
            console.log('Could not store browse directory handle:', error);
        }
    }

    async verifyPermission(handle) {
        const options = { mode: 'readwrite' };
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    startAutoRefresh() {
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId); // Clear any existing interval
        }
        if (this.currentDirectoryHandle) {
            this.refreshIntervalId = setInterval(async () => {
                console.log('Refreshing file explorer...');
                await this.buildAndDisplayFileSystem(this.currentDirectoryHandle, this.fileExplorerContainer);
            }, window.FOLDER_REFRESH_PERIOD); // Access as global variable
        }
    }

    async buildAndDisplayFileSystem(directoryHandle, containerElement) {
        // Capture current expanded state before clearing
        this.captureExpandedState(containerElement);

        containerElement.innerHTML = ''; // Clear previous content
        this.fileStructure = await this.readDirectoryRecursive(directoryHandle);
        const ul = document.createElement('ul');
        ul.className = 'file-explorer-list';
        await this.renderDirectory(this.fileStructure, ul, 0, directoryHandle, ''); // Pass root handle and initial path
        containerElement.appendChild(ul);

        // Apply captured expanded state after rendering
        this.applyExpandedState(containerElement);
    }

    async readDirectoryRecursive(directoryHandle) {
        const structure = {
            name: directoryHandle.name,
            kind: 'directory',
            handle: directoryHandle, // Store the handle for later use
            children: []
        };

        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'directory') {
                const childStructure = await this.readDirectoryRecursive(entry);
                structure.children.push(childStructure);
            } else {
                structure.children.push({
                    name: entry.name,
                    kind: 'file',
                    extension: entry.name.split('.').pop(),
                    handle: entry // Store the file handle
                });
            }
        }
        return structure;
    }

    captureExpandedState(containerElement) {
        this.expandedFolders.clear();
        containerElement.querySelectorAll('.file-explorer-item.directory.expanded').forEach(item => {
            const path = item.getAttribute('data-path');
            if (path) {
                this.expandedFolders.add(path);
            }
        });
    }

    applyExpandedState(containerElement) {
        this.expandedFolders.forEach(path => {
            const item = containerElement.querySelector(`.file-explorer-item.directory[data-path="${path}"]`);
            if (item) {
                const toggle = item.querySelector('.file-explorer-item-toggle');
                if (toggle && !item.classList.contains('expanded')) {
                    // Simulate a click to expand the folder and render its children
                    toggle.click();
                }
            }
        });
    }

    renderDirectory(node, parentUl, depth, parentHandle, currentPath) {
        const li = document.createElement('li');
        li.className = `file-explorer-item ${node.kind}`;
        const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
        li.setAttribute('data-path', nodePath); // Store full path for state management

        if (node.kind === 'file') {
            li.setAttribute('data-extension', node.extension);
        }
        li.setAttribute('data-name', node.name); // Store name for context menu

        const itemContent = document.createElement('div');
        itemContent.className = 'file-explorer-item-content';
        itemContent.style.paddingLeft = `${depth * 10 + 5}px`;
        li.appendChild(itemContent);

        if (node.kind === 'directory') {
            const toggle = document.createElement('span');
            toggle.className = 'file-explorer-item-toggle collapsed';
            itemContent.appendChild(toggle);

            let childrenContainer = li.querySelector('.file-explorer-children');
            if (!childrenContainer) {
                childrenContainer = document.createElement('ul');
                childrenContainer.className = 'file-explorer-children';
                li.appendChild(childrenContainer);
            }

            childrenContainer.style.display = 'none';

            toggle.addEventListener('click', async (event) => {
                event.stopPropagation();
                li.classList.toggle('expanded');
                toggle.classList.toggle('collapsed');
                toggle.classList.toggle('expanded');

                // Only render children if they haven't been rendered yet (lazy loading for newly expanded folders)
                if (!childrenContainer.hasChildNodes() && node.children && node.children.length > 0) {
                    node.children.forEach(child => this.renderDirectory(child, childrenContainer, depth + 1, node.handle, nodePath));
                }
                childrenContainer.style.display = li.classList.contains('expanded') ? 'block' : 'none';
            });
        } else {
            const emptyToggleSpace = document.createElement('span');
            emptyToggleSpace.className = 'file-explorer-item-toggle';
            itemContent.appendChild(emptyToggleSpace);
        }

        const fileIcon = document.createElement('span');
        fileIcon.className = 'file-icon material-symbols-outlined';
        itemContent.appendChild(fileIcon);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = node.name;
        itemContent.appendChild(nameSpan);
        parentUl.appendChild(li);

        // Add right-click listener only for files
        if (node.kind === 'file') {
            itemContent.addEventListener('contextmenu', (event) => {
                event.preventDefault(); // Prevent default browser context menu
                this.showContextMenu(event.clientX, event.clientY, node.handle, parentHandle); // Pass file handle and parent directory handle
            });
        }
    }

    async getFileContent(fileHandle) {
        try {
            const file = await fileHandle.getFile();
            return await file.text();
        } catch (error) {
            console.error('Error reading file content:', error);
            return null;
        }
    }

    async getFilePath(fileHandle, rootHandle) {
        try {
            // This is a simplified way to get a path relative to the rootHandle.
            // A more robust solution might involve storing paths during recursive read.
            let path = fileHandle.name;
            let currentHandle = fileHandle;
            while (currentHandle.parent && currentHandle.parent.name !== rootHandle.name) {
                currentHandle = await currentHandle.parent;
                path = `${currentHandle.name}/${path}`;
            }
            return path;
        } catch (error) {
            console.error('Error getting file path:', error);
            return fileHandle.name; // Fallback to just file name
        }
    }

    showContextMenu(x, y, fileHandle, parentDirectoryHandle) {
        // Remove any existing context menu
        const existingMenu = document.getElementById('file-explorer-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('ul');
        menu.id = 'file-explorer-context-menu';
        menu.className = 'file-explorer-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        this.rightClickContext.forEach(option => {
            const listItem = event.target.closest('.file-explorer-item');
            const fullPath = listItem ? listItem.getAttribute('data-path') : fileHandle.name; // Get full path from data-path
            this.addContextMenuItem(menu, option, fileHandle, parentDirectoryHandle, fullPath);
        });

        document.body.appendChild(menu);
    }

    addContextMenuItem(parentMenu, option, fileHandle, parentDirectoryHandle, fullPath) {
        const menuItem = document.createElement('li');
        menuItem.className = 'file-explorer-context-menu-item';
        menuItem.textContent = option.optionName;

        if (typeof option.optionContent === 'string') {
            menuItem.addEventListener('click', async (event) => {
                event.stopPropagation(); // Prevent closing menu immediately

                let processedContent = option.optionContent;
                if (processedContent.includes('%FILECONTENT%')) {
                    const fileContent = await this.getFileContent(fileHandle);
                    processedContent = processedContent.replace('%FILECONTENT%', JSON.stringify(fileContent));
                }
                if (processedContent.includes('%FILENAME%')) {
                    processedContent = processedContent.replace('%FILENAME%', JSON.stringify(fileHandle.name));
                }
                if (processedContent.includes('%FILELOC%')) {
                    processedContent = processedContent.replace('%FILELOC%', JSON.stringify(fullPath));
                }

                try {
                    // Execute the function string
                    // WARNING: Using eval can be dangerous. Ensure input is controlled.
                    eval(processedContent);
                } catch (e) {
                    console.error("Error executing context menu function:", e);
                }

                document.getElementById('file-explorer-context-menu').remove(); // Close menu after click
            });
        } else if (Array.isArray(option.optionContent)) {
            menuItem.classList.add('has-submenu');
            const submenu = document.createElement('ul');
            submenu.className = 'file-explorer-submenu';
            option.optionContent.forEach(subOption => {
                this.addContextMenuItem(submenu, subOption, fileHandle, parentDirectoryHandle, fullPath);
            });
            menuItem.appendChild(submenu);

            menuItem.addEventListener('mouseenter', () => {
                submenu.style.display = 'block';
            });
            menuItem.addEventListener('mouseleave', () => {
                submenu.style.display = 'none';
            });
        }
        parentMenu.appendChild(menuItem);
    }

    getFileStructure() {
        return this.fileStructure;
    }

    // New method to get a file handle by its path
    async getFileHandleByPath(filePath) {
        if (!this.currentDirectoryHandle) {
            console.error('No directory selected in File Explorer.');
            return null;
        }
        const pathParts = filePath.split('/');
        let currentHandle = this.currentDirectoryHandle;

        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            try {
                if (i === pathParts.length - 1) { // Last part, it's the file
                    return await currentHandle.getFileHandle(part);
                } else { // Directory
                    currentHandle = await currentHandle.getDirectoryHandle(part);
                }
            } catch (error) {
                console.error(`Path part not found: ${part} in ${filePath}`, error);
                return null;
            }
        }
        return null;
    }

    // New method to create or get a file handle by its path
    async createOrGetFileHandleByPath(filePath) {
        if (!this.currentDirectoryHandle) {
            console.error('No directory selected in File Explorer.');
            return null;
        }
        const pathParts = filePath.split('/');
        let currentHandle = this.currentDirectoryHandle;

        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            try {
                if (i === pathParts.length - 1) { // Last part, it's the file
                    return await currentHandle.getFileHandle(part, { create: true });
                } else { // Directory
                    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
                }
            } catch (error) {
                console.error(`Error creating or getting directory/file handle for ${part} in ${filePath}:`, error);
                return null;
            }
        }
        return null;
    }

    // New method to trigger a refresh of the file system display
    async refreshFileSystem() {
        if (this.currentDirectoryHandle) {
            await this.buildAndDisplayFileSystem(this.currentDirectoryHandle, this.fileExplorerContainer);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components in the correct order
    window.ollamaChatInstance = new OllamaChat('center-pane');
    window.fileExplorerInstance = new FileExplorer('left-pane');
    window.ollamaSystemIntegration = new OllamaSystemIntegration(window.ollamaChatInstance, window.fileExplorerInstance);
    
    // Set the system integration instance on the chat instance
    window.ollamaChatInstance.setSystemIntegration(window.ollamaSystemIntegration);
});
