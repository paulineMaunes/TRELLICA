/**
 * Optional Firebase: Auth link, Firestore mirror, Hosting companion.
 * Loads only when TRELLICA_FIREBASE.projectId is set.
 */
const TrellicaFirebase = (() => {
  let app = null;
  let db = null;
  let ready = false;

  function isConfigured() {
    const c = window.TRELLICA_FIREBASE || {};
    return !!(c.projectId && c.apiKey && c.appId);
  }

  async function init() {
    if (!isConfigured()) {
      console.info('Firebase not configured — using local IndexedDB only');
      return false;
    }
    if (ready) return true;
    try {
      // Dynamic import of Firebase modular SDK from CDN
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js');
      const { getFirestore, doc, setDoc, getDoc, onSnapshot, collection } = await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js');
      const { getAuth, signInWithCredential, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js');

      app = initializeApp(window.TRELLICA_FIREBASE);
      db = getFirestore(app);
      ready = true;
      window.__fb = { app, db, doc, setDoc, getDoc, onSnapshot, collection, getAuth, signInWithCredential, GoogleAuthProvider };
      console.info('Firebase ready');
      return true;
    } catch (e) {
      console.warn('Firebase init failed', e);
      return false;
    }
  }

  /** Push a full local export to Firestore users/{uid}/backup/latest */
  async function pushBackup(uid, payload) {
    if (!ready || !uid) throw new Error('Firebase not ready or missing uid');
    const { doc, setDoc } = window.__fb;
    await setDoc(doc(db, 'users', uid, 'backup', 'latest'), {
      updatedAt: new Date().toISOString(),
      build: (window.TRELLICA_BUILD || {}).label || '',
      data: payload
    }, { merge: true });
  }

  async function pullBackup(uid) {
    if (!ready || !uid) return null;
    const { doc, getDoc } = window.__fb;
    const snap = await getDoc(doc(db, 'users', uid, 'backup', 'latest'));
    return snap.exists() ? snap.data() : null;
  }

  return { init, isConfigured, pushBackup, pullBackup, get ready() { return ready; } };
})();
window.TrellicaFirebase = TrellicaFirebase;
