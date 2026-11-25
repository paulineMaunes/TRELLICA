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

  function renderHubGrid(container, title, items, opts = {}) {
    const viewKey = opts.viewKey || 'hub_view';
    let view = localStorage.getItem(viewKey) || 'grid';
    const qid = 'hub-q-' + (opts.id || 'x');
    function paint(filter = '') {
      const f = filter.trim().toLowerCase();
      const list = !f ? items : items.filter((it) =>
        (it.title + ' ' + it.desc).toLowerCase().includes(f)
      );
      container.innerHTML = `
        <div class="hub-toolbar">
          <div class="search-wrap"><input id="${qid}" type="search" placeholder="Search ${title}…" value="${escapeAttr(filter)}"></div>
          <div class="hub-view-toggle">
            <button type="button" class="${view === 'grid' ? 'active' : ''}" data-view="grid" title="Grid">▦</button>
            <button type="button" class="${view === 'list' ? 'active' : ''}" data-view="list" title="List">☰</button>
          </div>
        </div>
        <div class="hub-grid ${view === 'list' ? 'list' : ''}">
          ${list.map((it) => `
            <button type="button" class="hub-card" data-go="${escapeAttr(it.route)}" style="background:${escapeAttr(it.color || '#2563EB')}">
              <div class="hub-icon">${it.icon || '•'}</div>
              <div>
                <h3>${escapeHtml(it.title)}</h3>
                <p>${escapeHtml(it.desc)}</p>
              </div>
            </button>`).join('') || '<p class="text-muted">No matches.</p>'}
        </div>`;
      container.querySelectorAll('[data-go]').forEach((btn) => {
        btn.addEventListener('click', () => navigate(btn.dataset.go));
      });
      container.querySelectorAll('[data-view]').forEach((btn) => {
        btn.addEventListener('click', () => {
          view = btn.dataset.view;
          localStorage.setItem(viewKey, view);
          paint(container.querySelector('#' + qid)?.value || '');
        });
      });
      const input = container.querySelector('#' + qid);
      input?.addEventListener('input', () => paint(input.value));
    }
    paint();
  }

  function renderRecordsHub(container) {
    renderHubGrid(container, 'Records', [
      { route: 'students', title: 'Student Records', desc: 'View and manage enrolled student profiles and records.', icon: '👥', color: '#0D9488' },
      { route: 'subjects', title: 'Subject Management', desc: 'Create, edit, and organize subjects and sections.', icon: '📚', color: '#14B8A6' },
      { route: 'enrollment', title: 'Enrollment', desc: 'Manage student enrollment and section assignments.', icon: '🔗', color: '#8B5CF6' },
      { route: 'gradebook', title: 'Gradebook', desc: 'Compute, review, and manage class grades.', icon: '📊', color: '#22C55E' },
      { route: 'officers', title: 'Class Officers', desc: 'Assign and manage class officers.', icon: '★', color: '#F59E0B' },
      { route: 'viewgrades', title: 'Individual Grades', desc: 'Inspect grade breakdowns per student.', icon: '📑', color: '#F43F5E' }
    ], { id: 'records', viewKey: 'trellica_records_view' });
  }

  function renderToolsHub(container) {
    renderHubGrid(container, 'Tools', [
      { route: 'recitation', title: 'Random / Recitation', desc: 'Pick students randomly for recitation and participation.', icon: '🎯', color: '#14B8A6' },
      { route: 'grouper', title: 'Group Maker', desc: 'Generate and shuffle student groups.', icon: '👥', color: '#8B5CF6' },
      { route: 'seating', title: 'Seating Plan', desc: 'Arrange and manage classroom seating layouts.', icon: '▦', color: '#0EA5E9' },
      { route: 'project', title: 'Group Project Tracker', desc: 'Track group milestones, deliverables, and progress.', icon: '📋', color: '#3B82F6' },
      { route: 'timer', title: 'Classroom Timer', desc: 'Run countdowns/timers for activities and exams.', icon: '⏱', color: '#EC4899' },
      { route: 'present', title: 'Presentation', desc: 'Launch classroom presentations and slides.', icon: '🖥', color: '#F59E0B' },
      { route: 'peer', title: 'Peer Evaluation', desc: 'Collect and review peer assessment feedback.', icon: '◎', color: '#A855F7' },
      { route: 'qr', title: 'QR Codes', desc: 'Generate and use QR codes for quick classroom workflows.', icon: '▣', color: '#10B981' }
    ], { id: 'tools', viewKey: 'trellica_tools_view' });
  }



  const routes = {
    dashboard: { title: 'Dashboard', render: renderDashboard },
    records: { title: 'Records Hub', render: renderRecordsHub },
    tools: { title: 'Tools Hub', render: renderToolsHub },
    attendance: { title: 'Attendance', render: (el) => AttendanceModule.render(el) },
    students: { title: 'Student Records', render: (el) => StudentsModule.render(el) },
    subjects: { title: 'Subject Management', render: (el) => SubjectsModule.render(el) },
    enrollment: { title: 'Enrollment', render: renderEnrollmentHub },
    gradebook: { title: 'Gradebook', render: (el) => GradebookModule.render(el) },
    officers: { title: 'Class Officers', render: (el) => (window.OfficersModule ? OfficersModule.render(el) : renderOfficers(el)) },
    viewgrades: { title: 'Individual Grades', render: (el) => (window.ViewGradesModule ? ViewGradesModule.render(el) : renderIndivGrades(el)) },
    indivgrades: { title: 'Individual Grades', render: (el) => (window.ViewGradesModule ? ViewGradesModule.render(el) : renderIndivGrades(el)) },
    picker: { title: 'Random Picker', render: (el) => RecitationModule.render(el) },
    recitation: { title: 'Recitation', render: (el) => RecitationModule.render(el) },
    grouper: { title: 'Group Maker', render: (el) => GrouperModule.render(el) },
    seating: { title: 'Seating Plan', render: (el) => SeatingModule.render(el) },
    project: { title: 'Group Project Tracker', render: (el) => (window.ProjectModule ? ProjectModule.render(el) : renderProjects(el)) },
    projects: { title: 'Group Project Tracker', render: (el) => (window.ProjectModule ? ProjectModule.render(el) : renderProjects(el)) },
    timer: { title: 'Classroom Timer', render: (el) => TimerModule.render(el) },
    present: { title: 'Presentation', render: (el) => (window.PresentModule ? PresentModule.render(el) : renderPresent(el)) },
    peer: { title: 'Peer Evaluation', render: (el) => PeerModule.render(el) },
    qr: { title: 'QR Codes', render: (el) => QrModule.render(el) },
    behavior: { title: 'Behavior', render: (el) => BehaviorModule.render(el) },
    sticky: { title: 'Sticky Notes', render: (el) => StickyModule.render(el) },
    reminders: { title: 'Reminders', render: (el) => RemindersModule.render(el) },
    calendar: { title: 'Calendar', render: (el) => CalendarModule.render(el) },
    todo: { title: 'To-Do', render: (el) => TodoModule.render(el) },
    sync: { title: 'Data & Sync', render: (el) => Sync.renderSyncPanel(el) },
    adminpanel: { title: 'Superadmin Panel', render: renderAdminPanel },
    student: { title: 'My Dashboard', render: renderStudentView }
  };

  let current = 'dashboard';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('trellica_theme', theme);
    localStorage.setItem('beepcheck_theme', theme);
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
    document.getElementById('btn-signout')?.addEventListener('click', () => {
      if (Auth.logout) Auth.logout();
      else if (Auth.signOut) Auth.signOut();
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
    const user = Auth.getUser ? Auth.getUser() : Auth.currentUser();
    try {
      if (BCDB.setActiveUser) BCDB.setActiveUser(user && user.email ? user.email : '');
      await BCDB.openDB();
      await BCDB.ensureDefaults();
    } catch (e) {
      console.error('DB init', e);
      toast('Storage init issue — trying to continue', 'error');
    }
    try { Sync.updateStatus(); } catch (_) {}
    try { if (window.google) Sync.initGoogle(); } catch (_) {}
    try { if (window.TrellicaFirebase) await TrellicaFirebase.init(); } catch (e) { console.warn(e); }
    try { if (Sync.autoSyncIfNeeded) Sync.autoSyncIfNeeded(); } catch (_) {}

    // Role-based landing: always dashboard (or student view for students)
    const role = (user && user.role) || (window.Roles && user ? await Roles.roleOf(user.email) : null);
    let start = 'dashboard';
    if (role === 'student') start = 'student';
    // force dashboard hash for staff
    if (role !== 'student') start = 'dashboard';
    history.replaceState(null, '', '#' + start);
    await navigate(start);
    window.addEventListener('hashchange', () => {
      navigate((location.hash || '').replace('#', '') || 'dashboard');
    });
    applyRoleNav(role);
  }

  function applyRoleNav(role) {
    const staff = !role || role === 'superadmin' || role === 'admin' || role === 'instructor';
    document.querySelectorAll('.nav-btn[data-route]').forEach((btn) => {
      const r = btn.dataset.route;
      if (role === 'student') {
        // students only see student dashboard conceptually - hide staff hubs
        const allow = r === 'student' || r === 'dashboard';
        btn.style.display = allow ? '' : 'none';
      } else {
        btn.style.display = '';
        if (r === 'adminpanel') {
          btn.style.display = role === 'superadmin' ? '' : 'none';
        }
        if (r === 'student') btn.style.display = 'none';
      }
    });
  }

  async function navigate(route) {
    if (!routes[route]) route = 'dashboard';
    current = route;
    try {
      if ((location.hash || '').replace(/^#/, '') !== route) {
        history.replaceState(null, '', '#' + route);
      }
    } catch (_) {}
    document.querySelectorAll('.nav-btn[data-route]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
    document.querySelectorAll('.nav-group').forEach((g) => {
      if (g.querySelector(`[data-route="${route}"]`)) g.classList.add('open');
    });
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = routes[route].title;
    const content = document.getElementById('content');
    if (!content) return;
    content.innerHTML = '<p class="text-muted">Loading…</p>';
    try {
      await Promise.resolve(routes[route].render(content));
    } catch (err) {
      console.error('Render failed:', route, err);
      content.innerHTML = '<div class="card"><p class="text-muted">Could not load this screen.</p><pre style="font-size:12px;white-space:pre-wrap;color:var(--danger)">' +
        escapeHtml(String(err && err.message ? err.message : err)) + '</pre><button class="btn btn-secondary" id="retry-nav">Back to Dashboard</button></div>';
      content.querySelector('#retry-nav')?.addEventListener('click', () => navigate('dashboard'));
    }
    
    // Hub parents stay highlighted for child modules
    const recordsRoutes = ['students','subjects','enrollment','gradebook','officers','viewgrades','indivgrades','records'];
    const toolsRoutes = ['recitation','picker','grouper','seating','project','projects','timer','present','peer','qr','tools'];
    document.querySelectorAll('.nav-btn[data-route="records"]').forEach((b) => {
      if (recordsRoutes.includes(route)) b.classList.add('active');
    });
    document.querySelectorAll('.nav-btn[data-route="tools"]').forEach((b) => {
      if (toolsRoutes.includes(route)) b.classList.add('active');
    });

    document.getElementById('sidebar')?.classList.remove('open');
    // show build version in footer chip if present
    const bv = document.getElementById('build-version');
    if (bv && window.TRELLICA_BUILD) bv.textContent = window.TRELLICA_BUILD.label;
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
            <div class="card-title">
              <span>Calendar · Upcoming events</span>
            </div>
            <div class="form-row" style="margin-bottom:12px">
              <div class="form-group"><label>Title</label><input id="dash-ev-title" placeholder="Event title"></div>
              <div class="form-group"><label>Date</label><input id="dash-ev-date" type="date"></div>
              <div class="form-group"><label>Time</label><input id="dash-ev-time" type="time"></div>
              <div class="form-group"><label>Category</label>
                <select id="dash-ev-cat"><option>Class</option><option>Holiday</option><option>Exam</option><option>Meeting</option><option>Other</option></select>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" id="dash-add-event" type="button">+ Add event</button>
            <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">
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
    const dateInput = container.querySelector('#dash-ev-date');
    if (dateInput && !dateInput.value) dateInput.value = today;
    container.querySelector('#dash-add-event')?.addEventListener('click', async () => {
      const title = container.querySelector('#dash-ev-title')?.value?.trim();
      const eventDate = container.querySelector('#dash-ev-date')?.value;
      const startTime = container.querySelector('#dash-ev-time')?.value || '';
      const category = container.querySelector('#dash-ev-cat')?.value || 'Other';
      if (!title || !eventDate) { toast('Title and date required', 'error'); return; }
      const id = await BCDB.nextId('calendarEvents');
      await BCDB.put('calendarEvents', {
        id, title, eventDate, startTime, category, notes: '', createdAt: new Date().toISOString()
      });
      if (window.Sync) Sync.queueChange('calendarEvents', { id });
      toast('Event added', 'success');
      renderDashboard(container);
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



  async function renderAdminPanel(container) {
    const user = Auth.getUser ? Auth.getUser() : Auth.currentUser();
    const role = user?.role || await Roles.roleOf(user?.email);
    if (role !== 'superadmin') {
      container.innerHTML = '<div class="card"><p>Superadmin only.</p></div>';
      return;
    }
    const map = await Roles.getMembersMap();
    const members = Object.entries(map).map(([email, r]) => ({ email, role: r }));
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Superadmin Panel</div>
        <p class="text-muted" style="margin-bottom:14px">Manage roles. Superadmin: <code>${escapeHtml(Roles.SUPERADMIN)}</code></p>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input id="adm-email" placeholder="name@laverdad.edu.ph"></div>
          <div class="form-group"><label>Role</label>
            <select id="adm-role">
              <option value="admin">admin</option>
              <option value="instructor">instructor</option>
              <option value="student">student</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" id="adm-add">Add / update member</button>
        <table class="data-table mt-16">
          <thead><tr><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            ${members.map((m) => `
              <tr>
                <td>${escapeHtml(m.email)}</td>
                <td><span class="badge badge-active">${escapeHtml(m.role)}</span></td>
                <td>${m.email === Roles.SUPERADMIN ? '—' : `<button class="btn btn-sm btn-secondary adm-rm" data-email="${escapeAttr(m.email)}">Remove</button>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    container.querySelector('#adm-add')?.addEventListener('click', async () => {
      try {
        await Roles.addMember(container.querySelector('#adm-email').value, container.querySelector('#adm-role').value);
        toast('Member saved', 'success');
        renderAdminPanel(container);
      } catch (e) { toast(e.message || String(e), 'error'); }
    });
    container.querySelectorAll('.adm-rm').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove ' + btn.dataset.email + '?')) return;
        await Roles.removeMember(btn.dataset.email);
        renderAdminPanel(container);
      });
    });
  }

  async function renderStudentView(container) {
    const user = Auth.getUser ? Auth.getUser() : Auth.currentUser();
    const email = (user?.email || '').toLowerCase();
    const students = await BCDB.getAll('students');
    const me = students.find((s) => (s.email || '').toLowerCase() === email || (s.alternateEmail || '').toLowerCase() === email);
    const events = (await BCDB.getAll('calendarEvents')).sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''));
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events.filter((e) => e.eventDate >= today).slice(0, 10);
    const attendance = await BCDB.getAll('attendance');
    const myAtt = me ? attendance.filter((a) => a.studentId === me.id || a.studentNumber === me.studentNumber) : [];
    const needsExcuse = myAtt.filter((a) => (a.status === 'Late' || a.status === 'Absent') && !a.excuseSubmitted);
    const grades = await BCDB.getAll('grades');
    const myGrades = me ? grades.filter((g) => g.studentId === me.id) : [];

    container.innerHTML = `
      <div class="stat-row">
        <div class="stat-card"><div class="label">Role</div><div class="value" style="font-size:16px">Student</div></div>
        <div class="stat-card"><div class="label">Attendance flags</div><div class="value tabular-nums">${needsExcuse.length}</div></div>
        <div class="stat-card"><div class="label">Grade records</div><div class="value tabular-nums">${myGrades.length}</div></div>
      </div>
      ${needsExcuse.length ? `
        <div class="card" style="border-color:var(--warning)">
          <div class="card-title">Excuse letter needed</div>
          ${needsExcuse.slice(0, 5).map((a) => `
            <p style="margin-bottom:8px">Hi ${escapeHtml(me?.nickname || me?.firstName || 'student')}, you were
            <strong>${escapeHtml(a.status)}</strong> on ${escapeHtml(a.classDate || '')}.
            Please submit an excuse letter to your instructor.</p>
            <button class="btn btn-sm btn-primary st-excuse" data-id="${a.id}">Mark excuse letter submitted</button>
          `).join('<hr style="margin:12px 0;border:none;border-top:1px solid var(--border)">')}
        </div>` : ''}
      <div class="dash-grid">
        <div class="card">
          <div class="card-title">Calendar</div>
          ${upcoming.length === 0 ? '<p class="text-muted">No upcoming events.</p>' :
            upcoming.map((e) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
              <strong>${escapeHtml(e.title)}</strong>
              <div class="text-muted" style="font-size:12px">${escapeHtml(e.eventDate)} ${escapeHtml(e.startTime || '')} · ${escapeHtml(e.category || '')}</div>
            </div>`).join('')}
        </div>
        <div class="card">
          <div class="card-title">My grade standing</div>
          ${!me ? '<p class="text-muted">No student profile linked to this email yet. Ask your instructor to register your email on your student record.</p>' :
            myGrades.length === 0 ? '<p class="text-muted">No grades posted yet.</p>' :
            `<table class="data-table"><thead><tr><th>Subject</th><th>Period</th><th>Score</th></tr></thead>
            <tbody>${myGrades.slice(0, 20).map((g) => `<tr>
              <td>${escapeHtml(String(g.subjectId || g.subject || ''))}</td>
              <td>${escapeHtml(g.period || '')}</td>
              <td class="tabular-nums">${escapeHtml(String(g.score ?? g.grade ?? '—'))}</td>
            </tr>`).join('')}</tbody></table>`}
          <div class="card-title" style="margin-top:16px">Recent attendance</div>
          ${myAtt.length === 0 ? '<p class="text-muted">No attendance records.</p>' :
            `<table class="data-table"><thead><tr><th>Date</th><th>Status</th><th>Excuse</th></tr></thead>
            <tbody>${myAtt.slice(-15).reverse().map((a) => `<tr>
              <td>${escapeHtml(a.classDate || '')}</td>
              <td>${escapeHtml(a.status || '')}</td>
              <td>${a.excuseSubmitted ? 'Yes' : '—'}</td>
            </tr>`).join('')}</tbody></table>`}
        </div>
      </div>`;
    container.querySelectorAll('.st-excuse').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rec = await BCDB.getById('attendance', +btn.dataset.id);
        if (!rec) return;
        rec.excuseSubmitted = true;
        rec.excuseSubmittedAt = new Date().toISOString();
        await BCDB.put('attendance', rec);
        if (window.Sync) Sync.queueChange('attendance', rec);
        toast('Excuse letter marked submitted', 'success');
        renderStudentView(container);
      });
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
