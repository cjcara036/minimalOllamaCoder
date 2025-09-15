document.addEventListener('DOMContentLoaded', () => {
    const leftPane = document.getElementById('left-pane');
    const centerPane = document.getElementById('center-pane');
    const rightPane = document.getElementById('right-pane');
    const leftResizer = document.getElementById('left-resizer');
    const rightResizer = document.getElementById('right-resizer');
    const body = document.body;

    let activeResizer = null;

    // 1) Create constants to designate the LEFT, RIGHT, and CENTER pane.
    const PANE_TARGET = {
        LEFT: 'left-pane',
        CENTER: 'center-pane',
        RIGHT: 'right-pane'
    };

    /**
     * Retrieves the DOM element for a given pane target.
     * @param {string} paneTarget - The ID of the target pane (e.g., PANE_TARGET.LEFT).
     * @returns {HTMLElement|null} The pane's DOM element, or null if not found.
     */
    function getPaneElement(paneTarget) {
        return document.getElementById(paneTarget);
    }

    /**
     * 2) Functions to manipulate pane content.
     *
     * Replaces the entire content of a specified pane with new HTML.
     * @param {string} paneTarget - The ID of the target pane (e.g., PANE_TARGET.LEFT).
     * @param {string} htmlContent - The HTML string to put inside the pane.
     */
    function showInPane(paneTarget, htmlContent) {
        const pane = getPaneElement(paneTarget);
        if (pane) {
            pane.innerHTML = htmlContent;
        } else {
            console.error(`Pane with ID '${paneTarget}' not found.`);
        }
    }

    /**
     * Appends HTML content to a specified pane.
     * @param {string} paneTarget - The ID of the target pane (e.g., PANE_TARGET.LEFT).
     * @param {string} htmlContent - The HTML string to append to the pane.
     */
    function appendToPane(paneTarget, htmlContent) {
        const pane = getPaneElement(paneTarget);
        if (pane) {
            pane.innerHTML += htmlContent;
        } else {
            console.error(`Pane with ID '${paneTarget}' not found.`);
        }
    }

    /**
     * Clears all content from a specified pane.
     * @param {string} paneTarget - The ID of the target pane (e.g., PANE_TARGET.LEFT).
     */
    function clearPane(paneTarget) {
        const pane = getPaneElement(paneTarget);
        if (pane) {
            pane.innerHTML = '';
        } else {
            console.error(`Pane with ID '${paneTarget}' not found.`);
        }
    }

    // Expose functions globally for easy access (optional, depending on architecture)
    window.PANE_TARGET = PANE_TARGET;
    window.showInPane = showInPane;
    window.appendToPane = appendToPane;
    window.clearPane = clearPane;

    // Initialize pane widths
    const initialLeftWidth = 15; // 15% for left pane
    const initialCenterWidth = 15; // 15% for center pane
    const initialRightWidth = 100 - initialLeftWidth - initialCenterWidth; // Remaining for right pane

    leftPane.style.width = `${initialLeftWidth}%`;
    centerPane.style.width = `${initialCenterWidth}%`;
    rightPane.style.width = `${initialRightWidth}%`;

    const startResizing = (e, resizer) => {
        activeResizer = resizer;
        document.addEventListener('mousemove', resizePanes);
        document.addEventListener('mouseup', stopResizing);
        body.style.cursor = 'ew-resize'; // Change cursor globally
        body.style.userSelect = 'none'; // Prevent text selection during resize
    };

    const resizePanes = (e) => {
        if (!activeResizer) return;

        const containerWidth = leftPane.parentElement.offsetWidth;
        let newLeftWidth, newCenterWidth, newRightWidth;

        if (activeResizer === leftResizer) {
            newLeftWidth = (e.clientX / containerWidth) * 100;
            newLeftWidth = Math.max(10, Math.min(newLeftWidth, 80)); // Min/max width for left pane

            const currentCenterWidth = (centerPane.offsetWidth / containerWidth) * 100;
            const currentRightWidth = (rightPane.offsetWidth / containerWidth) * 100;
            const remainingWidth = 100 - newLeftWidth;

            // Distribute remaining width proportionally
            newCenterWidth = (currentCenterWidth / (currentCenterWidth + currentRightWidth)) * remainingWidth;
            newRightWidth = (currentRightWidth / (currentCenterWidth + currentRightWidth)) * remainingWidth;

            // Ensure minimum width for center and right panes
            if (newCenterWidth < 10) {
                newCenterWidth = 10;
                newRightWidth = remainingWidth - 10;
            }
            if (newRightWidth < 10) {
                newRightWidth = 10;
                newCenterWidth = remainingWidth - 10;
            }

        } else if (activeResizer === rightResizer) {
            newRightWidth = ((containerWidth - e.clientX) / containerWidth) * 100;
            newRightWidth = Math.max(10, Math.min(newRightWidth, 80)); // Min/max width for right pane

            const currentLeftWidth = (leftPane.offsetWidth / containerWidth) * 100;
            const currentCenterWidth = (centerPane.offsetWidth / containerWidth) * 100;
            const remainingWidth = 100 - newRightWidth;

            // Distribute remaining width proportionally
            newLeftWidth = (currentLeftWidth / (currentLeftWidth + currentCenterWidth)) * remainingWidth;
            newCenterWidth = (currentCenterWidth / (currentLeftWidth + currentCenterWidth)) * remainingWidth;

            // Ensure minimum width for left and center panes
            if (newLeftWidth < 10) {
                newLeftWidth = 10;
                newCenterWidth = remainingWidth - 10;
            }
            if (newCenterWidth < 10) {
                newCenterWidth = 10;
                newLeftWidth = remainingWidth - 10;
            }
        }

        // Apply new widths
        leftPane.style.width = `${newLeftWidth}%`;
        centerPane.style.width = `${newCenterWidth}%`;
        rightPane.style.width = `${newRightWidth}%`;
    };

    const stopResizing = () => {
        activeResizer = null;
        document.removeEventListener('mousemove', resizePanes);
        document.removeEventListener('mouseup', stopResizing);
        body.style.cursor = 'default';
        body.style.userSelect = 'auto';
        savePaneState(); // Save state after resizing stops
    };

    leftResizer.addEventListener('mousedown', (e) => startResizing(e, leftResizer));
    rightResizer.addEventListener('mousedown', (e) => startResizing(e, rightResizer));

    // 3) Save pane state to localStorage
    function savePaneState() {
        const paneStates = {
            left: leftPane.style.width,
            center: centerPane.style.width,
            right: rightPane.style.width
        };
        localStorage.setItem('paneStates', JSON.stringify(paneStates));
    }

    // 4) Load pane state from localStorage or apply initial widths
    function loadPaneState() {
        const savedStates = localStorage.getItem('paneStates');
        if (savedStates) {
            const paneStates = JSON.parse(savedStates);
            leftPane.style.width = paneStates.left;
            centerPane.style.width = paneStates.center;
            rightPane.style.width = paneStates.right;
        } else {
            // Apply initial widths if no saved state
            const initialLeftWidth = 15; // 15% for left pane
            const initialCenterWidth = 15; // 15% for center pane
            const initialRightWidth = 100 - initialLeftWidth - initialCenterWidth; // Remaining for right pane

            leftPane.style.width = `${initialLeftWidth}%`;
            centerPane.style.width = `${initialCenterWidth}%`;
            rightPane.style.width = `${initialRightWidth}%`;
        }
    }

    // Call loadPaneState when the DOM is loaded
    loadPaneState();
});
