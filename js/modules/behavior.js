/**
 * Behavior log — positive / concern notes per student
 */
const BehaviorModule = (() => {
  let filterStudent = '';

  async function render(container) {
    const logs = (await BCDB.getAll('behavior')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const students = (await BCDB.getAll('students')).filter((s) => s.isActive !== false);
    students.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));
    const nameOf = (id) => {
      const s = students.find((x) => x.id === id);
      return s ? StudentsModule.fullName(s) : '#' + id;
    };

    let list = logs;
    if (filterStudent) list = list.filter((l) => l.studentId === +filterStudent);

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:200px">
          <label>Filter student</label>
          <select id="bh-filter">
            <option value="">All students</option>
            ${students.map((s) => `<option value="${s.id}" ${filterStudent == s.id ? 'selected' : ''}>${escapeHtml(StudentsModule.fullName(s))}</option>`).join('')}
          </select>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="bh-add">+ Log entry</button>
      </div>
      <div class="card">
        <div class="card-title">Behavior log (${list.length})</div>
        ${list.length === 0 ? '<div class="empty"><div class="big">✎</div><p>No entries yet</p></div>' : `
          <table class="data">
            <thead><tr><th>Date</th><th>Student</th><th>Type</th><th>Note</th><th></th></tr></thead>
            <tbody>
              ${list.map((l) => `
                <tr>
                  <td>${escapeHtml(l.date || '')}</td>
                  <td>${escapeHtml(nameOf(l.studentId))}</td>
                  <td><span class="badge ${l.type === 'Positive' ? 'badge-present' : l.type === 'Concern' ? 'badge-absent' : 'badge-late'}">${escapeHtml(l.type || '')}</span></td>
                  <td>${escapeHtml(l.note || '')}</td>
                  <td><button class="btn btn-sm btn-danger bh-del" data-id="${l.id}">Del</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;

    container.querySelector('#bh-filter').addEventListener('change', (e) => {
      filterStudent = e.target.value;
      render(container);
    });
    container.querySelector('#bh-add').addEventListener('click', () => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal">
          <div class="modal-header"><h2>Behavior entry</h2><button class="btn-icon modal-close">✕</button></div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group"><label>Student</label>
                <select id="bh-stu">${students.map((s) => `<option value="${s.id}">${escapeHtml(StudentsModule.fullName(s))}</option>`).join('')}</select>
              </div>
              <div class="form-group"><label>Type</label>
                <select id="bh-type"><option>Positive</option><option>Neutral</option><option>Concern</option></select>
              </div>
              <div class="form-group"><label>Date</label><input type="date" id="bh-date" value="${new Date().toISOString().slice(0, 10)}"></div>
            </div>
            <div class="form-row">
              <div class="form-group" style="grid-column:1/-1"><label>Note *</label><textarea id="bh-note" rows="3"></textarea></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary modal-close">Cancel</button>
            <button class="btn btn-primary" id="bh-save">Save</button>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
      const close = () => backdrop.remove();
      backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));
      backdrop.querySelector('#bh-save').addEventListener('click', async () => {
        const note = backdrop.querySelector('#bh-note').value.trim();
        if (!note) { toast('Note required', 'error'); return; }
        const rec = {
          id: await BCDB.nextId('behavior'),
          studentId: +backdrop.querySelector('#bh-stu').value,
          type: backdrop.querySelector('#bh-type').value,
          date: backdrop.querySelector('#bh-date').value,
          note,
          createdAt: new Date().toISOString()
        };
        await BCDB.put('behavior', rec);
        Sync.queueChange('behavior', rec);
        toast('Logged', 'success');
        close();
        render(container);
      });
    });
    container.querySelectorAll('.bh-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete entry?')) return;
        await BCDB.remove('behavior', +btn.dataset.id);
        render(container);
      });
    });
  }

  return { render };
})();
