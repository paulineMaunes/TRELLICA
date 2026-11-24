# BeepCheck Pro PWA

Offline-first Progressive Web App version of BeepCheck Pro.

**Stack:** Vanilla JS + modern CSS · IndexedDB · Service Worker · optional Google Drive

## Modules

| Module | Features |
|--------|----------|
| Students + Enrollment | Full profile CRUD, NFC/ID, hard-delete with enrollments |
| Subjects + Schedules | Semester, year, class set, weekly time slots |
| Attendance | Present / Late / Absent / Excuse · bulk mark |
| Gradebook | Weighted categories (desktop defaults) · Midterm/Finals |
| Recitation | Pool · random pick · Duck Race · points |
| Seating Chart | Custom grid · assign / free seats · save per subject |
| Grouper | Random groups · optional leaders · save/load sets |
| Peer Evaluation | Sessions · 8-criteria ratings · results averages |
| Calendar | Month view · academic events CRUD |
| To-Do | Priority · due dates · complete |
| Behavior | Positive / Neutral / Concern log per student |
| Sticky Notes | Color board · auto-save |
| Reminders | Due datetime · overdue highlight |
| QR Codes | Student payload QR · session codes |
| Data & Sync | JSON export/import · optional Google Drive |

## Deploy to GitHub Pages

1. Upload the **contents** of this folder to a GitHub repo.
2. **Settings → Pages** → branch `main`, folder `/`.
3. Open `https://YOUR_USERNAME.github.io/REPO_NAME/`.

Install via browser “Install app” / “Add to Home Screen” for offline use.

## Local test

```bash
python -m http.server 8080
# or: npx serve .
```

Open `http://localhost:8080` (not `file://`).

## Google Drive (optional)

Set in `index.html`:

```js
window.BEEPCHECK_GOOGLE_CLIENT_ID = 'YOUR_ID.apps.googleusercontent.com';
```

OAuth client type: **Web application**. Add your Pages origin to Authorized JavaScript origins.

## Notes

- Data lives in browser IndexedDB until you export or upload to Drive.
- Clearing site data wipes local records — keep backups.
- DB version 2 adds stores for new modules; existing data is preserved on upgrade.
