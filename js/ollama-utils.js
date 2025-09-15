// js/ollama-utils.js

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string} str The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * Toggles the visibility of a think section.
 * This function is made global so it can be called directly from onclick attributes in dynamically generated HTML.
 * @param {string} thinkId The data-think-id of the think section to toggle.
 */
function toggleThinkSection(thinkId) {
    const thinkSection = document.querySelector(`[data-think-id="${thinkId}"]`);
    if (thinkSection) {
        thinkSection.classList.toggle('collapsed');
    }
}

// Expose to window for global access if needed by other scripts or inline HTML
window.escapeHTML = escapeHTML;
window.toggleThinkSection = toggleThinkSection;
