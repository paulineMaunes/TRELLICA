/**
 * BeepCheck Pro PWA — shell, router, helpers
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
    students: { title: 'Students', render: (el) => StudentsModule.render(el) },
    subjects: { title: 'Subjects', render: (el) => SubjectsModule.render(el) },
    attendance: { title: 'Attendance', render: (el) => AttendanceModule.render(el) },
    gradebook: { title: 'Gradebook', render: (el) => GradebookModule.render(el) },
    recitation: { title: 'Recitation', render: (el) => RecitationModule.render(el) },
    seating: { title: 'Seating Chart', render: (el) => SeatingModule.render(el) },
    grouper: { title: 'Grouper', render: (el) => GrouperModule.render(el) },
    peer: { title: 'Peer Evaluation', render: (el) => PeerModule.render(el) },
    calendar: { title: 'Calendar', render: (el) => CalendarModule.render(el) },
    todo: { title: 'To-Do', render: (el) => TodoModule.render(el) },
    behavior: { title: 'Behavior', render: (el) => BehaviorModule.render(el) },
    sticky: { title: 'Sticky Notes', render: (el) => StickyModule.render(el) },
    reminders: { title: 'Reminders', render: (el) => RemindersModule.render(el) },
    qr: { title: 'QR Codes', render: (el) => QrModule.render(el) },
    sync: { title: 'Data & Sync', render: (el) => Sync.renderSyncPanel(el) }
  };

  let current = 'dashboard';

  async function init() {
    await BCDB.openDB();
    await BCDB.ensureDefaults();
    Sync.updateStatus();
    if (window.google) Sync.initGoogle();
    else window.addEventListener('load', () => setTimeout(() => Sync.initGoogle(), 500));

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.route));
    });
    document.getElementById('btn-collapse')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    navigate(location.hash.replace('#', '') || 'dashboard');
    window.addEventListener('hashchange', () => {
      navigate(location.hash.replace('#', '') || 'dashboard');
    });
  }

  function navigate(route) {
    if (!routes[route]) route = 'dashboard';
    current = route;
    location.hash = route;
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
    document.getElementById('page-title').textContent = routes[route].title;
    const content = document.getElementById('content');
    content.innerHTML = '<p class="text-muted">Loading…</p>';
    routes[route].render(content);
    document.getElementById('sidebar')?.classList.remove('open');
  }

  function reload() {
    navigate(current);
  }

  async function renderDashboard(container) {
    const students = (await BCDB.getAll('students')).filter((s) => s.isActive !== false);
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    const attendance = await BCDB.getAll('attendance');
    const todos = (await BCDB.getAll('todos')).filter((t) => t.status !== 'Done');
    const today = new Date().toISOString().slice(0, 10);
    const todayAtt = attendance.filter((a) => a.classDate === today);
    const present = todayAtt.filter((a) => a.status === 'Present' || a.status === 'Late').length;

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:20px">
        <div class="card" style="margin:0">
          <div class="text-muted" style="font-size:12px;font-weight:600">STUDENTS</div>
          <div style="font-size:28px;font-weight:700;color:var(--accent)">${students.length}</div>
        </div>
        <div class="card" style="margin:0">
          <div class="text-muted" style="font-size:12px;font-weight:600">SUBJECTS</div>
          <div style="font-size:28px;font-weight:700;color:var(--accent)">${subjects.length}</div>
        </div>
        <div class="card" style="margin:0">
          <div class="text-muted" style="font-size:12px;font-weight:600">TODAY MARKED</div>
          <div style="font-size:28px;font-weight:700;color:var(--success)">${todayAtt.length}</div>
        </div>
        <div class="card" style="margin:0">
          <div class="text-muted" style="font-size:12px;font-weight:600">PRESENT / LATE</div>
          <div style="font-size:28px;font-weight:700;color:var(--success)">${present}</div>
        </div>
        <div class="card" style="margin:0">
          <div class="text-muted" style="font-size:12px;font-weight:600">OPEN TASKS</div>
          <div style="font-size:28px;font-weight:700;color:var(--warning)">${todos.length}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Quick actions</div>
        <div class="flex flex-wrap">
          <button class="btn btn-primary" data-go="students">Students</button>
          <button class="btn btn-primary" data-go="attendance">Attendance</button>
          <button class="btn btn-primary" data-go="gradebook">Gradebook</button>
          <button class="btn btn-primary" data-go="recitation">Duck Race</button>
          <button class="btn btn-secondary" data-go="seating">Seating</button>
          <button class="btn btn-secondary" data-go="grouper">Grouper</button>
          <button class="btn btn-secondary" data-go="peer">Peer Eval</button>
          <button class="btn btn-secondary" data-go="calendar">Calendar</button>
          <button class="btn btn-secondary" data-go="sync">Backup / Sync</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Modules</div>
        <p class="text-muted" style="font-size:14px;line-height:1.7">
          Core: Students · Subjects · Attendance · Gradebook · Recitation<br>
          Classroom: Seating · Grouper · Peer Evaluation · QR<br>
          Planner: Calendar · To-Do · Reminders · Sticky Notes · Behavior<br>
          Data: Offline IndexedDB · JSON backup · optional Google Drive
        </p>
      </div>
    `;
    container.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.go));
    });
  }

  return { init, navigate, reload };
})();

document.addEventListener('DOMContentLoaded', () => App.init());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  });
}
