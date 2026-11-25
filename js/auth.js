/**
 * Google Sign-In — restricted to allowed domains
 * Default: student.laverdad.edu.ph, laverdad.edu.ph
 * Extra domains can be added via settings.allowedDomains
 */
const Auth = (() => {
  const DEFAULT_DOMAINS = ['student.laverdad.edu.ph', 'laverdad.edu.ph'];
  const STORAGE_KEY = 'beepcheck_user';
  let user = null;
  let tokenClient = null;

  function getClientId() {
    return window.BEEPCHECK_GOOGLE_CLIENT_ID || '';
  }

  async function allowedDomains() {
    try {
      const settings = await BCDB.getAll('settings');
      const s = settings.find((x) => x.key === 'app') || settings[0];
      if (s && Array.isArray(s.allowedDomains) && s.allowedDomains.length) {
        return s.allowedDomains.map((d) => d.toLowerCase());
      }
    } catch (_) {}
    return DEFAULT_DOMAINS.slice();
  }

  function domainOf(email) {
    const i = (email || '').lastIndexOf('@');
    return i >= 0 ? email.slice(i + 1).toLowerCase() : '';
  }

  async function isAllowedEmail(email) {
    if (window.Roles) return Roles.isAllowedEmail(email);
    const domains = await allowedDomains();
    const d = domainOf(email);
    return domains.some((x) => d === x || d.endsWith('.' + x));
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveUser(u) {
    user = u;
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function currentUser() {
    return user || loadStored();
  }

  function showLogin() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    const shell = document.getElementById('app-shell');
    if (shell) { shell.classList.add('hidden'); shell.style.display = 'none'; }
  }

  function showApp() {
    document.getElementById('login-screen')?.classList.add('hidden');
    const shell = document.getElementById('app-shell');
    if (shell) { shell.classList.remove('hidden'); shell.style.display = 'contents'; }
    updateUserChip();
  }

  function updateUserChip() {
    const u = currentUser();
    const chip = document.getElementById('user-chip');
    if (!chip || !u) return;
    const img = chip.querySelector('img');
    const strong = chip.querySelector('strong');
    const span = chip.querySelector('.email');
    if (img) {
      img.src = u.picture || '';
      img.style.display = u.picture ? 'block' : 'none';
    }
    if (strong) strong.textContent = u.name || u.email || 'User';
    if (span) span.textContent = u.email || '';
  }

  function decodeJwt(token) {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }

  async function handleCredential(response) {
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = '';
    const payload = decodeJwt(response.credential);
    if (!payload || !payload.email) {
      if (errEl) errEl.textContent = 'Could not read Google account.';
      return;
    }
    if (!(await isAllowedEmail(payload.email))) {
      const domains = await allowedDomains();
      if (errEl) {
        errEl.textContent =
          'Only accounts from: ' + domains.join(', ') + '. Your email: ' + payload.email;
      }
      return;
    }
    const email = (payload.email || '').toLowerCase();
    const role = window.Roles ? await Roles.roleOf(email) : 'instructor';
    saveUser({
      email,
      name: payload.name || email,
      picture: payload.picture || '',
      sub: payload.sub,
      mode: 'google',
      role: role || 'instructor',
      signedInAt: new Date().toISOString()
    });
    showApp();
    if (window.App) App.onLogin();
  }

  function initGoogleButton() {
    const clientId = getClientId();
    const host = document.getElementById('google-btn-host');
    if (!host) return;

    if (!clientId) {
      host.innerHTML = `
        <p class="text-muted" style="font-size:13px;margin-bottom:12px;text-align:left">
          Google Client ID missing. For local testing only, continue as a domain-allowed demo user:
        </p>
        <button class="btn btn-primary w-full" id="demo-login">Sign in as instructor@laverdad.edu.ph (demo)</button>
      `;
      document.getElementById('demo-login')?.addEventListener('click', async () => {
        saveUser({
          email: 'instructor@laverdad.edu.ph',
          name: 'Instructor (Demo)',
          picture: '',
          sub: 'demo',
          mode: 'google',
          signedInAt: new Date().toISOString()
        });
        showApp();
        if (window.App) App.onLogin();
      });
      return;
    }

    if (!window.google?.accounts?.id) {
      host.innerHTML = '<p class="text-muted">Loading Google Sign-In…</p>';
      setTimeout(initGoogleButton, 400);
      return;
    }

    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      auto_select: false,
      itp_support: true
    });
    host.innerHTML = '';
    google.accounts.id.renderButton(host, {
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
      shape: 'rectangular'
    });
  }

  function signOut() {
    saveUser(null);
    try {
      if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    } catch (_) {}
    showLogin();
    initGoogleButton();
  }

  async function bootstrap() {
    const u = loadStored();
    if (u && (u.mode === 'offline' || u.sub === 'offline')) {
      user = u;
      showApp();
      return true;
    }
    if (u && u.email && (await isAllowedEmail(u.email))) {
      user = u;
      showApp();
      return true;
    }
    saveUser(null);
    showLogin();
    initGoogleButton();
    return false;
  }

  function offlineContinue() {
    saveUser({
      email: '',
      name: 'Offline user',
      picture: '',
      sub: 'offline',
      mode: 'offline',
      role: 'instructor',
      signedInAt: new Date().toISOString()
    });
    showApp();
    if (window.App) App.onLogin();
  }

  function isGoogleUser() {
    const u = currentUser();
    return !!(u && u.mode !== 'offline' && u.email && u.sub !== 'offline');
  }

  // Compatibility aliases used by app.js
  function getUser() { return currentUser(); }
  function logout() { signOut(); }
  async function demoLogin(email) {
    email = (email || '').trim().toLowerCase();
    if (!email) return false;
    const ok = window.Roles ? Roles.isAllowedEmail(email) : DEFAULT_DOMAINS.some((x) => domainOf(email) === x);
    if (!ok) {
      const errEl = document.getElementById('login-error');
      if (errEl) errEl.textContent = 'Email not allowed: ' + email;
      return false;
    }
    const role = window.Roles ? await Roles.roleOf(email) : 'instructor';
    saveUser({
      email,
      name: email.split('@')[0],
      picture: '',
      sub: 'demo-' + email,
      mode: 'google',
      role: role || 'instructor',
      signedInAt: new Date().toISOString()
    });
    showApp();
    if (window.App) App.onLogin();
    return true;
  }

  return {
    bootstrap,
    currentUser,
    getUser,
    signOut,
    logout,
    initGoogleButton,
    offlineContinue,
    isGoogleUser,
    demoLogin,
    allowedDomains,
    isAllowedEmail,
    DEFAULT_DOMAINS,
    getRole() {
      const u = currentUser();
      return (u && u.role) || null;
    },
    get CLIENT_ID() { return getClientId(); }
  };
})();
