/**
 * Trellica Sync — local IndexedDB + JSON file + Google Drive
 */
const Sync = (() => {
  const CLIENT_ID = () => window.BEEPCHECK_GOOGLE_CLIENT_ID || '';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';
  const BACKUP_PREFIX = 'Trellica-backup';
  let tokenClient = null;
  let accessToken = null;
  let online = navigator.onLine;

  function queueChange(store, record) {
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
    const google = window.Auth && Auth.isGoogleUser && Auth.isGoogleUser();
    if (!online) {
      dot.className = 'sync-dot offline';
      label.textContent = 'Offline · Local data';
    } else if (accessToken) {
      dot.className = 'sync-dot online';
      label.textContent = 'Online · Drive connected';
    } else if (google) {
      dot.className = 'sync-dot online';
      label.textContent = 'Online · Drive available';
    } else {
      dot.className = 'sync-dot online';
      label.textContent = 'Online · Local only';
    }
  }

  async function exportJson() {
    const data = await BCDB.exportAll();
    data._meta = {
      app: 'Trellica',
      exportedAt: new Date().toISOString(),
      build: (window.TRELLICA_BUILD || {}).label || ''
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${BACKUP_PREFIX}-${new Date().toISOString().slice(0, 10)}.json`;
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
    if (!confirm('Replace ALL local data with this backup? This cannot be undone.')) return;
    await BCDB.importAll(data, { replace: true });
    await BCDB.ensureDefaults();
    toast('Backup restored', 'success');
    if (window.App) App.reload();
  }

  function initGoogle() {
    const id = CLIENT_ID();
    if (!id || !window.google?.accounts?.oauth2) return false;
    if (tokenClient) return true;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) {
          console.error(resp);
          toast('Drive permission denied', 'error');
          return;
        }
        accessToken = resp.access_token;
        try { sessionStorage.setItem('trellica_drive_token', accessToken); } catch (_) {}
        updateStatus();
        toast('Google Drive connected', 'success');
      }
    });
    try {
      const saved = sessionStorage.getItem('trellica_drive_token');
      if (saved) accessToken = saved;
    } catch (_) {}
    updateStatus();
    return true;
  }

  function connectDrive() {
    if (window.Auth && Auth.isGoogleUser && !Auth.isGoogleUser()) {
      toast('Sign in with Google first to use Drive backup', 'error');
      return;
    }
    if (!CLIENT_ID()) {
      toast('Google Client ID is not configured', 'error');
      return;
    }
    if (!initGoogle() || !tokenClient) {
      toast('Google Sign-In library not loaded yet — try again in a moment', 'error');
      return;
    }
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  }

  async function driveFetch(url, options = {}) {
    if (!accessToken) throw new Error('Not connected to Drive');
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        ...(options.headers || {})
      }
    });
    if (res.status === 401) {
      accessToken = null;
      try { sessionStorage.removeItem('trellica_drive_token'); } catch (_) {}
      updateStatus();
      throw new Error('Drive session expired — connect again');
    }
    return res;
  }

  async function uploadToDrive() {
    if (!accessToken) {
      toast('Connect Google Drive first', 'error');
      connectDrive();
      return;
    }
    try {
      const payload = await BCDB.exportAll();
      payload._meta = {
        app: 'Trellica',
        exportedAt: new Date().toISOString(),
        build: (window.TRELLICA_BUILD || {}).label || '',
        user: (Auth.getUser && Auth.getUser()) || (Auth.currentUser && Auth.currentUser()) || null
      };
      const body = JSON.stringify(payload);
      const name = `${BACKUP_PREFIX}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const metadata = {
        name,
        mimeType: 'application/json'
      };
      const boundary = 'trellica_' + Date.now();
      const multipart =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) + `\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        body + `\r\n` +
        `--${boundary}--`;

      const res = await driveFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipart
        }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || res.statusText);
      }
      const file = await res.json();
      // remember last backup id in settings
      try {
        const settings = await BCDB.getAll('settings');
        const s = settings.find((x) => x.key === 'app') || settings[0] || { id: 1, key: 'app' };
        s.lastDriveBackupId = file.id;
        s.lastDriveBackupName = file.name;
        s.lastSync = new Date().toISOString();
        await BCDB.put('settings', s);
      } catch (_) {}
      toast('Uploaded to Google Drive: ' + (file.name || name), 'success');
      updateStatus();
    } catch (err) {
      console.error(err);
      toast('Drive upload failed: ' + (err.message || err), 'error');
    }
  }

  async function downloadLatestFromDrive() {
    if (!accessToken) {
      toast('Connect Google Drive first', 'error');
      connectDrive();
      return;
    }
    try {
      const q = encodeURIComponent(
        `name contains '${BACKUP_PREFIX}' and trashed=false`
      );
      const list = await driveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,modifiedTime)`
      );
      const data = await list.json();
      if (!data.files?.length) {
        // also try legacy BeepCheck name
        const q2 = encodeURIComponent("name contains 'BeepCheckPro-backup' and trashed=false");
        const list2 = await driveFetch(
          `https://www.googleapis.com/drive/v3/files?q=${q2}&orderBy=modifiedTime desc&pageSize=5&fields=files(id,name,modifiedTime)`
        );
        const data2 = await list2.json();
        if (!data2.files?.length) {
          toast('No Trellica backups found on Drive', 'error');
          return;
        }
        data.files = data2.files;
      }
      const file = data.files[0];
      if (!confirm(`Restore from Drive?\n\n${file.name}\n${file.modifiedTime}\n\nThis replaces all local data.`)) return;
      const content = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
      );
      if (!content.ok) throw new Error('Could not download file');
      const json = await content.json();
      await BCDB.importAll(json, { replace: true });
      await BCDB.ensureDefaults();
      toast('Restored from Google Drive', 'success');
      if (window.App) App.reload();
    } catch (err) {
      console.error(err);
      toast('Drive restore failed: ' + (err.message || err), 'error');
    }
  }

  function renderSyncPanel(container) {
    const googleUser = window.Auth && Auth.isGoogleUser && Auth.isGoogleUser();
    const u = (Auth.getUser && Auth.getUser()) || (Auth.currentUser && Auth.currentUser()) || {};
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Data &amp; Sync</div>
        <p class="text-muted" style="margin-bottom:14px">
          Classroom data is stored offline in this browser (IndexedDB). Use Google Drive to back up and restore
          across devices for the signed-in account. Domain-restricted Google login is required for Drive.
        </p>
        <div class="stat-row" style="margin-bottom:16px">
          <div class="stat-card">
            <div class="label">Account</div>
            <div class="value" style="font-size:14px;font-weight:600">${escapeHtml(u.email || (u.mode === 'offline' ? 'Offline session' : '—'))}</div>
          </div>
          <div class="stat-card">
            <div class="label">Drive</div>
            <div class="value" style="font-size:14px;font-weight:600">${accessToken ? 'Connected' : (googleUser ? 'Not connected' : 'Sign in with Google')}</div>
          </div>
        </div>
        <div class="card-title">Local file backup</div>
        <div class="flex flex-wrap" style="margin-bottom:20px">
          <button class="btn btn-primary" id="sync-export">⬇ Export JSON</button>
          <label class="btn btn-secondary" style="cursor:pointer">
            ⬆ Import JSON
            <input type="file" id="sync-import" accept="application/json,.json" hidden>
          </label>
        </div>
        <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
        <div class="card-title">Google Drive sync</div>
        <p class="text-muted" style="margin-bottom:12px;font-size:13px">
          Allowed domains: <code>@laverdad.edu.ph</code>, <code>@student.laverdad.edu.ph</code>.
          Files are saved to the Drive of the signed-in Google account.
        </p>
        <div class="flex flex-wrap">
          <button class="btn btn-secondary" id="sync-gconnect">${accessToken ? 'Reconnect Drive' : 'Connect Google Drive'}</button>
          <button class="btn btn-primary" id="sync-gupload" ${!googleUser ? 'disabled title="Sign in with Google first"' : ''}>Upload backup</button>
          <button class="btn btn-secondary" id="sync-gdownload" ${!googleUser ? 'disabled title="Sign in with Google first"' : ''}>Restore latest</button>
          ${googleUser ? '<p class="text-muted" style="width:100%;font-size:12px;margin-top:6px">Signed in as ' + escapeHtml(u.email || '') + '</p>' : ''}
        </div>
        ${!googleUser ? '<p class="text-muted" style="margin-top:10px;font-size:12.5px">Sign in with Google (not offline) to enable Drive sync.</p>' :
          (!accessToken ? '<p class="text-muted" style="margin-top:10px;font-size:12.5px">Click <strong>Connect Google Drive</strong> once to authorize backup upload/restore.</p>' : '<p class="text-muted" style="margin-top:10px;font-size:12.5px;color:var(--success)">Drive connected — upload and restore are ready.</p>')}
      </div>
    `;
    container.querySelector('#sync-export').addEventListener('click', exportJson);
    container.querySelector('#sync-import').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) importJson(f);
      e.target.value = '';
    });
    container.querySelector('#sync-gconnect').addEventListener('click', connectDrive);
    container.querySelector('#sync-gupload').addEventListener('click', uploadToDrive);
    container.querySelector('#sync-gdownload').addEventListener('click', downloadLatestFromDrive);
  }

  async function autoSyncIfNeeded() {
    if (!navigator.onLine) return;
    if (!(window.Auth && Auth.isGoogleUser && Auth.isGoogleUser())) return;
    try {
      const queue = await BCDB.getAll('syncQueue');
      if (!queue.length) return;
      if (!accessToken) {
        // try silent reconnect if we had a token earlier
        initGoogle();
        if (!accessToken) return;
      }
      await uploadToDrive();
      // clear queue after successful upload
      for (const q of queue) {
        try { await BCDB.delete('syncQueue', q.id); } catch (_) {}
      }
      updateStatus();
    } catch (e) {
      console.warn('autoSync', e);
    }
  }

  window.addEventListener('online', () => {
    updateStatus();
    autoSyncIfNeeded();
  });
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
    initGoogle,
    autoSyncIfNeeded
  };
})();
