/**
 * Sync layer — offline queue + Google Drive backup
 *
 * Pure static hosting (GitHub Pages) cannot hide a client secret.
 * Flow supported:
 *  1. Always works offline (IndexedDB)
 *  2. Export / Import JSON file (manual backup)
 *  3. Optional: Google Identity Services + Drive API
 *     — configure OAuth Client ID (Web application) with your
 *       GitHub Pages origin in Google Cloud Console
 *     — set window.BEEPCHECK_GOOGLE_CLIENT_ID before load, or edit below
 */
const Sync = (() => {
  const CLIENT_ID = window.BEEPCHECK_GOOGLE_CLIENT_ID || '';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';
  let tokenClient = null;
  let accessToken = null;
  let online = navigator.onLine;

  function queueChange(store, record) {
    // Lightweight change log for future delta sync
    BCDB.nextId('syncQueue').then(async (id) => {
      await BCDB.put('syncQueue', {
        id,
        store,
        recordId: record?.id,
        action: record?._deleted ? 'delete' : 'upsert',
        at: new Date().toISOString()
      });
    }).catch(() => {});
    updateStatus();
  }

  function updateStatus() {
    const dot = document.getElementById('sync-dot');
    const label = document.getElementById('sync-label');
    if (!dot || !label) return;
    online = navigator.onLine;
    dot.className = 'sync-dot ' + (online ? 'online' : 'offline');
    label.textContent = online
      ? (accessToken ? 'Online · Drive ready' : 'Online · Local only')
      : 'Offline · Local data';
  }

  async function exportJson() {
    const data = await BCDB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BeepCheckPro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded', 'success');
  }

  async function importJson(file) {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      toast('Invalid JSON file', 'error');
      return;
    }
    if (!confirm('Replace local data with this backup? This cannot be undone.')) return;
    await BCDB.importAll(data, { replace: true });
    await BCDB.ensureDefaults();
    toast('Backup restored', 'success');
    if (window.App) App.reload();
  }

  // —— Google Drive (optional) ——
  function initGoogle() {
    if (!CLIENT_ID || !window.google?.accounts?.oauth2) {
      return false;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) {
          toast('Google sign-in failed: ' + resp.error, 'error');
          return;
        }
        accessToken = resp.access_token;
        updateStatus();
        toast('Google Drive connected', 'success');
      }
    });
    return true;
  }

  function connectDrive() {
    if (!CLIENT_ID) {
      toast('Set BEEPCHECK_GOOGLE_CLIENT_ID in index.html to enable Drive sync', 'error');
      return;
    }
    if (!tokenClient) {
      if (!initGoogle()) {
        toast('Google Identity script not loaded yet. Try again in a moment.', 'error');
        return;
      }
    }
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  }

  async function uploadToDrive() {
    if (!accessToken) {
      connectDrive();
      return;
    }
    const data = await BCDB.exportAll();
    const metadata = {
      name: `BeepCheckPro-backup-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json'
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

    try {
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
        body: form
      });
      if (!res.ok) throw new Error(await res.text());
      const file = await res.json();
      // remember last sync
      const settings = await BCDB.getAll('settings');
      const s = settings[0] || { id: 1, key: 'app' };
      s.lastSync = new Date().toISOString();
      s.lastDriveFileId = file.id;
      await BCDB.put('settings', s);
      toast('Uploaded to Google Drive', 'success');
      updateStatus();
    } catch (err) {
      console.error(err);
      toast('Drive upload failed. Re-connect and try again.', 'error');
      accessToken = null;
      updateStatus();
    }
  }

  async function downloadLatestFromDrive() {
    if (!accessToken) {
      connectDrive();
      return;
    }
    try {
      const q = encodeURIComponent("name contains 'BeepCheckPro-backup' and trashed=false");
      const list = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=5&fields=files(id,name,modifiedTime)`,
        { headers: { Authorization: 'Bearer ' + accessToken } }
      );
      const data = await list.json();
      if (!data.files?.length) {
        toast('No BeepCheck backups found on Drive', 'error');
        return;
      }
      const file = data.files[0];
      if (!confirm(`Restore from Drive file:\n${file.name}\n(${file.modifiedTime})\n\nThis replaces local data.`)) return;
      const content = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: 'Bearer ' + accessToken } }
      );
      const json = await content.json();
      await BCDB.importAll(json, { replace: true });
      await BCDB.ensureDefaults();
      toast('Restored from Google Drive', 'success');
      if (window.App) App.reload();
    } catch (err) {
      console.error(err);
      toast('Drive download failed', 'error');
    }
  }

  function renderSyncPanel(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Data & Sync</div>
        <p class="text-muted" style="margin-bottom:16px">
          Data is stored offline (IndexedDB) for this browser profile. Connect Google Drive to back up and restore all settings and configuration for the signed-in account. JSON export/import remains available as a fallback.
        </p>
        <div class="flex flex-wrap" style="margin-bottom:20px">
          <button class="btn btn-primary" id="sync-export">⬇ Export JSON backup</button>
          <label class="btn btn-secondary" style="cursor:pointer">
            ⬆ Import JSON
            <input type="file" id="sync-import" accept="application/json,.json" hidden>
          </label>
        </div>
        <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
        <div class="card-title">Google Drive</div>
        <p class="text-muted" style="margin-bottom:12px;font-size:13px">
          Optional. Create an OAuth 2.0 Web Client ID in Google Cloud Console, add your GitHub Pages origin
          (e.g. <code>https://USERNAME.github.io</code>) to Authorized JavaScript origins, then set
          <code>window.BEEPCHECK_GOOGLE_CLIENT_ID</code> in <code>index.html</code>.
        </p>
        <div class="flex flex-wrap">
          <button class="btn btn-secondary" id="sync-gconnect">Connect Google Drive</button>
          <button class="btn btn-primary" id="sync-gupload">Upload backup to Drive</button>
          <button class="btn btn-secondary" id="sync-gdownload">Restore latest from Drive</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">About offline mode</div>
        <ul style="padding-left:18px;color:var(--text-muted);font-size:14px;line-height:1.6">
          <li>Install this app (browser → Install / Add to Home Screen) for full offline use.</li>
          <li>Data stays on this device until you export or upload to Drive.</li>
          <li>Clearing browser site data will erase local records — keep backups.</li>
        </ul>
      </div>
    `;
    container.querySelector('#sync-export').addEventListener('click', exportJson);
    container.querySelector('#sync-import').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) importJson(f);
      e.target.value = '';
    });
    container.querySelector('#sync-gconnect').addEventListener('click', () => {
      if (window.Auth && Auth.isGoogleUser && !Auth.isGoogleUser()) {
        toast('Sign in with Google first (not offline mode) to use Drive sync', 'error');
        return;
      }
      connectDrive();
    });
    container.querySelector('#sync-gupload').addEventListener('click', uploadToDrive);
    container.querySelector('#sync-gdownload').addEventListener('click', downloadLatestFromDrive);
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);

  return {
    queueChange,
    updateStatus,
    exportJson,
    importJson,
    connectDrive,
    uploadToDrive,
    downloadLatestFromDrive,
    renderSyncPanel,
    initGoogle
  };
})();
