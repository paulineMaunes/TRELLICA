# Trellica · BeepCheck Pro PWA

Offline-first classroom app with Google institutional login, light/dark themes, and Drive backup.

## Sign-in

- Google accounts only from **student.laverdad.edu.ph** or **laverdad.edu.ph** (extra domains can be stored later in settings).
- Set `window.BEEPCHECK_GOOGLE_CLIENT_ID` in `index.html` for production Sign-In + Drive.
- Without a Client ID, use **Continue (demo)** for local testing.

## Themes (Trellica palette)

| Token | Light | Dark |
|-------|-------|------|
| Brand | #2563EB | #2563EB |
| Accent | #1D4ED8 | #38BDF8 |
| Background | #F8FAFC | #0B1120 |
| Card | #FFFFFF | #162032 |
| Text | #0F172A | #F1F5F9 |

Toggle via ◐ in the sidebar. Logos switch automatically:

- **Expanded:** full BLUE (light) / full WHITE (dark)
- **Collapsed:** horizontal BLUE (light) / horizontal WHITE (dark)

Collapsed sidebar hides the scrollbar.

## Default data

On first run (empty students store), the app loads `data/seed.json` built from:

- UPDATED STUDENT LIST - 11212026.csv (69 students)
- BeepCheckPro backup subjects, enrollments, calendar events

## Navigation

1. **Dashboard** — calendar, today’s events, upcoming, to-do  
2. **Attendance**  
3. **Records Management** — students, subjects, enrollment, gradebook, class officers, individual grades  
4. **Tools** — recitation/duck race, grouper, seating, project tracker, classroom timer, presentation embed, peer eval, QR  
5. **Data & Sync** — JSON + Google Drive backup/restore for the signed-in account  

## Deploy

Upload folder contents to GitHub Pages. Use HTTPS. Hard-refresh after deploy so service worker `beepcheck-v3` activates.
