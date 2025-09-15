document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const body = document.body;
    const appVersionSpan = document.getElementById('app-version');

    // Display app version
    if (appVersionSpan && typeof CODER_VERSION !== 'undefined') {
        appVersionSpan.textContent = `v${CODER_VERSION}`;
    }

    // Theme toggle
    themeToggleButton.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        if (body.classList.contains('dark-theme')) {
            themeToggleButton.textContent = 'dark_mode';
            localStorage.setItem('theme', 'dark');
        } else {
            themeToggleButton.textContent = 'light_mode';
            localStorage.setItem('theme', 'light');
        }
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        themeToggleButton.textContent = 'dark_mode';
    } else {
        body.classList.remove('dark-theme');
        themeToggleButton.textContent = 'light_mode';
    }
});
