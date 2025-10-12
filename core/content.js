/*超適当なコード*/

console.log('[FSS] content.js loaded');

const SPIGET_API_BASE = 'https://api.spiget.org/v2';

const FALLBACK_ICON_PATH = 'images/defaulticon.png';

const st = {
    base: '',
    key: '',
    server_id: null,
    folder: 'plugins', 
    resolved: null, 
    use_xfs: false, 

    headers: (useXFS) => {
        const h = { 'Content-Type': 'application/json' };
        if (st.key) {
            if (useXFS) h['x-fs-key'] = st.key;
            else h['Authorization'] = `Bearer ${st.key}`;
        }
        return h;
    }
};

let serverModalElement = null; 

function ensure_extension(name, ext) {
    if (!name) {

        return `download${ext}`; 
    }

    const baseName = name.replace(/\.$/, '');

    if (baseName.toLowerCase().endsWith(ext.toLowerCase())) {
        return baseName;
    }

    return baseName + ext;
}

function safe_name(rawName) {

    if (!rawName) return 'download.jar';
    return rawName.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/\/|\\/g, '_');
}

function getResourceId() {

    const match = window.location.href.match(/resources\/[^\/]+\.(\d+)/);
    return match ? match[1] : null;
}

async function fetchSpigetResource(resourceId) {
    const url = `${SPIGET_API_BASE}/resources/${resourceId}`;
    try {
        const r = await fetch(url);
        if (r.ok) {
            return await r.json();
        }
        console.error(`[FSS] Spiget Resource API error: HTTP ${r.status}`);
        return null;
    } catch (e) {
        console.error(`[FSS] Spiget resource fetch failed: ${e.message}`);
        return null;
    }
}

async function fetchSpigetVersions(resourceId) {
    const url = `${SPIGET_API_BASE}/resources/${resourceId}/versions?size=2000&sort=-releaseDate`;
    try {
        const r = await fetch(url);
        if (r.ok) {
            return await r.json();
        }
        console.error(`[FSS] Spiget API error: HTTP ${r.status}`);
        return null;
    } catch (e) {
        console.error(`[FSS] Spiget fetch failed: ${e.message}`);
        return null;
    }
}

function buildSpigetDownloadUrl(resourceId, versionId, useProxy = false) {
    const baseUrl = `${SPIGET_API_BASE}/resources/${resourceId}`;
    let url = baseUrl;

    if (versionId) {

        url += `/versions/${versionId}/download`;
    } else {

        url += `/download`;
    }

    if (useProxy) {
        url += '/proxy';
    }
    return url;
}

const iconCache = new Map();

const pendingRequests = new Map();

async function lazy_icon(id, img_el) {

    const fallbackUrl = chrome.runtime.getURL('images/defaulticon.png');

    if (iconCache.has(id)) {
        const cachedUrl = iconCache.get(id);
        img_el.src = cachedUrl;
        img_el.dataset.loaded = 'true';
        return Promise.resolve();
    }

    if (pendingRequests.has(id)) {
        try {
            const cachedUrl = await pendingRequests.get(id);
            img_el.src = cachedUrl;
            img_el.dataset.loaded = 'true';
        } catch (e) {
            img_el.src = fallbackUrl;
        }
        return;
    }

    const requestPromise = (async () => {
        const ctrl = new AbortController();

        const timeoutId = setTimeout(() => {
            ctrl.abort();
        }, 1500);

        try {

            const url = `${st.base}/api/servers/${encodeURIComponent(id)}/files/download?path=${encodeURIComponent('server-icon.png')}`;

            const r = await fetch(url, {
                headers: st.headers(st.use_xfs),
                signal: ctrl.signal
            });

            if (r.ok) {
                const blob = await r.blob();
                const blobUrl = URL.createObjectURL(blob);

                iconCache.set(id, blobUrl);

                img_el.src = blobUrl;
                img_el.dataset.loaded = 'true';

                return blobUrl;
            } else {

                iconCache.set(id, fallbackUrl); 
                img_el.src = fallbackUrl;
                throw new Error('HTTP error');
            }
        } catch (e) {

            if (!img_el.dataset.loaded) {
                iconCache.set(id, fallbackUrl); 
                img_el.src = fallbackUrl;
            }
            throw e;
        } finally {
            clearTimeout(timeoutId);

            pendingRequests.delete(id);
        }
    })();

    pendingRequests.set(id, requestPromise);

    try {
        await requestPromise;
    } catch (e) {

    }
}

function clearIconCache(id = null) {
    if (id === null) {

        iconCache.forEach(url => {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
        iconCache.clear();
        console.log('[FSS] Icon cache cleared');
    } else if (iconCache.has(id)) {

        const url = iconCache.get(id);
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
        iconCache.delete(id);
        console.log(`[FSS] Icon cache cleared for server: ${id}`);
    }
}

async function api_post(p, body) {

    let r = await fetch(st.base + p, { method: 'POST', headers: st.headers(false), body: JSON.stringify(body || {}) });

    if (r.status === 401) {
        st.use_xfs = true; 
        r = await fetch(st.base + p, { method: 'POST', headers: st.headers(true), body: JSON.stringify(body || {}) });
    }

    const t = await r.text();
    let d;
    try { d = JSON.parse(t); } catch (e) { d = { raw: t }; }
    return { ok: r.ok, status: r.status, data: d };
}

async function api_get(p) {

    let r = await fetch(st.base + p, { headers: st.headers(false) });

    if (r.status === 401) {
        st.use_xfs = true;
        r = await fetch(st.base + p, { headers: st.headers(true) });
    }

    const t = await r.text();
    let d;
    try { d = JSON.parse(t); } catch (e) { d = { raw: t }; }
    return { ok: r.ok, status: r.status, data: d };
}

window.testFastServerConnection = async function() {
    console.log('[FSS Test] FastServer接続テスト開始...');
    if (!st.base) {
        console.error('[FSS Test] Fastserver URLが設定されていません。');
        return;
    }

    console.warn('[FSS Test] Fastserverに接続テスト中...');

    try {

        const resp = await api_get(`/api/servers`);

        if (resp.ok) {
            const serverCount = resp.data.servers ? resp.data.servers.length : 0;
            console.log(`[FSS Test] ✅ 接続成功! ${serverCount}個のサーバーを確認。`);
            console.log(`[FSS Test] Success. Status: ${resp.status}, Servers Found: ${serverCount}`);
        } else {

            let errorMsg = (resp.data && (resp.data.error || resp.data.message)) || `HTTP ${resp.status}`;
            if (resp.status === 401) {
                errorMsg = '認証失敗 (APIキーを確認してください)';
            } else if (resp.status === 404) {
                 errorMsg = 'APIエンドポイントが見つかりません (URLを確認してください)';
            }
            console.error(`[FSS Test] ❌ 接続失敗: ${errorMsg}`);
        }
    } catch (e) {

        console.error(`[FSS Test] 致命的な接続エラー: ${e.message}`);
    }
}

function runXpAnimation(targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const orbCount = 10;

    for (let i = 0; i < orbCount; i++) {
        const orb = document.createElement('div');
        orb.className = 'xp-orb';

        orb.style.left = `${startX}px`;
        orb.style.top = `${startY}px`;

        const dx = (Math.random() - 0.5) * 150; 
        const dy = (Math.random() - 0.5) * 150 - 50; 

        orb.style.setProperty('--dx', `${dx}px`);
        orb.style.setProperty('--dy', `${dy}px`);

        orb.style.opacity = 1;

        document.body.appendChild(orb);

        orb.style.animation = `xpFlight 1s ease-out forwards`;
        orb.style.animationDelay = `${Math.random() * 0.1}s`;

        setTimeout(() => orb.remove(), 1100);
    }
}

function injectStyles() {
    const style = document.createElement('style');
    style.id = 'fss-styles';
    style.textContent = `

        .xp-orb {
            position: fixed;
            left: 0;
            top: 0;
            width: 10px;
            height: 10px;
            background: radial-gradient(#9734e2, #7700a3);
            border-radius: 50%;
            pointer-events: none;
            opacity: 0;
            z-index: 999999;
            transform: translate(-50%, -50%);
        }

        @keyframes xpFlight {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }

        @keyframes modalOpen {
            from {
                opacity: 0;
                transform: translate(-50%, -40%) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }

        @keyframes rowSlideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

injectStyles();

function toast(msg, type='info', duration=2000){
    if (type === 'err') {
        console.error(`[FSS Error] ${msg}`);
    } else if (type === 'warn') {
        console.warn(`[FSS Warning] ${msg}`);
    } else {
        console.log(`[FSS Info] ${msg}`);
    }
}

function showLoadingScreen(message) {

    document.querySelectorAll('.fss-popup, .fss-modal-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'fss-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 9998;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        font-size: 1.2rem;
        flex-direction: column;
        gap: 20px;
    `;

    const spinner = document.createElement('div');
    spinner.className = 'fss-spinner';
    spinner.style.cssText = `
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top: 4px solid #fff;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
    `;
    overlay.appendChild(spinner);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.margin = '0';
    overlay.appendChild(messageEl);

    if (!document.querySelector('#fss-spin-style')) {
        const style = document.createElement('style');
        style.id = 'fss-spin-style';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);

    return {
        container: overlay,
        overlay: overlay,
        updateMessage: (msg) => { messageEl.textContent = msg; }
    };
}

async function showServerSelection(servers) {

    document.querySelectorAll('.fss-popup, .fss-modal-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'fss-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 9998;
        transition: opacity 0.2s ease-out;
    `;
    document.body.appendChild(overlay);

    const container = document.createElement('div');
    container.className = 'fss-popup';

    container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%); 
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        background: #f7f7f7;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        padding: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: modalOpen 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    `;

    const title = document.createElement('h2');
    title.textContent = 'FSSに転送するサーバーを選択';
    title.style.cssText = 'font-size: 1.5rem; margin: 0 0 12px 0; color: #333; font-weight: 700; border-bottom: 1px solid #eee; padding-bottom: 8px;';
    container.appendChild(title);

    const searchInput = document.createElement('input');
    searchInput.placeholder = 'サーバー名で検索...';
    searchInput.style.cssText = 'padding:10px 12px; border-radius:8px; border:1px solid #ddd; font-size:14px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); outline: none; transition: border-color 0.2s;';
    searchInput.addEventListener('focus', () => searchInput.style.borderColor = '#3a6581');
    searchInput.addEventListener('blur', () => searchInput.style.borderColor = '#ddd');
    container.appendChild(searchInput);

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding-top: 5px;';
    container.appendChild(list);

    const iconObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const imgEl = entry.target.querySelector('img[data-server-id]');
                const serverId = imgEl?.dataset.serverId;

                if (serverId && !imgEl.dataset.loaded) {

                    lazy_icon(serverId, imgEl).catch(err => {
                        console.warn(`[FSS] Failed to load icon for server ${serverId}:`, err);
                    });
                }
                iconObserver.unobserve(entry.target);
            }
        });
    }, {
        root: container,
        rootMargin: '50px', 
        threshold: 0
    });

    function renderList(filter='') {

        list.querySelectorAll('div[data-fss-row]').forEach(row => iconObserver.unobserve(row));
        list.innerHTML = '';

        const filtered = servers.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));

        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.textContent = '表示するサーバーが見つかりません。';
            empty.style.cssText = 'text-align: center; color: #777; padding: 20px;';
            list.appendChild(empty);
            return;
        }

        const fragment = document.createDocumentFragment();

        for (let i = 0; i < filtered.length; i++) {
            const s = filtered[i];
            const row = document.createElement('div');
            row.setAttribute('data-fss-row', 'true');

            row.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                border-radius: 10px;
                background: #fff;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                transition: all 0.2s ease-in-out;
                opacity: 0;
                transform: translateY(10px);
                animation: rowSlideIn 0.3s ease-out forwards;
                animation-delay: ${i * 0.05}s;
            `;

            const hoverIn = () => {
                row.style.boxShadow = '0 5px 15px rgba(0,0,0,0.15)';
                row.style.transform = 'translateY(-2px)';
                row.style.cursor = 'pointer';
            };
            const hoverOut = () => {
                row.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                row.style.transform = 'translateY(0)';
            };

            row.addEventListener('mouseenter', hoverIn);
            row.addEventListener('mouseleave', hoverOut);

            const img = document.createElement('img');

            img.src = chrome.runtime.getURL('images/defaulticon.png');
            img.style.cssText = 'width:40px;height:40px;border-radius:8px;object-fit:cover; border: 1px solid #ddd;';
            img.setAttribute('data-server-id', s.id);

            row.appendChild(img);

            const info = document.createElement('div');
            info.style.flex = '1';
            const statusColor = s.status === 'RUNNING' ? '#28a745' : '#dc3545';
            const statusText = s.status === 'RUNNING' ? '起動中' : '停止中';
            info.innerHTML = `
                <strong style="color:#333; font-size:16px;">${s.name}</strong><br>
                <span style="font-size:12px; color:#555;">${s.software || ''} ${s.version || ''} - </span>
                <span style="font-size:12px; font-weight:600; color:${statusColor}">${statusText}</span>
            `;
            row.appendChild(info);

            const btn = document.createElement('button');
            btn.textContent = '🚀 転送';
            btn.style.cssText = `
                padding: 8px 16px;
                font-weight: bold;
                border-radius: 8px;
                background-color: #3a6581;
                color: white;
                border: none;
                cursor: pointer;
                transition: background-color 0.2s, transform 0.1s;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;

            const btnHoverIn = () => btn.style.backgroundColor = '#2c4f6a';
            const btnHoverOut = () => btn.style.backgroundColor = '#3a6581';
            btn.addEventListener('mouseenter', btnHoverIn);
            btn.addEventListener('mouseleave', btnHoverOut);

            btn.dataset.serverId = s.id;
            btn.addEventListener('click', handleTransferClick);

            row.appendChild(btn);

            row.dataset.serverId = s.id;
            row.addEventListener('click', handleRowClick);

            fragment.appendChild(row);
        }

        list.appendChild(fragment);

        list.querySelectorAll('div[data-fss-row]').forEach(row => iconObserver.observe(row));
    }

    function handleTransferClick(e) {
        e.stopPropagation();
        const serverId = e.target.dataset.serverId;
        closeModal();
        transferToFSS(serverId);
    }

    function handleRowClick(e) {
        const btn = e.currentTarget.querySelector('button');
        if (e.target !== btn) {
            btn.click();
        }
    }

    function closeModal() {
        iconObserver.disconnect();
        if (container.parentNode) container.remove();
        if (overlay.parentNode) overlay.remove();
    }

    let searchTimeout;
    searchInput.addEventListener('input', e => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => renderList(e.target.value), 150);
    });

    renderList();

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✖';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        font-size: 20px;
        color: #888;
        cursor: pointer;
        transition: color 0.2s;
    `;
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#333');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#888');
    closeBtn.addEventListener('click', closeModal);

    container.appendChild(closeBtn);
    document.body.appendChild(container);
}

async function transferToFSS(serverId) {

    if (!st.resolved || !st.resolved.resourceId || !st.resolved.versionId || !st.resolved.resourceName) {
        toast('転送に必要なリソース情報が不足しています', 'err');
        return;
    }

    const { resourceId, versionId, resourceName } = st.resolved;

    const downloadUrl = buildSpigetDownloadUrl(resourceId, versionId, true);

    const rawName = resourceName;

    const mainButton = document.querySelector('button[data-fss-main-button="true"]');
    const downloadLink = document.querySelector('a.inner[href*="/download"]');

    let targetExtension = '.jar'; 
    if (downloadLink) {

        const downloadLabel = downloadLink.closest('label.downloadButton');
        if (downloadLabel) {
            targetExtension = getAppropriateExtension(downloadLabel.textContent);
        }
    }

    const final_name = ensure_extension(safe_name(rawName), targetExtension);
    const path = `${st.folder}/${final_name}`;
    if (mainButton) {
        mainButton.disabled = true;

        const initialText = mainButton.dataset.fssInitialText || '🚀 FSSに転送';
        mainButton.dataset.fssInitialText = initialText; 

        mainButton.dataset.fssProcessingText = '🌐 転送中...'; 
        mainButton.dataset.fssProcessingColor = '#17a2b8'; 

        mainButton.textContent = mainButton.dataset.fssProcessingText;
        mainButton.style.backgroundColor = mainButton.dataset.fssProcessingColor;

    }

    toast(`Spigetから転送中: ${final_name}`, 'warn', 3000);
    const r = await api_post(
        `/api/servers/${encodeURIComponent(serverId)}/files/fetch`, 
        {
            url: downloadUrl, 
            path, 
            overwrite: true 
        }
    );

    if (r.ok && r.data && r.data.ok) {
        toast('✅ 転送成功: ' + final_name, 'ok', 5000);

        if (mainButton) {
            mainButton.textContent = '🎉 転送完了!';
            mainButton.style.backgroundColor = '#28a745'; 
            mainButton.style.cursor = 'default';

            runXpAnimation(mainButton); 

            const initialColor = mainButton.dataset.fssInitialColor || '#28a745';
            const initialText = mainButton.dataset.fssInitialText || '🚀 FSSに転送';

            setTimeout(() => {
                mainButton.textContent = initialText;
                mainButton.style.backgroundColor = initialColor;
                mainButton.style.cursor = 'pointer';
                mainButton.disabled = false;
            }, 5000); 
        }

    } else {

        const m = (r.data && (r.data.message || r.data.error || r.data.raw)) || `予期せぬHTTPエラー: ${r.status}`;
        toast(`転送失敗: ${m}`, 'err', 8000);
        console.error(`[FSS] Transfer failed. API Response:`, r);

        if (mainButton) {
             fssButton.textContent = '❌ 転送失敗 (再試行)';
             fssButton.style.backgroundColor = '#dc3545'; 
             setTimeout(() => {
                const initialColor = mainButton.dataset.fssInitialColor || '#28a745';
                const initialText = mainButton.dataset.fssInitialText || '🚀 FSSに転送';
                 fssButton.textContent = initialText;
                 fssButton.style.backgroundColor = initialColor;
                 fssButton.disabled = false;
             }, 3000);
        }
    }
}

async function handleTransferClick(fssButton) {
    if (!st.base) {
         toast('FastserverのURLが設定されていません', 'err');
         return;
    }

    const resourceId = getResourceId();
    if (!resourceId) {
        toast('ページからSpigotのリソースIDを抽出できませんでした。', 'err');
        return;
    }

    const loader = showLoadingScreen('リソース情報取得中...');
    fssButton.disabled = true;

    try {

        const resource = await fetchSpigetResource(resourceId);
        if (!resource) {
            loader.container.remove();
            toast('リソース情報が見つかりませんでした。', 'err');

            fssButton.textContent = fssButton.dataset.fssInitialText || '🚀 FSSに転送';
            fssButton.style.backgroundColor = fssButton.dataset.fssInitialColor || '#28a745';
            fssButton.disabled = false;
            return;
        }

        loader.updateMessage('バージョン取得中...');

        const versions = await fetchSpigetVersions(resourceId);

        if (!versions || versions.length === 0) {
            loader.container.remove();
            toast('リソースのバージョン情報が見つかりませんでした。', 'err');

            fssButton.textContent = fssButton.dataset.fssInitialText || '🚀 FSSに転送';
            fssButton.style.backgroundColor = fssButton.dataset.fssInitialColor || '#28a745';
            fssButton.disabled = false;
            return;
        }

        const latestVersion = versions[0];

        st.resolved = {
            resourceId: resourceId,
            resourceName: resource.name, 
            versionId: latestVersion.id, 
            versionName: latestVersion.name, 
        };

        loader.updateMessage('サーバー一覧取得中...');

        const resp = await api_get(`/api/servers`);

        loader.container.remove();

        if (resp.ok) {
            showServerSelection(resp.data.servers || []);
            fssButton.disabled = false;
            return;
        } else {
            let errorMsg = (resp.data && (resp.data.error || resp.data.message)) || `HTTP ${resp.status}`;
            toast(`サーバー取得失敗: ${errorMsg}`, 'err');
        }

    } catch (e) {
        loader.container.remove(); 
        toast('SpigetまたはFastserverへの接続に失敗しました', 'err');
    } 

    fssButton.textContent = fssButton.dataset.fssInitialText || '🚀 FSSに転送';
    fssButton.style.backgroundColor = fssButton.dataset.fssInitialColor || '#28a745';
    fssButton.disabled = false;
}

function insertFSSButton(downloadLink) {

    if (!getResourceId()) return;

    const downloadLabel = downloadLink.closest('label.downloadButton');
    if (!downloadLabel) return;

    const downloadLabelText = downloadLabel.textContent || '';
    const fileExtension = getAppropriateExtension(downloadLabelText); 
    const isJar = fileExtension === '.jar';

    let buttonColor = '#28a745'; 
    let buttonHoverColor = '#2e8b57';
    let buttonText = '🚀 FSSに転送';

    if (!isJar) {
        buttonColor = '#ffc107'; 
        buttonHoverColor = '#e0a800';
        buttonText = `⚠️ FSSに転送 (${fileExtension.toUpperCase().slice(1)})`; 
        console.warn(`[FSS] Warning: File is a ${fileExtension} not a .jar. Changing button appearance to warning.`);
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    const parent = downloadLabel.parentNode;
    parent.insertBefore(wrapper, downloadLabel);

    const fssButton = document.createElement('button');
    fssButton.textContent = buttonText;
    fssButton.setAttribute('data-fss-main-button', 'true'); 

    fssButton.dataset.fssInitialColor = buttonColor;
    fssButton.dataset.fssInitialText = buttonText;

    fssButton.style.cssText = `
        padding: 7.72px 9.9px;
        font-weight: 600;
        font-size: 13px;
        background-color: ${buttonColor};
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        flex-shrink: 0;
    `;

    fssButton.addEventListener('mouseenter', () => fssButton.style.backgroundColor = buttonHoverColor);
    fssButton.addEventListener('mouseleave', () => fssButton.style.backgroundColor = buttonColor);

    fssButton.addEventListener('click', () => {

        handleTransferClick(fssButton);
    });

    wrapper.appendChild(fssButton);
    wrapper.appendChild(downloadLabel);
}

const settingsReady = new Promise(resolve => {

    function loadSettings() {

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['apiUrl', 'apiKey'], (data) => {

                st.base = data.apiUrl || 'http://localhost:4001';

                st.key = data.apiKey || '';

                console.log(`[FSS] Settings loaded from storage. Base URL: ${st.base}`);
                resolve(); 
            });
        } else {

            st.base = 'http://localhost:4001'; 
            st.key = ''; 
            console.warn("[FSS] chrome.storage not available. Using default settings (http://localhost:4001).");
            resolve(); 
        }
    }
    loadSettings();
});

settingsReady.then(() => {
    const observer = new MutationObserver(muts => {

        const dl = document.querySelector('a.inner[href*="/download"]');

        if (dl && getResourceId() && !dl.dataset.fssInjected) {
            insertFSSButton(dl);
            dl.dataset.fssInjected = 'true';
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const initialDl = document.querySelector('a.inner[href*="/download"]');
    if (initialDl && getResourceId() && !initialDl.dataset.fssInjected) {
        insertFSSButton(initialDl);
        initialDl.dataset.fssInjected = 'true';
    }
});

function getAppropriateExtension(buttonText) {
    if (!buttonText) return '.jar';

    const match = buttonText.match(/\.(jar|zip|sk|yml|rar)\b/i);

    if (match) {

        return match[0].toLowerCase();
    }

    return '.jar';
}
