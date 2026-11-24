/**
 * Subject + Schedule management
 */
const SubjectsModule = (() => {
  async function render(container) {
    const subjects = await BCDB.getAll('subjects');
    subjects.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    const schedules = await BCDB.getAll('schedules');
    const enrollments = await BCDB.getAll('enrollments');

    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="sub-add">+ Add Subject</button>
      </div>
      <div class="card">
        <div class="card-title"><span>Subjects (${subjects.length})</span></div>
        <div class="table-wrap">
          ${subjects.length === 0 ? `
            <div class="empty"><div class="big">📚</div><p>No subjects yet. Add a subject to start enrollment and attendance.</p></div>
          ` : `
            <table class="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Semester</th>
                  <th>Year</th>
                  <th>Set</th>
                  <th>Schedule</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${subjects.map((s) => {
                  const sch = schedules.filter((x) => x.subjectId === s.id);
                  const enr = enrollments.filter((x) => x.subjectId === s.id).length;
                  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                  const schText = sch.map((x) => `${days[x.dayOfWeek] || x.dayOfWeek} ${x.startTime||''}–${x.endTime||''}`).join(', ') || '—';
                  return `
                    <tr class="${s.isActive === false ? 'inactive' : ''}">
                      <td><strong>${escapeHtml(s.code || '')}</strong></td>
                      <td>${escapeHtml(s.name || '')}</td>
                      <td>${escapeHtml(s.semester || '—')}</td>
                      <td>${escapeHtml(s.academicYear || '—')}</td>
                      <td>${escapeHtml(s.classSet || '—')}</td>
                      <td style="font-size:12px">${escapeHtml(schText)}</td>
                      <td>${enr}</td>
                      <td>${s.isActive === false ? '<span class="badge badge-inactive">Inactive</span>' : '<span class="badge badge-active">Active</span>'}</td>
                      <td>
                        <button class="btn btn-sm btn-secondary sub-edit" data-id="${s.id}">Edit</button>
                        <button class="btn btn-sm btn-secondary sub-sched" data-id="${s.id}">Schedule</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

    container.querySelector('#sub-add').addEventListener('click', () => openForm(null, container));
    container.querySelectorAll('.sub-edit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        openForm(await BCDB.getById('subjects', +btn.dataset.id), container);
      });
    });
    container.querySelectorAll('.sub-sched').forEach((btn) => {
      btn.addEventListener('click', async () => {
        openSchedule(await BCDB.getById('subjects', +btn.dataset.id), container);
      });
    });
  }

  function openForm(subject, container) {
    const isNew = !subject;
    const s = subject || { code: '', name: '', semester: '1st', academicYear: '2026-2027', classSet: 'All', isActive: true };

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>${isNew ? 'Add Subject' : 'Edit Subject'}</h2>
          <button class="btn-icon modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Code *</label><input id="f-code" value="${escapeAttr(s.code)}" placeholder="e.g. IT101"></div>
            <div class="form-group"><label>Name *</label><input id="f-name" value="${escapeAttr(s.name)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Semester</label>
              <select id="f-sem">
                <option ${s.semester === '1st' ? 'selected' : ''}>1st</option>
                <option ${s.semester === '2nd' ? 'selected' : ''}>2nd</option>
                <option ${s.semester === 'Summer' ? 'selected' : ''}>Summer</option>
              </select>
            </div>
            <div class="form-group"><label>Academic Year</label><input id="f-year" value="${escapeAttr(s.academicYear)}" placeholder="2026-2027"></div>
            <div class="form-group"><label>Class Set</label>
              <select id="f-set">
                <option ${s.classSet === 'All' ? 'selected' : ''}>All</option>
                <option ${s.classSet === 'Set A' ? 'selected' : ''}>Set A</option>
                <option ${s.classSet === 'Set B' ? 'selected' : ''}>Set B</option>
              </select>
            </div>
          </div>
          ${!isNew ? `
            <div class="form-row">
              <div class="form-group"><label>Status</label>
                <select id="f-active">
                  <option value="1" ${s.isActive !== false ? 'selected' : ''}>Active</option>
                  <option value="0" ${s.isActive === false ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          ${!isNew ? '<button class="btn btn-danger" id="f-delete">Delete</button>' : ''}
          <div style="flex:1"></div>
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="f-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));

    backdrop.querySelector('#f-save').addEventListener('click', async () => {
      const code = backdrop.querySelector('#f-code').value.trim();
      const name = backdrop.querySelector('#f-name').value.trim();
      if (!code || !name) { toast('Code and name are required', 'error'); return; }
      const record = {
        id: isNew ? await BCDB.nextId('subjects') : s.id,
        code, name,
        semester: backdrop.querySelector('#f-sem').value,
        academicYear: backdrop.querySelector('#f-year').value.trim(),
        classSet: backdrop.querySelector('#f-set').value,
        isActive: isNew ? true : backdrop.querySelector('#f-active').value === '1'
      };
      await BCDB.put('subjects', record);
      toast(isNew ? 'Subject added' : 'Subject updated', 'success');
      close();
      render(container);
      Sync.queueChange('subjects', record);
    });

    if (!isNew) {
      backdrop.querySelector('#f-delete').addEventListener('click', async () => {
        if (!confirm(`Delete subject ${s.code}? Enrollments and schedules will also be removed.`)) return;
        const enrs = await BCDB.getAll('enrollments');
        for (const e of enrs.filter((x) => x.subjectId === s.id)) await BCDB.remove('enrollments', e.id);
        const sch = await BCDB.getAll('schedules');
        for (const x of sch.filter((x) => x.subjectId === s.id)) await BCDB.remove('schedules', x.id);
        await BCDB.remove('subjects', s.id);
        toast('Subject deleted', 'success');
        close();
        render(container);
      });
    }
  }

  async function openSchedule(subject, container) {
    let schedules = (await BCDB.getAll('schedules')).filter((x) => x.subjectId === subject.id);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    function paint() {
      backdrop.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2>Schedule — ${escapeHtml(subject.code)}</h2>
            <button class="btn-icon modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div id="sch-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
              ${schedules.length === 0 ? '<p class="text-muted">No schedule slots yet.</p>' : schedules.map((x) => `
                <div class="flex" style="padding:10px;border:1px solid var(--border);border-radius:8px">
                  <span style="flex:1">${days[x.dayOfWeek]} ${x.startTime || ''} – ${x.endTime || ''} ${x.room ? '· ' + escapeHtml(x.room) : ''}</span>
                  <button class="btn btn-sm btn-danger sch-del" data-id="${x.id}">Remove</button>
                </div>
              `).join('')}
            </div>
            <div class="card-title">Add slot</div>
            <div class="form-row">
              <div class="form-group"><label>Day</label>
                <select id="sch-day">
                  ${days.map((d, i) => `<option value="${i}">${d}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Start</label><input id="sch-start" type="time" value="08:00"></div>
              <div class="form-group"><label>End</label><input id="sch-end" type="time" value="09:30"></div>
              <div class="form-group"><label>Room</label><input id="sch-room" placeholder="optional"></div>
            </div>
            <button class="btn btn-secondary" id="sch-add">+ Add Slot</button>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary modal-close">Done</button>
          </div>
        </div>
      `;
      backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', () => { backdrop.remove(); render(container); }));
      backdrop.querySelector('#sch-add').addEventListener('click', async () => {
        const id = await BCDB.nextId('schedules');
        const slot = {
          id,
          subjectId: subject.id,
          dayOfWeek: +backdrop.querySelector('#sch-day').value,
          startTime: backdrop.querySelector('#sch-start').value,
          endTime: backdrop.querySelector('#sch-end').value,
          room: backdrop.querySelector('#sch-room').value.trim()
        };
        await BCDB.put('schedules', slot);
        schedules.push(slot);
        toast('Slot added', 'success');
        paint();
      });
      backdrop.querySelectorAll('.sch-del').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await BCDB.remove('schedules', +btn.dataset.id);
          schedules = schedules.filter((x) => x.id !== +btn.dataset.id);
          paint();
        });
      });
    }
    document.body.appendChild(backdrop);
    paint();
  }

  return { render };
})();
