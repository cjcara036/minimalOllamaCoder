/**
 * System Configuration Variables
 *
 * This file stores global configuration settings for the Ollama Minimal Coder web application.
 * Variables defined here are intended to be easily accessible throughout the application's JavaScript files.
 */

const CODER_VERSION = "0.01"; // The current version number of the Ollama Minimal Coder application.
const CODE_TO_CANVAS = true; // Set to true to enable "```" operation, false to disable

// Expose FOLDER_REFRESH_PERIOD globally to avoid import/export for simple configurations
window.FOLDER_REFRESH_PERIOD = 5000; // Period in milliseconds to refresh the folder structure in the file explorer.
window.MAX_AUTOMATED_REQUESTS = 50; // Limit to prevent infinite loops of automated tool calls.
window.MAX_REPONSE_TIME = 3600; // The maximum time in seconds for an Ollama response before triggering context compression.
