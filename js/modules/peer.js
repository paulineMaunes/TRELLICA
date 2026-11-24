/**
 * Peer Evaluation — local sessions & ratings (no Google Forms dependency)
 * Criteria: 8 default 1–5 scores + strongest / improve comments
 */
const PeerModule = (() => {
  const DEFAULT_CRITERIA = [
    'Contribution to group work',
    'Reliability / meets deadlines',
    'Communication',
    'Quality of work',
    'Collaboration / teamwork',
    'Initiative',
    'Respect for others',
    'Overall performance'
  ];

  async function render(container) {
    const sessions = (await BCDB.getAll('peerSessions')).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const ratings = await BCDB.getAll('peerRatings');
    const students = await BCDB.getAll('students');
    const nameOf = (id) => {
      const s = students.find((x) => x.id === id);
      return s ? StudentsModule.fullName(s) : '#' + id;
    };

    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="peer-new">+ New Session</button>
      </div>
      <div class="card">
        <div class="card-title">Peer evaluation sessions</div>
        ${sessions.length === 0 ? '<div class="empty"><div class="big">◎</div><p>No sessions yet. Create one for a group project.</p></div>' : `
          <table class="data">
            <thead><tr><th>Title</th><th>Subject</th><th>Members</th><th>Ratings</th><th>Created</th><th></th></tr></thead>
            <tbody>
              ${sessions.map((s) => {
                const rc = ratings.filter((r) => r.sessionId === s.id).length;
                return `<tr>
                  <td><strong>${escapeHtml(s.title)}</strong></td>
                  <td>${escapeHtml(s.subjectName || '—')}</td>
                  <td>${(s.memberIds || []).length}</td>
                  <td>${rc}</td>
                  <td>${escapeHtml((s.createdAt || '').slice(0, 10))}</td>
                  <td>
                    <button class="btn btn-sm btn-primary peer-rate" data-id="${s.id}">Rate</button>
                    <button class="btn btn-sm btn-secondary peer-results" data-id="${s.id}">Results</button>
                    <button class="btn btn-sm btn-danger peer-del" data-id="${s.id}">Del</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;

    container.querySelector('#peer-new').addEventListener('click', () => openSession(container));
    container.querySelectorAll('.peer-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete session and its ratings?')) return;
        const sid = btn.dataset.id;
        const allR = await BCDB.getAll('peerRatings');
        for (const r of allR.filter((x) => x.sessionId === sid)) await BCDB.remove('peerRatings', r.id);
        await BCDB.remove('peerSessions', +sid);
        render(container);
      });
    });
    container.querySelectorAll('.peer-rate').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const s = await BCDB.getById('peerSessions', +btn.dataset.id);
        openRate(s, container);
      });
    });
    container.querySelectorAll('.peer-results').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const s = await BCDB.getById('peerSessions', +btn.dataset.id);
        openResults(s, container);
      });
    });
  }

  async function openSession(container) {
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    const groupSets = await BCDB.getAll('groupSets');
    const students = (await BCDB.getAll('students')).filter((s) => s.isActive !== false);
    students.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header"><h2>New Peer Session</h2><button class="btn-icon modal-close">✕</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Title *</label><input id="ps-title" placeholder="e.g. Project 1 Peer Eval"></div>
            <div class="form-group"><label>Subject</label>
              <select id="ps-sub"><option value="">—</option>${subjects.map((s) => `<option value="${escapeAttr(s.name)}">${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('')}</select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="grid-column:1/-1"><label>Load members from group set (optional)</label>
              <select id="ps-gset"><option value="">— manual select —</option>
                ${groupSets.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="card-title">Members</div>
          <div id="ps-members" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;max-height:240px;overflow:auto">
            ${students.map((s) => `
              <label class="flex" style="font-size:13px;cursor:pointer">
                <input type="checkbox" class="ps-mem" value="${s.id}"> ${escapeHtml(StudentsModule.fullName(s))}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="ps-save">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));

    backdrop.querySelector('#ps-gset').addEventListener('change', async (e) => {
      const set = await BCDB.getById('groupSets', +e.target.value);
      backdrop.querySelectorAll('.ps-mem').forEach((cb) => { cb.checked = false; });
      if (!set) return;
      const ids = new Set();
      (set.groups || []).forEach((g) => (g.memberIds || []).forEach((id) => ids.add(id)));
      backdrop.querySelectorAll('.ps-mem').forEach((cb) => {
        if (ids.has(+cb.value)) cb.checked = true;
      });
    });

    backdrop.querySelector('#ps-save').addEventListener('click', async () => {
      const title = backdrop.querySelector('#ps-title').value.trim();
      if (!title) { toast('Title required', 'error'); return; }
      const memberIds = [...backdrop.querySelectorAll('.ps-mem:checked')].map((c) => +c.value);
      if (memberIds.length < 2) { toast('Select at least 2 members', 'error'); return; }
      const rec = {
        id: await BCDB.nextId('peerSessions'),
        title,
        subjectName: backdrop.querySelector('#ps-sub').value,
        memberIds,
        criteria: DEFAULT_CRITERIA.slice(),
        createdAt: new Date().toISOString()
      };
      await BCDB.put('peerSessions', rec);
      Sync.queueChange('peerSessions', rec);
      toast('Session created', 'success');
      close();
      render(container);
    });
  }

  async function openRate(session, container) {
    if (!session) return;
    const students = await BCDB.getAll('students');
    const nameOf = (id) => {
      const s = students.find((x) => x.id === id);
      return s ? StudentsModule.fullName(s) : '#' + id;
    };
    const members = session.memberIds || [];
    const criteria = session.criteria || DEFAULT_CRITERIA;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header"><h2>Rate — ${escapeHtml(session.title)}</h2><button class="btn-icon modal-close">✕</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Rater</label>
              <select id="pr-rater">${members.map((id) => `<option value="${id}">${escapeHtml(nameOf(id))}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Evaluatee</label>
              <select id="pr-eval">${members.map((id) => `<option value="${id}">${escapeHtml(nameOf(id))}</option>`).join('')}</select>
            </div>
          </div>
          <div class="card-title">Scores (1–5)</div>
          ${criteria.map((c, i) => `
            <div class="flex" style="margin-bottom:8px">
              <label style="flex:1;margin:0;font-weight:500;font-size:13px">${escapeHtml(c)}</label>
              <input type="number" class="pr-score" data-i="${i}" min="1" max="5" value="3" style="width:70px">
            </div>
          `).join('')}
          <div class="form-row mt-16">
            <div class="form-group"><label>Strongest point</label><input id="pr-strong"></div>
            <div class="form-group"><label>Needs improvement</label><input id="pr-improve"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="pr-save">Save Rating</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));
    backdrop.querySelector('#pr-save').addEventListener('click', async () => {
      const raterId = +backdrop.querySelector('#pr-rater').value;
      const evaluateeId = +backdrop.querySelector('#pr-eval').value;
      if (raterId === evaluateeId) { toast('Rater and evaluatee should differ', 'error'); return; }
      const scores = [...backdrop.querySelectorAll('.pr-score')].map((i) => parseInt(i.value, 10) || 0);
      const total = scores.reduce((a, b) => a + b, 0);
      const rec = {
        id: await BCDB.nextId('peerRatings'),
        sessionId: session.id,
        raterId,
        raterName: nameOf(raterId),
        evaluateeId,
        evaluateeName: nameOf(evaluateeId),
        scores,
        strongest: backdrop.querySelector('#pr-strong').value.trim(),
        improve: backdrop.querySelector('#pr-improve').value.trim(),
        total,
        submittedAt: new Date().toISOString()
      };
      await BCDB.put('peerRatings', rec);
      Sync.queueChange('peerRatings', rec);
      toast('Rating saved (total ' + total + ')', 'success');
      close();
    });
  }

  async function openResults(session, container) {
    if (!session) return;
    const ratings = (await BCDB.getAll('peerRatings')).filter((r) => r.sessionId === session.id);
    const byEval = {};
    ratings.forEach((r) => {
      if (!byEval[r.evaluateeId]) byEval[r.evaluateeId] = [];
      byEval[r.evaluateeId].push(r);
    });

    const rows = (session.memberIds || []).map((id) => {
      const list = byEval[id] || [];
      const avg = list.length ? list.reduce((a, r) => a + (r.total || 0), 0) / list.length : null;
      return { id, name: list[0]?.evaluateeName || ('#' + id), count: list.length, avg };
    }).sort((a, b) => (b.avg || 0) - (a.avg || 0));

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header"><h2>Results — ${escapeHtml(session.title)}</h2><button class="btn-icon modal-close">✕</button></div>
        <div class="modal-body">
          <table class="data">
            <thead><tr><th>Student</th><th>Ratings received</th><th>Avg total</th></tr></thead>
            <tbody>
              ${rows.map((r) => `
                <tr>
                  <td>${escapeHtml(r.name)}</td>
                  <td>${r.count}</td>
                  <td><strong>${r.avg != null ? r.avg.toFixed(1) : '—'}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="card-title mt-16">Individual ratings</div>
          <div style="max-height:240px;overflow:auto;font-size:13px">
            ${ratings.length === 0 ? '<p class="text-muted">No ratings yet</p>' : ratings.map((r) => `
              <div style="padding:8px;border-bottom:1px solid var(--border)">
                <strong>${escapeHtml(r.raterName)}</strong> → ${escapeHtml(r.evaluateeName)}:
                total <strong>${r.total}</strong>
                ${r.strongest ? ` · Strong: ${escapeHtml(r.strongest)}` : ''}
                ${r.improve ? ` · Improve: ${escapeHtml(r.improve)}` : ''}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary modal-close">Close</button></div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', () => backdrop.remove()));
  }

  return { render };
})();
