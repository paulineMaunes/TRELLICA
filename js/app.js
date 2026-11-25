/**
 * Trellica PWA — shell, router, theme, login
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function toast(msg, type = '') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

const App = (() => {
  const routes = {
    dashboard: { title: 'Dashboard', render: renderDashboard },
    attendance: { title: 'Attendance', render: (el) => AttendanceModule.render(el) },
    students: { title: 'Student Records', render: (el) => StudentsModule.render(el) },
    subjects: { title: 'Subject Management', render: (el) => SubjectsModule.render(el) },
    enrollment: { title: 'Enrollment', render: renderEnrollmentHub },
    gradebook: { title: 'Gradebook', render: (el) => GradebookModule.render(el) },
    officers: { title: 'Class Officers', render: renderOfficers },
    indivgrades: { title: 'Individual Grades', render: renderIndivGrades },
    picker: { title: 'Random Picker', render: (el) => RecitationModule.render(el) },
    recitation: { title: 'Recitation', render: (el) => RecitationModule.render(el) },
    grouper: { title: 'Group Maker', render: (el) => GrouperModule.render(el) },
    seating: { title: 'Seating Plan', render: (el) => SeatingModule.render(el) },
    projects: { title: 'Group Project Tracker', render: renderProjects },
    timer: { title: 'Classroom Timer', render: (el) => TimerModule.render(el) },
    present: { title: 'Presentation', render: renderPresent },
    peer: { title: 'Peer Evaluation', render: (el) => PeerModule.render(el) },
    sync: { title: 'Data & Sync', render: (el) => Sync.renderSyncPanel(el) }
  };

  let current = 'dashboard';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('trellica_theme', theme);
    const loginLogo = document.getElementById('login-logo');
    if (loginLogo) {
      loginLogo.src = theme === 'dark'
        ? 'assets/logos/logo-full-white.png'
        : 'assets/logos/logo-full-blue.png';
    }
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'light' ? 'dark' : 'light');
  }

  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    const shell = document.getElementById('app-shell');
    if (shell) { shell.classList.remove('hidden'); shell.style.display = 'contents'; }
    const user = Auth.getUser ? Auth.getUser() : Auth.currentUser();
    if (user) {
      const nameEl = document.getElementById('user-name');
      const emailEl = document.getElementById('user-email');
      const av = document.getElementById('user-avatar');
      if (nameEl) nameEl.textContent = user.name || (user.mode === 'offline' ? 'Offline' : 'Teacher');
      if (emailEl) emailEl.textContent = user.email || (user.mode === 'offline' ? 'Local device only' : '');
      if (av) av.textContent = (user.name || user.email || 'O').charAt(0).toUpperCase();
    }
  }

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  }

  async function init() {
    applyTheme(localStorage.getItem('trellica_theme') || localStorage.getItem('beepcheck_theme') || 'light');

    document.getElementById('btn-offline-login')?.addEventListener('click', () => {
      Auth.offlineContinue();
    });

    // Google button (Auth renders into #google-btn-host)
    Auth.initGoogleButton();
    window.addEventListener('load', () => setTimeout(() => Auth.initGoogleButton(), 500));

    const existing = Auth.getUser ? Auth.getUser() : Auth.currentUser();
    if (existing) {
      await bootApp();
    } else {
      showLogin();
    }

    document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (Auth.logout) Auth.logout();
      else Auth.signOut();
    });
    document.getElementById('btn-collapse')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Nav groups
    document.querySelectorAll('.nav-parent').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.nav-group').classList.toggle('open');
      });
    });
    document.querySelectorAll('.nav-btn[data-route]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.route));
    });
  }

  async function onLogin() {
    await bootApp();
  }

  async function bootApp() {
    showApp();
    await BCDB.openDB();
    await BCDB.ensureDefaults();
    Sync.updateStatus();
    if (window.google) Sync.initGoogle();
    navigate(location.hash.replace('#', '') || 'dashboard');
    window.addEventListener('hashchange', () => {
      navigate(location.hash.replace('#', '') || 'dashboard');
    });
  }

  function navigate(route) {
    if (!routes[route]) route = 'dashboard';
    current = route;
    location.hash = route;
    document.querySelectorAll('.nav-btn[data-route]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
    // open parent group if needed
    document.querySelectorAll('.nav-group').forEach((g) => {
      if (g.querySelector(`[data-route="${route}"]`)) g.classList.add('open');
    });
    document.getElementById('page-title').textContent = routes[route].title;
    const content = document.getElementById('content');
    content.innerHTML = '<p class="text-muted">Loading…</p>';
    routes[route].render(content);
    document.getElementById('sidebar')?.classList.remove('open');
  }

  function reload() { navigate(current); }

  async function renderDashboard(container) {
    const students = (await BCDB.getAll('students')).filter((s) => s.isActive !== false);
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    const attendance = await BCDB.getAll('attendance');
    const todos = (await BCDB.getAll('todos')).filter((t) => t.status !== 'Done');
    const events = (await BCDB.getAll('calendarEvents')).sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''));
    const today = new Date().toISOString().slice(0, 10);
    const todayAtt = attendance.filter((a) => a.classDate === today);
    const todayEvents = events.filter((e) => e.eventDate === today);
    const upcoming = events.filter((e) => e.eventDate > today).slice(0, 6);

    container.innerHTML = `
      <div class="stat-row">
        <div class="stat-card"><div class="label">Students</div><div class="value">${students.length}</div></div>
        <div class="stat-card"><div class="label">Subjects</div><div class="value">${subjects.length}</div></div>
        <div class="stat-card"><div class="label">Today marked</div><div class="value">${todayAtt.length}</div></div>
        <div class="stat-card"><div class="label">Open tasks</div><div class="value">${todos.length}</div></div>
      </div>
      <div class="dash-grid">
        <div>
          <div class="card">
            <div class="card-title">
              <span>Today · ${today}</span>
              <button class="btn btn-sm btn-secondary" data-go="attendance">Attendance</button>
            </div>
            ${todayEvents.length === 0
              ? '<p class="text-muted">No events scheduled for today.</p>'
              : todayEvents.map((e) => `
                <div style="padding:8px 0;border-bottom:1px solid var(--border)">
                  <strong>${escapeHtml(e.title)}</strong>
                  <span class="badge badge-active" style="margin-left:6px">${escapeHtml(e.category || '')}</span>
                  <div class="text-muted" style="font-size:12px">${escapeHtml(e.startTime || '')} ${e.notes ? '· ' + escapeHtml(e.notes) : ''}</div>
                </div>`).join('')}
          </div>
          <div class="card">
            <div class="card-title"><span>Upcoming events</span></div>
            ${upcoming.length === 0
              ? '<p class="text-muted">No upcoming events. Add some from Calendar tools later.</p>'
              : upcoming.map((e) => `
                <div class="flex" style="padding:6px 0;border-bottom:1px solid var(--border)">
                  <span class="text-muted" style="width:90px;font-size:12px">${escapeHtml(e.eventDate)}</span>
                  <strong style="flex:1">${escapeHtml(e.title)}</strong>
                </div>`).join('')}
          </div>
        </div>
        <div>
          <div class="card">
            <div class="card-title">
              <span>To-do list</span>
              <button class="btn btn-sm btn-primary" id="dash-todo-add">+</button>
            </div>
            ${todos.length === 0
              ? '<p class="text-muted">No open tasks.</p>'
              : `<div style="display:flex;flex-direction:column;gap:6px">
                  ${todos.slice(0, 8).map((t) => `
                    <label class="flex" style="font-size:13px;cursor:pointer">
                      <input type="checkbox" class="dash-todo" data-id="${t.id}">
                      <span>${escapeHtml(t.title)}${t.dueDate ? ' <span class="text-muted">· ' + escapeHtml(t.dueDate) + '</span>' : ''}</span>
                    </label>`).join('')}
                </div>`}
          </div>
          <div class="card">
            <div class="card-title">Quick actions</div>
            <div class="flex flex-wrap">
              <button class="btn btn-primary" data-go="attendance">Attendance</button>
              <button class="btn btn-secondary" data-go="gradebook">Gradebook</button>
              <button class="btn btn-secondary" data-go="recitation">Recitation</button>
              <button class="btn btn-secondary" data-go="timer">Timer</button>
              <button class="btn btn-secondary" data-go="sync">Sync</button>
            </div>
          </div>
        </div>
      </div>
    `;
    container.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.go));
    });
    container.querySelectorAll('.dash-todo').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const t = await BCDB.getById('todos', +cb.dataset.id);
        if (!t) return;
        t.status = 'Done';
        t.completedAt = new Date().toISOString();
        await BCDB.put('todos', t);
        renderDashboard(container);
      });
    });
    container.querySelector('#dash-todo-add')?.addEventListener('click', async () => {
      const title = prompt('New task:');
      if (!title) return;
      await BCDB.put('todos', {
        id: await BCDB.nextId('todos'),
        title: title.trim(),
        notes: '',
        priority: 'Medium',
        status: 'Open',
        dueDate: '',
        createdAt: new Date().toISOString()
      });
      renderDashboard(container);
    });
  }

  async function renderEnrollmentHub(container) {
    // Reuse students enroll UI via a simple list
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    const enrollments = await BCDB.getAll('enrollments');
    const students = (await BCDB.getAll('students')).filter((s) => s.isActive !== false);

    container.innerHTML = `
      <div class="card">
        <div class="card-title">Enrollment overview</div>
        <p class="text-muted" style="margin-bottom:12px">Open a student from Student Records and click <strong>Enroll</strong> to manage subject enrollment. Summary below:</p>
        <table class="data">
          <thead><tr><th>Subject</th><th>Enrolled</th></tr></thead>
          <tbody>
            ${subjects.map((s) => {
              const n = enrollments.filter((e) => e.subjectId === s.id).length;
              return `<tr><td><strong>${escapeHtml(s.code)}</strong> — ${escapeHtml(s.name)}</td><td>${n}</td></tr>`;
            }).join('') || '<tr><td colspan="2">No subjects</td></tr>'}
          </tbody>
        </table>
        <div class="mt-16">
          <button class="btn btn-primary" id="go-students">Open Student Records</button>
        </div>
      </div>
    `;
    container.querySelector('#go-students').addEventListener('click', () => navigate('students'));
  }

  async function renderOfficers(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Class Officers</div>
        <p class="text-muted">Assign class officers (President, VP, Secretary, Treasurer, etc.) per subject. Stored locally.</p>
        <div id="off-list"></div>
        <button class="btn btn-primary mt-16" id="off-add">+ Add officer role</button>
      </div>
    `;
    const settings = await BCDB.getAll('settings');
    let officers = [];
    try {
      const raw = settings.find((s) => s.key === 'officers');
      officers = raw?.value ? JSON.parse(raw.value) : [];
    } catch { officers = []; }

    const paint = () => {
      const host = container.querySelector('#off-list');
      host.innerHTML = officers.length === 0
        ? '<p class="text-muted">No officers assigned yet.</p>'
        : `<table class="data"><thead><tr><th>Role</th><th>Student</th><th></th></tr></thead><tbody>
          ${officers.map((o, i) => `<tr><td>${escapeHtml(o.role)}</td><td>${escapeHtml(o.name)}</td>
            <td><button class="btn btn-sm btn-danger off-del" data-i="${i}">Remove</button></td></tr>`).join('')}
          </tbody></table>`;
      host.querySelectorAll('.off-del').forEach((btn) => {
        btn.addEventListener('click', async () => {
          officers.splice(+btn.dataset.i, 1);
          await save();
          paint();
        });
      });
    };
    const save = async () => {
      const all = await BCDB.getAll('settings');
      let s = all.find((x) => x.key === 'officers');
      if (!s) s = { id: await BCDB.nextId('settings'), key: 'officers' };
      s.value = JSON.stringify(officers);
      await BCDB.put('settings', s);
    };
    paint();
    container.querySelector('#off-add').addEventListener('click', async () => {
      const role = prompt('Role (e.g. President):');
      if (!role) return;
      const name = prompt('Student name:');
      if (!name) return;
      officers.push({ role, name });
      await save();
      paint();
    });
  }

  async function renderIndivGrades(container) {
    // Lightweight view: pick student, show grade rows
    const students = (await BCDB.getAll('students')).filter((s) => s.isActive !== false)
      .sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));
    const grades = await BCDB.getAll('grades');
    const categories = await BCDB.getAll('categories');

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:240px">
          <label>Student</label>
          <select id="ig-stu">
            <option value="">Select…</option>
            ${students.map((s) => `<option value="${s.id}">${escapeHtml(StudentsModule.fullName(s))}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card" id="ig-out"><p class="text-muted">Select a student to view grades.</p></div>
    `;
    container.querySelector('#ig-stu').addEventListener('change', (e) => {
      const id = +e.target.value;
      const rows = grades.filter((g) => g.studentId === id);
      const out = container.querySelector('#ig-out');
      if (!id) { out.innerHTML = '<p class="text-muted">Select a student.</p>'; return; }
      if (!rows.length) { out.innerHTML = '<p class="text-muted">No grades recorded for this student.</p>'; return; }
      out.innerHTML = `<table class="data"><thead><tr><th>Category</th><th>Item</th><th>Score</th><th>Max</th><th>Period</th></tr></thead><tbody>
        ${rows.map((g) => {
          const cat = categories.find((c) => c.id === g.categoryId);
          return `<tr><td>${escapeHtml(cat?.name || '#' + g.categoryId)}</td><td>${g.itemIndex}</td>
            <td><strong>${g.score ?? '—'}</strong></td><td>${g.maxScore ?? 100}</td><td>${escapeHtml(g.period || '')}</td></tr>`;
        }).join('')}
      </tbody></table>`;
    });
  }

  async function renderProjects(container) {
    // Reuse group sets as project groups
    const sets = await BCDB.getAll('groupSets');
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Group Project Tracker</div>
        <p class="text-muted" style="margin-bottom:12px">Uses saved group sets from Group Maker. Track status per group.</p>
        ${sets.length === 0
          ? '<p class="text-muted">No group sets yet. Create groups in <strong>Tools → Group Maker</strong>, then save a set.</p>'
          : sets.map((s) => `
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">
              <strong>${escapeHtml(s.name)}</strong>
              <div class="text-muted" style="font-size:12px;margin:4px 0">${(s.groups || []).length} groups</div>
              ${(s.groups || []).map((g, i) => `
                <div class="flex" style="padding:4px 0">
                  <span style="flex:1">${escapeHtml(g.name || 'Group ' + (i + 1))} · ${(g.memberIds || []).length} members</span>
                  <select class="proj-status" data-set="${s.id}" data-g="${i}" style="width:140px">
                    <option>Not started</option><option>In progress</option><option>Submitted</option><option>Graded</option>
                  </select>
                </div>`).join('')}
            </div>`).join('')}
      </div>
    `;
  }

  function renderPresent(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Presentation</div>
        <p class="text-muted" style="margin-bottom:14px">Open a lesson link (Google Slides, Canva, PowerPoint Online) in a focused panel for class display.</p>
        <div class="form-row">
          <div class="form-group" style="grid-column:1/-1">
            <label>Presentation URL</label>
            <input id="pres-url" placeholder="https://docs.google.com/presentation/... or Canva link">
          </div>
        </div>
        <button class="btn btn-primary" id="pres-open">Open in panel</button>
        <button class="btn btn-secondary" id="pres-newtab">Open in new tab</button>
        <div id="pres-frame" class="mt-16" style="display:none">
          <iframe id="pres-iframe" style="width:100%;height:70vh;border:1px solid var(--border);border-radius:8px" allowfullscreen></iframe>
        </div>
      </div>
    `;
    container.querySelector('#pres-open').addEventListener('click', () => {
      const url = container.querySelector('#pres-url').value.trim();
      if (!url) { toast('Enter a URL', 'error'); return; }
      container.querySelector('#pres-frame').style.display = 'block';
      container.querySelector('#pres-iframe').src = url;
    });
    container.querySelector('#pres-newtab').addEventListener('click', () => {
      const url = container.querySelector('#pres-url').value.trim();
      if (!url) { toast('Enter a URL', 'error'); return; }
      window.open(url, '_blank');
    });
  }

  return { init, navigate, reload, onLogin };
})();

document.addEventListener('DOMContentLoaded', () => App.init());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW', err));
  });
}
