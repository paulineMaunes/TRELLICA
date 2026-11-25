# Trellica — Deploy to GitHub Pages (complete guide)

This app is a **static Progressive Web App** (HTML/CSS/JS).  
It does **not** require a backend server.  
**Firebase is optional** and not required for the default setup.

You need:

1. A GitHub account  
2. A Google Cloud project (for Google Sign-In + Drive)  
3. About 20–30 minutes the first time  

---

## 1. Upload the app to GitHub

### Option A — New repository (recommended)

1. On GitHub, click **New repository**.
2. Name it e.g. `trellica` (public is easiest for free Pages).
3. Do **not** add a README if you will upload files next.
4. On your computer, unzip `BeepCheckPro-PWA.zip`.
5. Upload **all files and folders inside** the unzipped folder to the **root** of the repo  
   (so `index.html` is at the top level, not nested in another folder).

   You can use the GitHub web UI (**Add file → Upload files**) or git:

   ```bash
   cd BeepCheckPro-PWA
   git init
   git add .
   git commit -m "Initial Trellica PWA"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/trellica.git
   git push -u origin main
   ```

### Option B — Existing repo / docs folder

If you prefer Pages from `/docs`:

- Put the same files under a `docs/` folder.
- In Pages settings, choose **Deploy from a branch → /docs**.

---

## 2. Enable GitHub Pages

1. Open the repo on GitHub → **Settings** → **Pages**.
2. **Source**: Deploy from a branch.
3. **Branch**: `main` (or `master`), folder **`/` (root)** — or `/docs` if you used that.
4. Save.
5. Wait 1–2 minutes. Your site URL will look like:

   `https://YOUR_USERNAME.github.io/trellica/`

6. Open that URL. You should see the Trellica login screen.

> **Important:** Always open the app over **https://** (or `http://localhost`).  
> Opening `index.html` as a `file://` link will break login, storage, and the service worker.

---

## 3. Google Cloud setup (Sign-In + Drive)

Google Sign-In and Drive sync need an **OAuth 2.0 Web Client ID**.

### 3.1 Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (e.g. **Trellica**) or select an existing one.
3. Note the project name for later.

### 3.2 Configure OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type:
   - **Internal** — only if you have a Google Workspace and every user is in that org.
   - **External** — usual choice for school accounts on `@laverdad.edu.ph`.
3. Fill **App name** (Trellica), support email, developer contact.
4. **Scopes**: add at least:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive.file`  
     (Drive files the app creates/opens — used for backup)
5. **Test users** (while app is in Testing):
   - Add your own `@laverdad.edu.ph` or `@student.laverdad.edu.ph` addresses.
6. Save. You can publish later when ready for all teachers/students.

### 3.3 Enable APIs

**APIs & Services → Library** — enable:

| API | Why |
|-----|-----|
| **Google Drive API** | Upload / download backup JSON |
| **Google Identity Services** is loaded from script; no separate “enable” beyond OAuth | Sign-In button |

(Search “Google Drive API” → Enable.)

### 3.4 Create OAuth Client ID

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: e.g. `Trellica Web`.
4. **Authorized JavaScript origins** (exact URLs, no trailing slash path issues):

   ```
   https://YOUR_USERNAME.github.io
   http://localhost
   http://localhost:8080
   http://127.0.0.1:8080
   ```

   If your Pages site is a **project site** (`/trellica/`), the **origin** is still:

   ```
   https://YOUR_USERNAME.github.io
   ```

   (Origin = scheme + host only, no path.)

5. **Authorized redirect URIs** (usually not required for GIS button + token client, but safe to add):

   ```
   https://YOUR_USERNAME.github.io/trellica/
   http://localhost:8080/
   ```

6. Create → copy the **Client ID**  
   (`….apps.googleusercontent.com`).

### 3.5 Put the Client ID in the app

Edit `index.html` near the top:

```html
<script>
  window.BEEPCHECK_GOOGLE_CLIENT_ID = 'PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com';
  (function () {
    var t = localStorage.getItem('beepcheck_theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

Commit and push. Wait for Pages to update, then hard-refresh the site (`Ctrl+Shift+R`).

---

## 4. Login modes (how they work)

| Mode | What it does | Drive sync |
|------|----------------|------------|
| **Continue offline** | Local session on this browser/device. No Google account. | Not available until you sign in with Google |
| **Sign in with Google** | Domain must be `@student.laverdad.edu.ph` or `@laverdad.edu.ph` | Connect Drive under **Data & Sync** |

Allowed domains are enforced in code. Extra domains can be stored later in settings (`allowedDomains`).

---

## 5. Google Drive backup & sync

1. Sign in with **Google** (not offline).
2. Open **Data & Sync**.
3. **Connect Google Drive** → approve Drive file access.
4. **Upload backup to Drive** — writes a JSON backup the app can restore.
5. **Restore latest from Drive** — replaces local data with the newest matching backup.

JSON **Export / Import** always works offline (file download/upload) and does not need Google.

---

## 6. Firebase — is it required?

**No.** The default Trellica PWA does **not** use Firebase.

Use Firebase only if you later want:

- Shared cloud database across many devices in real time  
- Cloud Functions (e.g. send email)  
- Hosting instead of (or in addition to) GitHub Pages  

### Optional Firebase Hosting (alternative to Pages)

1. Install Firebase CLI: `npm install -g firebase-tools`
2. `firebase login` → `firebase init hosting`
3. Set public directory to the PWA folder (where `index.html` lives).
4. `firebase deploy`

You would still configure the **same Google OAuth Web Client ID**, and add your Firebase hosting origin to **Authorized JavaScript origins**, e.g.:

```
https://YOUR_PROJECT.web.app
https://YOUR_PROJECT.firebaseapp.com
```

---

## 7. Local testing before deploy

```bash
cd BeepCheckPro-PWA
python -m http.server 8080
```

Open `http://localhost:8080`.

- Offline continue should work immediately.  
- Google button works only after Client ID is set and `http://localhost:8080` is in Authorized JavaScript origins.

---

## 8. Checklist after first deploy

- [ ] Site opens on `https://YOUR_USERNAME.github.io/REPO/`
- [ ] Favicon shows the Trellica mark
- [ ] **Continue offline** enters the app
- [ ] Client ID set in `index.html`
- [ ] OAuth origins include your Pages host
- [ ] Drive API enabled
- [ ] Test user added on consent screen (if still in Testing)
- [ ] Google Sign-In accepts only La Verdad emails
- [ ] Data & Sync → Connect Drive → Upload works after Google login
- [ ] Hard refresh once after each deploy so service worker updates

---

## 9. Common problems

| Problem | Fix |
|---------|-----|
| Google button missing / “Set CLIENT_ID” | Set `window.BEEPCHECK_GOOGLE_CLIENT_ID` and push |
| `origin_mismatch` / redirect errors | Add exact origin `https://YOUR_USERNAME.github.io` to OAuth client |
| `access_denied` / blocked | Add account as Test user, or publish the OAuth app |
| Domain not allowed | Email must end with `@laverdad.edu.ph` or `@student.laverdad.edu.ph` |
| Drive upload fails | Sign in with Google (not offline); enable Drive API; re-connect |
| Old UI after update | Hard refresh; service worker name is `trellica-v3` |
| Data empty on new device | Use Drive restore or Import JSON from a backup file |

---

## 10. Security notes

- Client IDs for pure front-end apps are **public** (they sit in `index.html`). Protection is via **authorized origins** and **domain checks**, not by hiding the ID.
- Do **not** put a Client **Secret** in this static app.
- School data lives in the browser (IndexedDB) until you export or upload to Drive. Clearing site data deletes local records — keep backups.

---

## 11. Updating the app later

1. Change files locally.
2. `git add -A && git commit -m "Update" && git push`
3. Wait for Pages build.
4. Users should hard-refresh once.

---

## Quick reference — files you edit for config

| File | Purpose |
|------|---------|
| `index.html` | `BEEPCHECK_GOOGLE_CLIENT_ID` |
| `js/auth.js` | Default allowed domains |
| `js/sync.js` | Drive upload/download behavior |
| `data/students-seed.json` | Default roster (first launch only) |
| `data/subjects-seed.json` | Default subjects (first launch only) |

For questions about Workspace-only (Internal) apps vs External testing quotas, see Google’s OAuth consent screen docs in Cloud Console help.
