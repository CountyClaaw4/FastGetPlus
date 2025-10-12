document.addEventListener('DOMContentLoaded', () => {
    const defaultServerInput = document.getElementById('default-server');
    const overwriteCheckbox = document.getElementById('overwrite-plugins');
    const saveButton = document.getElementById('save-options');
    const saveStatus = document.getElementById('save-status');
    const body = document.body;

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const setTheme = (isDark) => { body.dataset.theme = isDark ? 'dark' : 'light'; };
    setTheme(darkModeMediaQuery.matches);
    darkModeMediaQuery.addEventListener('change', e => setTheme(e.matches));

    chrome.storage.local.get(['defaultServer', 'overwritePlugins'], (data) => {
        defaultServerInput.value = data.defaultServer || '';
        overwriteCheckbox.checked = data.overwritePlugins !== false;
    });

    const showStatus = (message, type = 'info') => {
        saveStatus.textContent = message;
        saveStatus.className = '';
        saveStatus.classList.add(type, 'fade-in');

        if (type === 'error') {
            defaultServerInput.classList.add('error');
            setTimeout(() => defaultServerInput.classList.remove('error'), 500);
        }

        setTimeout(() => {
            saveStatus.classList.remove('fade-in');
            saveStatus.classList.add('fade-out');
            saveStatus.addEventListener('animationend', () => {
                saveStatus.textContent = '';
                saveStatus.className = '';
            }, { once: true });
        }, 2500);
    };

    saveButton.addEventListener('click', () => {
        const defaultServer = defaultServerInput.value.trim();

        if (!defaultServer) {
            showStatus('サーバーIDを入力してください', 'error');
            return;
        }

        chrome.storage.local.set({
            defaultServer,
            overwritePlugins: overwriteCheckbox.checked
        }, () => {
            showStatus('保存しました', 'success');
        });
    });
});
