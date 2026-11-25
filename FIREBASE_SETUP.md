# Firebase setup for Trellica

## 1. Create project
1. https://console.firebase.google.com/ → Add project
2. Enable **Google** sign-in under Authentication → Sign-in method
3. Create **Firestore** database (production or test mode, then use our rules)
4. Register a **Web app** → copy the firebaseConfig object into `js/firebase-config.js`

## 2. Link Google Cloud OAuth
Use the same OAuth Web Client ID already in `index.html`.  
In Google Cloud → Credentials, add your **Firebase Hosting origins**:
```
https://YOUR_PROJECT.web.app
https://YOUR_PROJECT.firebaseapp.com
```

## 3. Install CLI & deploy
```bash
npm install -g firebase-tools
firebase login
# edit .firebaserc → set your project id
firebase use YOUR_PROJECT_ID
firebase deploy
```

Deploy pieces separately:
```bash
firebase deploy --only hosting
firebase deploy --only firestore:rules
cd functions && npm install && cd ..
firebase deploy --only functions
```

## 4. What each service does
| Service | Use in Trellica |
|---------|-----------------|
| **Hosting** | Serve the PWA (alternative or in addition to GitHub Pages) |
| **Firestore** | Shared / multi-device backup under `users/{uid}/backup/latest` |
| **Cloud Functions** | `ping`, `sendMail` skeleton for peer-eval emails |

Until `js/firebase-config.js` is filled, the app keeps working offline with IndexedDB only.
