/**
 * Attendance — gateway + Record (live check-in) + View + Excuse All
 */
const AttendanceModule = (() => {
  let mode = 'gateway'; // gateway | record | view | excuse
  let selectedSubjectId = null;
  let selectedDate = new Date().toISOString().slice(0, 10);
  let clockTimer = null;
  let flashTimer = null;

  function stopClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
  }

  async function loadContext() {
    const [subjects, students, enrollments, attendance] = await Promise.all([
      BCDB.getAll('subjects'),
      BCDB.getAll('students'),
      BCDB.getAll('enrollments'),
      BCDB.getAll('attendance')
    ]);
    const activeSubjects = subjects.filter((s) => s.isActive !== false);
    if (!selectedSubjectId && activeSubjects[0]) selectedSubjectId = activeSubjects[0].id;
    const subject = activeSubjects.find((s) => s.id === selectedSubjectId) || null;
    const enrolledIds = new Set(
      enrollments.filter((e) => e.subjectId === selectedSubjectId && e.isActive !== false).map((e) => e.studentId)
    );
    const enrolled = students
      .filter((s) => enrolledIds.has(s.id) && s.isActive !== false)
      .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || (a.firstName || '').localeCompare(b.firstName || ''));
    return { activeSubjects, subject, students, enrolled, enrollments, attendance };
  }

  function subjectSelect(activeSubjects) {
    return `
      <label style="display:flex;align-items:center;gap:8px;font-size:13px">
        Subject:
        <select id="att-subject" style="min-width:220px">
          ${activeSubjects.map((s) =>
            `<option value="${s.id}" ${s.id === selectedSubjectId ? 'selected' : ''}>${escapeHtml((s.code || '') + ' – ' + (s.name || ''))}</option>`
          ).join('')}
        </select>
      </label>`;
  }

  function renderGateway(container) {
    stopClock();
    container.innerHTML = `
      <div class="att-gateway">
        <h2 style="text-align:center;margin-bottom:8px">Attendance</h2>
        <p class="text-muted" style="text-align:center;margin-bottom:24px">Choose a mode</p>
        <div class="hub-grid" style="max-width:900px;margin:0 auto">
          <button type="button" class="hub-card" data-mode="record" style="background:#0EA5E9">
            <div class="hub-icon">📡</div>
            <div>
              <h3>Record Attendance</h3>
              <p>Live check-in with Student ID or NFC. Shows student photo and status.</p>
            </div>
          </button>
          <button type="button" class="hub-card" data-mode="view" style="background:#6366F1">
            <div class="hub-icon">📋</div>
            <div>
              <h3>View Attendance Records</h3>
              <p>Browse and export attendance by subject and date.</p>
            </div>
          </button>
          <button type="button" class="hub-card" data-mode="excuse" style="background:#10B981">
            <div class="hub-icon">✓</div>
            <div>
              <h3>Excuse All Students</h3>
              <p>Mark all enrolled students Present for a selected subject and date.</p>
            </div>
          </button>
        </div>
      </div>`;
    container.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        render(container);
      });
    });
  }

  async function findStudent(code, students, enrolledIds) {
    const q = String(code || '').trim().toLowerCase();
    if (!q) return null;
    return students.find((s) => {
      const keys = [s.nfcNumber, s.studentId, s.studentNumber, s.id].map((x) => String(x || '').toLowerCase());
      return keys.includes(q) || keys.some((k) => k && k === q);
    }) || null;
  }

  async function renderRecord(container) {
    const ctx = await loadContext();
    const { activeSubjects, subject, students, enrolled } = ctx;
    const enrolledIds = new Set(enrolled.map((s) => s.id));

    container.innerHTML = `
      <div class="att-record-shell">
        <div class="att-record-top">
          ${subjectSelect(activeSubjects)}
          <button class="btn btn-secondary btn-sm" id="att-back">← Modes</button>
          <span class="text-muted" style="margin-left:auto;font-size:12px" id="att-clock-top"></span>
        </div>
        <div class="att-record-stage" id="att-stage">
          <div class="att-idle" id="att-idle">
            <h2>${escapeHtml(subject?.name || 'Select a subject')}</h2>
            <p class="text-muted" id="att-date-label"></p>
            <div class="att-clock" id="att-clock">--:--:--</div>
            <p style="font-weight:600;margin:12px 0 8px">Tap your Student ID</p>
            <div class="att-nfc-badge">NFC</div>
            <input id="att-scan" class="att-scan-input" autocomplete="off" autofocus placeholder="">
          </div>
          <div class="att-flash hidden" id="att-flash">
            <div class="att-photo-circle" id="att-photo"></div>
            <h2 id="att-msg"></h2>
            <p class="text-muted" id="att-submsg"></p>
          </div>
        </div>
      </div>`;

    function tick() {
      const now = new Date();
      const t = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
      const el = container.querySelector('#att-clock');
      const top = container.querySelector('#att-clock-top');
      if (el) el.textContent = t;
      if (top) top.textContent = now.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + t;
      const dl = container.querySelector('#att-date-label');
      if (dl) dl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    stopClock();
    tick();
    clockTimer = setInterval(tick, 1000);

    container.querySelector('#att-back').addEventListener('click', () => {
      mode = 'gateway';
      stopClock();
      render(container);
    });
    container.querySelector('#att-subject').addEventListener('change', (e) => {
      selectedSubjectId = +e.target.value || null;
      render(container);
    });

    const input = container.querySelector('#att-scan');
    input?.focus();
    input?.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const code = input.value;
      input.value = '';
      if (!code.trim()) return;
      if (!selectedSubjectId) {
        toast('Select a subject first', 'error');
        return;
      }
      const st = await findStudent(code, students, enrolledIds);
      if (!st) {
        toast('Student not found', 'error');
        return;
      }
      if (!enrolledIds.has(st.id)) {
        toast('You are not enrolled in this subject. Please see your instructor.', 'error');
        return;
      }

      // previous late/absent without excuse blocks Present? soft-check
      const attendance = await BCDB.getAll('attendance');
      const prior = attendance
        .filter((a) => a.studentId === st.id && String(a.subjectId) === String(selectedSubjectId) && a.classDate < selectedDate)
        .sort((a, b) => (b.classDate || '').localeCompare(a.classDate || ''))[0];
      if (prior && (prior.status === 'Late' || prior.status === 'Absent') && !prior.excuseSubmitted && !prior.instructorExcused) {
        toast(`Hi ${st.nickName || st.firstName}, you were ${prior.status.toLowerCase()} from a previous class. Please submit an excuse letter.`, 'error');
      }

      const now = new Date();
      const classDate = now.toISOString().slice(0, 10);
      const existing = attendance.find(
        (a) => a.studentId === st.id && a.classDate === classDate && String(a.subjectId) === String(selectedSubjectId)
      );
      if (existing && (existing.status === 'Present' || existing.status === 'Late')) {
        toast(`Already marked ${existing.status}`, 'error');
        showFlash(st, existing.status, existing);
        return;
      }

      // Late if 2+ minutes after hour :00 heuristic — use schedule if any
      let status = 'Present';
      const schedules = (await BCDB.getAll('schedules')).filter((x) => x.subjectId === selectedSubjectId);
      const dow = now.getDay();
      const sch = schedules.find((x) => Number(x.dayOfWeek) === dow);
      if (sch && sch.startTime) {
        const [hh, mm] = sch.startTime.split(':').map(Number);
        const start = new Date(now);
        start.setHours(hh || 0, mm || 0, 0, 0);
        const diffMin = (now - start) / 60000;
        if (diffMin >= 2) status = 'Late';
      }

      const record = {
        id: existing?.id || (await BCDB.nextId('attendance')),
        studentId: st.id,
        subjectId: selectedSubjectId,
        classDate,
        subject: subject?.name || subject?.code || '',
        status,
        notes: '',
        timeIn: now.toISOString(),
        markedAt: now.toISOString(),
        markedBy: 'teacher',
        excuseSubmitted: existing?.excuseSubmitted || false
      };
      await BCDB.put('attendance', record);
      if (window.Sync) Sync.queueChange('attendance', record);
      showFlash(st, status, record);
    });

    function showFlash(st, status, record) {
      const idle = container.querySelector('#att-idle');
      const flash = container.querySelector('#att-flash');
      const photo = container.querySelector('#att-photo');
      const msg = container.querySelector('#att-msg');
      const sub = container.querySelector('#att-submsg');
      idle?.classList.add('hidden');
      flash?.classList.remove('hidden');
      const nick = st.nickName || st.firstName || 'student';
      const ok = status === 'Present' || status === 'Late';
      msg.style.color = ok ? 'var(--success, #059669)' : 'var(--danger)';
      msg.textContent = status === 'Present'
        ? `Hi ${nick}, you are present!`
        : status === 'Late'
          ? `Hi ${nick}, you are late.`
          : `Hi ${nick}, marked ${status}.`;
      const tin = record.timeIn ? new Date(record.timeIn) : new Date();
      sub.innerHTML = `Welcome to ${escapeHtml(subject?.name || 'class')}!<br>Time-in: ${tin.toLocaleString()}`;
      if (st.photoDataUrl || st.photoPath) {
        photo.style.backgroundImage = `url('${(st.photoDataUrl || '').replace(/'/g, '')}')`;
        photo.textContent = '';
      } else {
        photo.style.backgroundImage = '';
        photo.textContent = (st.firstName || '?').charAt(0) + (st.lastName || '').charAt(0);
      }
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flash?.classList.add('hidden');
        idle?.classList.remove('hidden');
        container.querySelector('#att-scan')?.focus();
      }, 3500);
    }
  }

  async function renderView(container) {
    const ctx = await loadContext();
    const { activeSubjects, enrolled, attendance, subject } = ctx;
    const rows = attendance
      .filter((a) => String(a.subjectId) === String(selectedSubjectId) && a.classDate === selectedDate)
      .sort((a, b) => {
        const sa = enrolled.find((s) => s.id === a.studentId);
        const sb = enrolled.find((s) => s.id === b.studentId);
        return ((sa?.lastName || '')).localeCompare(sb?.lastName || '');
      });

    container.innerHTML = `
      <div class="toolbar">
        <button class="btn btn-secondary btn-sm" id="att-back">← Modes</button>
        ${subjectSelect(activeSubjects)}
        <label style="font-size:13px">Date <input type="date" id="att-date" value="${selectedDate}"></label>
        <div class="spacer"></div>
        <span class="text-muted">${rows.length} records</span>
      </div>
      <div class="card">
        <div class="card-title">Attendance · ${escapeHtml(subject?.code || '')} · ${selectedDate}</div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th></th><th>Student</th><th>Time-In</th><th>Status</th><th>Excuse</th></tr></thead>
            <tbody>
              ${rows.length === 0 ? '<tr><td colspan="5" class="text-muted">No records for this date.</td></tr>' :
                rows.map((a) => {
                  const s = enrolled.find((x) => x.id === a.studentId) || {};
                  const tin = a.timeIn ? new Date(a.timeIn).toLocaleTimeString() : '—';
                  return `<tr>
                    <td><div class="stu-avatar-sm" style="${s.photoDataUrl ? `background-image:url('${s.photoDataUrl}')` : ''}">${s.photoDataUrl ? '' : ((s.firstName||'?')[0]||'')}</div></td>
                    <td>${escapeHtml((s.lastName || '') + ', ' + (s.firstName || ''))}</td>
                    <td class="tabular-nums">${escapeHtml(tin)}</td>
                    <td>${escapeHtml(a.status || '')}</td>
                    <td>${a.excuseSubmitted ? 'Yes' : '—'}</td>
                  </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    container.querySelector('#att-back').addEventListener('click', () => { mode = 'gateway'; render(container); });
    container.querySelector('#att-subject').addEventListener('change', (e) => {
      selectedSubjectId = +e.target.value || null;
      render(container);
    });
    container.querySelector('#att-date').addEventListener('change', (e) => {
      selectedDate = e.target.value;
      render(container);
    });
  }

  async function renderExcuse(container) {
    const ctx = await loadContext();
    const { activeSubjects, subject, enrolled } = ctx;
    container.innerHTML = `
      <div class="card" style="max-width:420px;margin:40px auto">
        <div class="card-title">Excuse All – Select Subject</div>
        <button class="btn btn-secondary btn-sm" id="att-back" style="margin-bottom:12px">← Modes</button>
        <label style="display:block;margin-bottom:10px;font-size:13px">Subject
          <select id="att-subject" style="width:100%;margin-top:4px">
            ${activeSubjects.map((s) =>
              `<option value="${s.id}" ${s.id === selectedSubjectId ? 'selected' : ''}>${escapeHtml((s.code || '') + ' – ' + (s.name || ''))}</option>`
            ).join('')}
          </select>
        </label>
        <label style="display:block;margin-bottom:14px;font-size:13px">Date (one day at a time)
          <input type="date" id="att-date" value="${selectedDate}" style="width:100%;margin-top:4px">
        </label>
        <button class="btn btn-primary" id="att-excuse-all" style="width:100%;background:#10B981;border-color:#10B981">Mark All Present</button>
        <p class="text-muted" style="margin-top:10px;font-size:12px">${enrolled.length} enrolled in selected subject</p>
      </div>`;
    container.querySelector('#att-back').addEventListener('click', () => { mode = 'gateway'; render(container); });
    container.querySelector('#att-subject').addEventListener('change', (e) => {
      selectedSubjectId = +e.target.value || null;
      render(container);
    });
    container.querySelector('#att-date').addEventListener('change', (e) => {
      selectedDate = e.target.value;
    });
    container.querySelector('#att-excuse-all').addEventListener('click', async () => {
      if (!selectedSubjectId) return;
      if (!confirm(`Mark all ${enrolled.length} enrolled students Present for ${selectedDate}?`)) return;
      for (const s of enrolled) {
        const attendance = await BCDB.getAll('attendance');
        const existing = attendance.find(
          (a) => a.studentId === s.id && a.classDate === selectedDate && String(a.subjectId) === String(selectedSubjectId)
        );
        const record = {
          id: existing?.id || (await BCDB.nextId('attendance')),
          studentId: s.id,
          subjectId: selectedSubjectId,
          classDate: selectedDate,
          subject: subject?.name || '',
          status: 'Present',
          instructorExcused: true,
          notes: existing?.notes || 'Excuse All',
          markedAt: new Date().toISOString(),
          markedBy: 'excuse-all'
        };
        await BCDB.put('attendance', record);
        if (window.Sync) Sync.queueChange('attendance', record);
      }
      toast('All enrolled students marked Present', 'success');
    });
  }

  async function render(container) {
    if (mode === 'gateway') return renderGateway(container);
    if (mode === 'record') return renderRecord(container);
    if (mode === 'view') return renderView(container);
    if (mode === 'excuse') return renderExcuse(container);
    mode = 'gateway';
    return renderGateway(container);
  }

  return { render };
})();
