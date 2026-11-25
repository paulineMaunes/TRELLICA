/**
 * Attendance recording module
 * Statuses: Present, Late, Absent, Excuse
 */
const AttendanceModule = (() => {

  async function enrolledStudentIds(subjectId) {
    const enrollments = await BCDB.getAll('enrollments');
    return new Set(
      enrollments
        .filter((e) => String(e.subjectId) === String(subjectId) && e.isActive !== false)
        .map((e) => e.studentId)
    );
  }

  async function previousMeetingIssue(studentId, subjectId, classDate) {
    const rows = await BCDB.getAll('attendance');
    const prior = rows
      .filter((a) => a.studentId === studentId && String(a.subjectId) === String(subjectId) && a.classDate < classDate)
      .sort((a, b) => (b.classDate || '').localeCompare(a.classDate || ''));
    const last = prior[0];
    if (!last) return null;
    if ((last.status === 'Late' || last.status === 'Absent') && !last.excuseSubmitted && !last.instructorExcused) {
      return last;
    }
    return null;
  }


  let selectedSubjectId = null;
  let selectedDate = todayStr();

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  async function render(container) {
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    if (!selectedSubjectId && subjects.length) selectedSubjectId = subjects[0].id;

    const subject = subjects.find((s) => s.id === selectedSubjectId);
    const enrollments = await BCDB.getAll('enrollments');
    const students = await BCDB.getAll('students');
    const attendance = await BCDB.getAll('attendance');

    const enrolledStudentIds = enrollments
      .filter((e) => e.subjectId === selectedSubjectId)
      .map((e) => e.studentId);

    let enrolled = students.filter((s) => enrolledStudentIds.includes(s.id) && s.isActive !== false);
    enrolled.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));

    const byStudent = {};
    attendance
      .filter((a) => a.classDate === selectedDate && a.subject === (subject?.name || subject?.code || ''))
      .forEach((a) => { byStudent[a.studentId] = a; });

    // Also match by subjectId if stored
    attendance
      .filter((a) => a.classDate === selectedDate && a.subjectId === selectedSubjectId)
      .forEach((a) => { byStudent[a.studentId] = a; });

    const counts = { Present: 0, Late: 0, Absent: 0, Excuse: 0, Unmarked: 0 };
    enrolled.forEach((s) => {
      const st = byStudent[s.id]?.status;
      if (st && counts[st] !== undefined) counts[st]++;
      else counts.Unmarked++;
    });

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:200px">
          <label>Subject</label>
          <select id="att-subject">
            ${subjects.length === 0 ? '<option value="">No subjects</option>' :
              subjects.map((s) => `<option value="${s.id}" ${s.id === selectedSubjectId ? 'selected' : ''}>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Date</label>
          <input type="date" id="att-date" value="${selectedDate}">
        </div>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="att-all-present" ${!selectedSubjectId ? 'disabled' : ''}>Mark all Present</button>
        <button class="btn btn-secondary" id="att-all-absent" ${!selectedSubjectId ? 'disabled' : ''}>Mark all Absent</button>
      </div>

      <div class="flex flex-wrap" style="margin-bottom:16px;gap:12px">
        <span class="badge badge-present">Present ${counts.Present}</span>
        <span class="badge badge-late">Late ${counts.Late}</span>
        <span class="badge badge-absent">Absent ${counts.Absent}</span>
        <span class="badge badge-excuse">Excuse ${counts.Excuse}</span>
        <span class="badge badge-inactive">Unmarked ${counts.Unmarked}</span>
      </div>

      ${!selectedSubjectId ? `
        <div class="card"><div class="empty"><div class="big">📋</div><p>Create a subject and enroll students first.</p></div></div>
      ` : enrolled.length === 0 ? `
        <div class="card"><div class="empty"><div class="big">👥</div><p>No students enrolled in this subject. Use Students → Enroll.</p></div></div>
      ` : `
        <div class="att-grid">
          ${enrolled.map((s) => {
            const rec = byStudent[s.id];
            const status = rec?.status || '';
            const cls = status ? status.toLowerCase() : '';
            return `
              <div class="att-card ${cls}" data-id="${s.id}">
                <div class="name">${escapeHtml(StudentsModule.fullName(s))}</div>
                <div class="meta">${escapeHtml(s.course || '')} ${s.nickName ? '· ' + escapeHtml(s.nickName) : ''}</div>
                <div class="mt-8">
                  ${status ? `<span class="badge badge-${status.toLowerCase()}">${status}</span>` : '<span class="text-muted">Not marked</span>'}
                </div>
                <div class="flex mt-8" style="gap:4px;flex-wrap:wrap">
                  <button class="btn btn-sm btn-success att-set" data-status="Present" data-id="${s.id}">P</button>
                  <button class="btn btn-sm btn-secondary att-set" data-status="Late" data-id="${s.id}" style="background:#fef3c7">L</button>
                  <button class="btn btn-sm btn-danger att-set" data-status="Absent" data-id="${s.id}">A</button>
                  <button class="btn btn-sm btn-secondary att-set" data-status="Excuse" data-id="${s.id}" style="background:#e0e7ff">E</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;

    container.querySelector('#att-subject').addEventListener('change', (e) => {
      selectedSubjectId = +e.target.value || null;
      render(container);
    });
    container.querySelector('#att-date').addEventListener('change', (e) => {
      selectedDate = e.target.value;
      render(container);
    });

    async function setStatus(studentId, status) {
      const subjectName = subject?.name || subject?.code || '';
      const existing = Object.values(byStudent).find((a) => a.studentId === studentId) ||
        attendance.find((a) => a.studentId === studentId && a.classDate === selectedDate && (a.subjectId === selectedSubjectId || a.subject === subjectName));

      const record = {
        id: existing?.id || await BCDB.nextId('attendance'),
        studentId,
        subjectId: selectedSubjectId,
        classDate: selectedDate,
        subject: subjectName,
        status,
        notes: existing?.notes || '',
        excuseFilePath: existing?.excuseFilePath || '',
        markedAt: new Date().toISOString(),
        markedBy: 'teacher'
      };
      await BCDB.put('attendance', record);
      Sync.queueChange('attendance', record);
      render(container);
    }

    container.querySelectorAll('.att-set').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setStatus(+btn.dataset.id, btn.dataset.status);
      });
    });

    container.querySelector('#att-all-present')?.addEventListener('click', async () => {
      if (!confirm('Mark all enrolled students Present for this date?')) return;
      for (const s of enrolled) await setStatus(s.id, 'Present');
      toast('All marked Present', 'success');
    });
    container.querySelector('#att-all-absent')?.addEventListener('click', async () => {
      if (!confirm('Mark all enrolled students Absent for this date?')) return;
      for (const s of enrolled) await setStatus(s.id, 'Absent');
      toast('All marked Absent', 'success');
    });
  }

  return { render };
})();
