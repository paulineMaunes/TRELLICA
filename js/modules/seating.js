/**
 * Seating Chart Designer — grid seats per subject
 */
const SeatingModule = (() => {
  let subjectId = null;
  let rows = 5;
  let cols = 6;
  let seats = {}; // key "r-c" -> studentId
  let selectedKey = null;
  let chartId = null;

  async function loadChart() {
    const all = await BCDB.getAll('seating');
    const found = all.find((c) => c.subjectId === subjectId);
    if (found) {
      chartId = found.id;
      rows = found.rows || 5;
      cols = found.cols || 6;
      seats = found.seats || {};
    } else {
      chartId = null;
      seats = {};
    }
  }

  async function saveChart() {
    if (!subjectId) return;
    const id = chartId || await BCDB.nextId('seating');
    const rec = { id, subjectId, rows, cols, seats, updatedAt: new Date().toISOString() };
    await BCDB.put('seating', rec);
    chartId = id;
    Sync.queueChange('seating', rec);
    toast('Seating chart saved', 'success');
  }

  async function render(container) {
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    if (!subjectId && subjects.length) subjectId = subjects[0].id;
    await loadChart();

    const enrollments = await BCDB.getAll('enrollments');
    const students = await BCDB.getAll('students');
    const enrolledIds = enrollments.filter((e) => e.subjectId === subjectId).map((e) => e.studentId);
    let enrolled = students.filter((s) => enrolledIds.includes(s.id) && s.isActive !== false);
    enrolled.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));

    const assigned = new Set(Object.values(seats).filter(Boolean));
    const unassigned = enrolled.filter((s) => !assigned.has(s.id));

    const nameOf = (id) => {
      const s = students.find((x) => x.id === id);
      return s ? StudentsModule.fullName(s) : '—';
    };

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:180px">
          <label>Subject</label>
          <select id="seat-subject">
            ${subjects.map((s) => `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('') || '<option>No subjects</option>'}
          </select>
        </div>
        <div class="form-group" style="margin:0;width:70px">
          <label>Rows</label>
          <input type="number" id="seat-rows" min="1" max="20" value="${rows}">
        </div>
        <div class="form-group" style="margin:0;width:70px">
          <label>Cols</label>
          <input type="number" id="seat-cols" min="1" max="16" value="${cols}">
        </div>
        <button class="btn btn-secondary" id="seat-apply">Apply grid</button>
        <button class="btn btn-secondary" id="seat-clear">Clear seats</button>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="seat-save">Save Chart</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 220px;gap:16px">
        <div class="card" style="overflow:auto">
          <div class="card-title">Front of room</div>
          <div class="seat-grid" id="seat-grid" style="display:grid;grid-template-columns:repeat(${cols}, minmax(70px,1fr));gap:8px">
            ${Array.from({ length: rows * cols }, (_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const key = r + '-' + c;
              const sid = seats[key];
              const sel = selectedKey === key ? ' selected' : '';
              return `<div class="seat-cell${sid ? ' occupied' : ''}${sel}" data-key="${key}" title="${sid ? escapeAttr(nameOf(sid)) : 'Empty'}">
                ${sid ? `<span class="seat-name">${escapeHtml(nameOf(sid).split(',')[0])}</span>` : `<span class="text-muted">${r + 1},${c + 1}</span>`}
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Unassigned (${unassigned.length})</div>
          <div id="seat-unassigned" style="max-height:420px;overflow:auto;display:flex;flex-direction:column;gap:6px">
            ${unassigned.length === 0 ? '<p class="text-muted">All seated</p>' : unassigned.map((s) => `
              <button class="btn btn-sm btn-secondary seat-pick" data-id="${s.id}" style="justify-content:flex-start;text-align:left">
                ${escapeHtml(StudentsModule.fullName(s))}
              </button>
            `).join('')}
          </div>
          <p class="text-muted mt-8" style="font-size:12px">Click a seat, then a student (or click occupied seat to free).</p>
        </div>
      </div>
    `;

    container.querySelector('#seat-subject').addEventListener('change', async (e) => {
      subjectId = +e.target.value || null;
      selectedKey = null;
      await loadChart();
      render(container);
    });
    container.querySelector('#seat-apply').addEventListener('click', () => {
      rows = Math.max(1, Math.min(20, +container.querySelector('#seat-rows').value || 5));
      cols = Math.max(1, Math.min(16, +container.querySelector('#seat-cols').value || 6));
      // prune seats outside grid
      const next = {};
      Object.keys(seats).forEach((k) => {
        const [r, c] = k.split('-').map(Number);
        if (r < rows && c < cols) next[k] = seats[k];
      });
      seats = next;
      render(container);
    });
    container.querySelector('#seat-clear').addEventListener('click', () => {
      if (!confirm('Clear all seat assignments?')) return;
      seats = {};
      selectedKey = null;
      render(container);
    });
    container.querySelector('#seat-save').addEventListener('click', saveChart);

    container.querySelectorAll('.seat-cell').forEach((cell) => {
      cell.addEventListener('click', () => {
        const key = cell.dataset.key;
        if (seats[key]) {
          // free seat
          delete seats[key];
          selectedKey = null;
          render(container);
          return;
        }
        selectedKey = key;
        render(container);
      });
    });
    container.querySelectorAll('.seat-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!selectedKey) {
          toast('Select an empty seat first', 'error');
          return;
        }
        // remove student from any other seat
        const sid = +btn.dataset.id;
        Object.keys(seats).forEach((k) => { if (seats[k] === sid) delete seats[k]; });
        seats[selectedKey] = sid;
        selectedKey = null;
        render(container);
      });
    });
  }

  return { render };
})();
