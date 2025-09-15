class RightPane {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }
        this.canvasContainer = null;
        this.lineNumbersElement = null;
        this.editableCanvas = null;
        this.navBar = null;
        this.lastUsedDirectoryHandle = null; // Store the last used directory handle

        this._initializeRightPane();
        this._setupEventListeners();
        this._restoreLastDirectory();
    }

    _initializeRightPane() {
        this.container.innerHTML = `
            <div class="right-pane-filename"></div>
            <div class="right-pane-canvas-container">
                <div class="line-numbers"></div>
                <textarea class="editable-canvas" spellcheck="false"></textarea>
            </div>
        `;

        this.fileNameElement = this.container.querySelector('.right-pane-filename');
        this.canvasContainer = this.container.querySelector('.right-pane-canvas-container');
        this.lineNumbersElement = this.container.querySelector('.line-numbers');
        this.editableCanvas = this.container.querySelector('.editable-canvas');

        this._updateLineNumbers();
        this._initializeNavBar();
    }

    _setupEventListeners() {
        this.editableCanvas.addEventListener('input', () => {
            this._updateLineNumbers();
            this._adjustScroll();
        });
        this.editableCanvas.addEventListener('scroll', () => {
            this._adjustScroll();
        });
    }

    _updateLineNumbers() {
        const lines = this.editableCanvas.value.split('\n');
        this.lineNumbersElement.innerHTML = '';
        for (let i = 0; i < lines.length; i++) {
            const lineNumberDiv = document.createElement('div');
            lineNumberDiv.textContent = i + 1;
            this.lineNumbersElement.appendChild(lineNumberDiv);
        }
    }

    _adjustScroll() {
        this.lineNumbersElement.scrollTop = this.editableCanvas.scrollTop;
    }

    _initializeNavBar() {
        const navBarOptions = [
            { optionName: "Save to File", optionIcon: "fas fa-save", optionFunction: this._saveToFile.bind(this) }
           // { optionName: "Option 2", optionIcon: "fas fa-cogs", optionFunction: this._option2Function.bind(this) },
           // { optionName: "Option 3", optionIcon: "fas fa-info-circle", optionFunction: this._option3Function.bind(this) }
        ];
        this.navBar = new NavBar(this.canvasContainer, navBarOptions);
    }

    // Public function to put content into the canvas (replaces current content)
    putToCanvas(content) {
        this.editableCanvas.value = content;
        this._updateLineNumbers();
        this._adjustScroll();
    }

    // Public function to append content to the canvas
    appendToCanvas(content) {
        this.editableCanvas.value += content;
        this._updateLineNumbers();
        this._adjustScroll();
        this.editableCanvas.scrollTop = this.editableCanvas.scrollHeight; // Scroll to bottom
    }

    // Method to restore the last used directory from stored data
    async _restoreLastDirectory() {
        try {
            // Try to restore from IndexedDB if available
            if ('indexedDB' in window) {
                const storedHandle = await this._getStoredDirectoryHandle();
                if (storedHandle) {
                    // Verify the handle is still valid
                    const permission = await storedHandle.queryPermission({ mode: 'readwrite' });
                    if (permission === 'granted') {
                        this.lastUsedDirectoryHandle = storedHandle;
                    }
                }
            }
        } catch (error) {
            console.log('Could not restore last directory:', error);
        }
    }

    // Method to get stored directory handle from IndexedDB
    async _getStoredDirectoryHandle() {
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
                const getRequest = store.get('lastUsedDirectory');
                
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

    // Method to store directory handle in IndexedDB
    async _storeDirectoryHandle(directoryHandle) {
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
                store.put(directoryHandle, 'lastUsedDirectory');
            };
        } catch (error) {
            console.log('Could not store directory handle:', error);
        }
    }

    // Placeholder functions for navigation bar options
    async _saveToFile() {
        try {
            const content = this.editableCanvas.value;
            const suggestedName = this.fileNameElement.textContent || 'untitled.txt';

            // Prepare save picker options
            const saveOptions = {
                suggestedName: suggestedName,
                types: [{
                    description: 'Text Files',
                    accept: {
                        'text/plain': ['.txt', '.js', '.html', '.css', '.json', '.md'],
                    },
                }],
            };

            // Add startIn option if we have a stored directory
            if (this.lastUsedDirectoryHandle) {
                try {
                    // Verify the handle is still accessible
                    const permission = await this.lastUsedDirectoryHandle.queryPermission({ mode: 'readwrite' });
                    if (permission === 'granted' || permission === 'prompt') {
                        saveOptions.startIn = this.lastUsedDirectoryHandle;
                    }
                } catch (error) {
                    console.log('Last directory no longer accessible, will use default');
                }
            }

            const fileHandle = await window.showSaveFilePicker(saveOptions);

            const writableStream = await fileHandle.createWritable();
            await writableStream.write(content);
            await writableStream.close();

            // Store the directory of the saved file for next time
            try {
                const parentDirectory = await fileHandle.getParent();
                this.lastUsedDirectoryHandle = parentDirectory;
                await this._storeDirectoryHandle(parentDirectory);
            } catch (error) {
                console.log('Could not store parent directory:', error);
            }

            console.log('File saved successfully!');
            alert('File saved successfully!');
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Save operation aborted by the user.');
            } else {
                console.error('Error saving file:', error);
                alert('Error saving file: ' + error.message);
            }
        }
    }

    // Public function to clear the content of the canvas
    clearCanvas() {
        this.editableCanvas.value = '';
        this.setFileName('');
        this._updateLineNumbers();
        this._adjustScroll();
    }

    // Public function to set the file name display
    setFileName(fileName) {
        this.fileNameElement.textContent = fileName;
    }
}

class NavBar {
    #options = []; // Private array for navigation options

    constructor(parentContainer, options) {
        this.parentContainer = parentContainer;
        this.#options = options;
        this.navBarElement = null;
        this._renderNavBar();
    }

    _renderNavBar() {
        this.navBarElement = document.createElement('div');
        this.navBarElement.className = 'nav-bar-container';

        this.#options.forEach(option => {
            const button = document.createElement('div');
            button.className = 'nav-bar-button';
            button.innerHTML = `<i class="${option.optionIcon}"></i><span class="tooltip">${option.optionName}</span>`;
            button.addEventListener('click', option.optionFunction);
            this.navBarElement.appendChild(button);
        });

        this.parentContainer.appendChild(this.navBarElement);
    }
}

// Assuming a global dark/light mode toggle mechanism exists,
// the CSS variables will automatically handle the styling.
// No direct JS intervention needed here for mode switching,
// as it's handled by CSS variables.
window.rightPane = new RightPane('right-pane');
