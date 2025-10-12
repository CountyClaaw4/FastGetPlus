document.addEventListener('DOMContentLoaded', () => {
    const apiUrlInput = document.getElementById('api-url');
    const apiKeyInput = document.getElementById('api-key');
    const testButton = document.getElementById('test-connection');
    const statusMessage = document.getElementById('status-message');
    const body = document.body;

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const setTheme = (isDark) => { body.dataset.theme = isDark ? 'dark' : 'light'; };
    setTheme(darkModeMediaQuery.matches);
    darkModeMediaQuery.addEventListener('change', e => setTheme(e.matches));

    chrome.storage.local.get(['apiUrl', 'apiKey'], (data) => {
        apiUrlInput.value = data.apiUrl || 'http://localhost:4001';
        apiKeyInput.value = data.apiKey || '';
    });

    function saveSettings() {
        chrome.storage.local.set({
            apiUrl: apiUrlInput.value,
            apiKey: apiKeyInput.value
        });
    }

    apiUrlInput.addEventListener('change', saveSettings);
    apiKeyInput.addEventListener('change', saveSettings);

    const showStatus = (message, type = 'info') => {
        statusMessage.textContent = message;
        statusMessage.className = '';
        statusMessage.classList.add(type, 'fade-in');

        if(type === 'error') {
            [apiUrlInput, apiKeyInput].forEach(input => {
                input.classList.add('error');
                setTimeout(() => input.classList.remove('error'), 500);
            });
        }

        setTimeout(() => {
            statusMessage.classList.remove('fade-in');
            statusMessage.classList.add('fade-out');
            statusMessage.addEventListener('animationend', () => {
                statusMessage.textContent = '';
                statusMessage.className = '';
            }, { once: true });
        }, 3000);
    };

    testButton.addEventListener('click', async () => {
        const apiUrl = apiUrlInput.value;
        const apiKey = apiKeyInput.value;

        showStatus('接続中...', 'info');

        try {
            const headers = apiKey ? { 'x-fs-key': apiKey } : {};
            const response = await fetch(`${apiUrl}/api/check_alive`, { headers });
            const data = await response.json();

            if (response.status === 200 && data.status === 'ok') {
                showStatus('接続成功', 'success');
            } else if (response.status === 401 || response.status === 403) {
                showStatus('API URL または APIキーが正しくありません', 'error');
            } else {
                showStatus(`予期せぬエラー: ${data.error || JSON.stringify(data)}`, 'error');
            }
        } catch (err) {
            showStatus('ネットワークエラーが発生しました', 'error');
        }
    });
});
