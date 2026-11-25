/** Class officers — assign roles per subject */
const OfficersModule = (() => {
  const ROLES = ['President', 'Vice President', 'Secretary', 'Treasurer', 'PIO', 'Sergeant at Arms'];
  let subjectId = null;

  async function render(container) {
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    if (!subjectId && subjects.length) subjectId = subjects[0].id;
    const all = await BCDB.getAll('settings');
    let pack = all.find((x) => x.key === 'officers') || { id: 99, key: 'officers', bySubject: {} };
    if (!pack.bySubject) pack.bySubject = {};
    const map = pack.bySubject[subjectId] || {};

    const enrollments = await BCDB.getAll('enrollments');
    const students = await BCDB.getAll('students');
    const ids = enrollments.filter((e) => e.subjectId === subjectId).map((e) => e.studentId);
    let enrolled = students.filter((s) => ids.includes(s.id) && s.isActive !== false);
    enrolled.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:200px">
          <label>Subject</label>
          <select id="off-sub">${subjects.map((s) => `<option value="${s.id}" ${s.id===subjectId?'selected':''}>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('') || '<option>None</option>'}</select>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="off-save">Save Officers</button>
      </div>
      <div class="card">
        <div class="card-title">Class officers</div>
        ${ROLES.map((role) => `
          <div class="form-row">
            <div class="form-group">
              <label>${role}</label>
              <select class="off-role" data-role="${role}">
                <option value="">—</option>
                ${enrolled.map((s) => `<option value="${s.id}" ${String(map[role])===String(s.id)?'selected':''}>${escapeHtml(StudentsModule.fullName(s))}</option>`).join('')}
              </select>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    container.querySelector('#off-sub').addEventListener('change', (e) => { subjectId = +e.target.value; render(container); });
    container.querySelector('#off-save').addEventListener('click', async () => {
      const next = {};
      container.querySelectorAll('.off-role').forEach((sel) => {
        if (sel.value) next[sel.dataset.role] = +sel.value;
      });
      pack.bySubject[subjectId] = next;
      await BCDB.put('settings', pack);
      toast('Officers saved', 'success');
    });
  }
  return { render };
})();
