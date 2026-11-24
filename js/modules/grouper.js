/**
 * Random Grouper — form groups, optional leaders, save shared sets
 */
const GrouperModule = (() => {
  let subjectId = null;
  let groupCount = 6;
  let useLeaders = true;
  let leaders = []; // student ids
  let groups = []; // array of arrays of student ids
  let available = [];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formGroups(enrolled) {
    const leaderSet = new Set(useLeaders ? leaders : []);
    const pool = shuffle(enrolled.map((s) => s.id).filter((id) => !leaderSet.has(id)));
    groups = Array.from({ length: groupCount }, () => []);

    // place leaders first
    if (useLeaders) {
      leaders.slice(0, groupCount).forEach((id, i) => groups[i].push(id));
    }
    // distribute rest
    let gi = 0;
    pool.forEach((id) => {
      groups[gi % groupCount].push(id);
      gi++;
    });
  }

  async function render(container) {
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    if (!subjectId && subjects.length) subjectId = subjects[0].id;

    const enrollments = await BCDB.getAll('enrollments');
    const students = await BCDB.getAll('students');
    const enrolledIds = enrollments.filter((e) => e.subjectId === subjectId).map((e) => e.studentId);
    let enrolled = students.filter((s) => enrolledIds.includes(s.id) && s.isActive !== false);
    enrolled.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));

    const nameOf = (id) => {
      const s = students.find((x) => x.id === id);
      return s ? StudentsModule.fullName(s) : '—';
    };

    const leaderSet = new Set(leaders);
    available = enrolled.filter((s) => !leaderSet.has(s.id));

    const sizes = groups.map((g) => g.length);
    const bal = sizes.length ? `Sizes: ${sizes.join(', ')}` : '';

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:180px">
          <label>Subject</label>
          <select id="grp-subject">
            ${subjects.map((s) => `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('') || '<option>No subjects</option>'}
          </select>
        </div>
        <div class="form-group" style="margin:0;width:80px">
          <label>Groups</label>
          <input type="number" id="grp-count" min="1" max="40" value="${groupCount}">
        </div>
        <label class="flex" style="font-size:13px;font-weight:500;cursor:pointer;margin-top:18px">
          <input type="checkbox" id="grp-leaders" ${useLeaders ? 'checked' : ''}> Leaders first
        </label>
        <button class="btn btn-primary" id="grp-form">Form Groups</button>
        <button class="btn btn-secondary" id="grp-clear">Clear</button>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="grp-save">Save set</button>
        <button class="btn btn-secondary" id="grp-load">Load set</button>
      </div>
      <p class="text-muted" style="margin-bottom:12px">${bal || 'Pick leaders (optional), then Form Groups.'}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:14px">
        <div class="card">
          <div class="card-title">Available (${available.length})</div>
          <div style="max-height:360px;overflow:auto;display:flex;flex-direction:column;gap:4px">
            ${available.map((s) => `
              <button class="btn btn-sm btn-secondary make-leader" data-id="${s.id}" style="justify-content:flex-start">
                ${escapeHtml(StudentsModule.fullName(s))}
              </button>
            `).join('') || '<p class="text-muted">—</p>'}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Leaders (${leaders.length})</div>
          <div style="max-height:360px;overflow:auto;display:flex;flex-direction:column;gap:4px">
            ${leaders.map((id) => `
              <button class="btn btn-sm btn-secondary rem-leader" data-id="${id}" style="justify-content:flex-start">
                ★ ${escapeHtml(nameOf(id))}
              </button>
            `).join('') || '<p class="text-muted">Click a student to assign as leader</p>'}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Groups result</div>
          <div style="max-height:400px;overflow:auto;display:flex;flex-direction:column;gap:10px">
            ${groups.length === 0 ? '<p class="text-muted">No groups yet</p>' : groups.map((g, i) => `
              <div style="border:1px solid var(--border);border-radius:8px;padding:10px">
                <strong>Group ${i + 1}</strong> <span class="text-muted">(${g.length})</span>
                <ul style="margin:6px 0 0 16px;font-size:13px">
                  ${g.map((id, j) => `<li>${j === 0 && useLeaders && leaders.includes(id) ? '★ ' : ''}${escapeHtml(nameOf(id))}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.querySelector('#grp-subject').addEventListener('change', (e) => {
      subjectId = +e.target.value || null;
      leaders = [];
      groups = [];
      render(container);
    });
    container.querySelector('#grp-count').addEventListener('change', (e) => {
      groupCount = Math.max(1, Math.min(40, +e.target.value || 6));
    });
    container.querySelector('#grp-leaders').addEventListener('change', (e) => {
      useLeaders = e.target.checked;
    });
    container.querySelector('#grp-form').addEventListener('click', () => {
      groupCount = Math.max(1, Math.min(40, +container.querySelector('#grp-count').value || 6));
      useLeaders = container.querySelector('#grp-leaders').checked;
      formGroups(enrolled);
      render(container);
      toast('Groups formed', 'success');
    });
    container.querySelector('#grp-clear').addEventListener('click', () => {
      leaders = [];
      groups = [];
      render(container);
    });
    container.querySelectorAll('.make-leader').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = +btn.dataset.id;
        if (!leaders.includes(id)) leaders.push(id);
        render(container);
      });
    });
    container.querySelectorAll('.rem-leader').forEach((btn) => {
      btn.addEventListener('click', () => {
        leaders = leaders.filter((x) => x !== +btn.dataset.id);
        render(container);
      });
    });

    container.querySelector('#grp-save').addEventListener('click', async () => {
      if (!groups.length) { toast('Form groups first', 'error'); return; }
      const name = prompt('Name for this group set:', 'Groups ' + new Date().toLocaleDateString());
      if (!name) return;
      const set = {
        id: await BCDB.nextId('groupSets'),
        name,
        subjectId,
        groups: groups.map((g, i) => ({
          name: 'Group ' + (i + 1),
          memberIds: g.slice()
        })),
        createdAt: new Date().toISOString()
      };
      await BCDB.put('groupSets', set);
      Sync.queueChange('groupSets', set);
      toast('Group set saved', 'success');
    });

    container.querySelector('#grp-load').addEventListener('click', async () => {
      const sets = await BCDB.getAll('groupSets');
      if (!sets.length) { toast('No saved sets', 'error'); return; }
      const list = sets.map((s) => `${s.id}: ${s.name}`).join('\n');
      const pick = prompt('Enter set ID to load:\n' + list);
      if (!pick) return;
      const set = sets.find((s) => s.id === +pick);
      if (!set) { toast('Not found', 'error'); return; }
      subjectId = set.subjectId || subjectId;
      groups = set.groups.map((g) => g.memberIds || []);
      leaders = groups.map((g) => g[0]).filter(Boolean);
      groupCount = groups.length;
      render(container);
      toast('Loaded ' + set.name, 'success');
    });
  }

  return { render };
})();
