/**
 * Gradebook — categories with weights + per-item scores
 */
const GradebookModule = (() => {
  let selectedSubjectId = null;
  let selectedPeriod = 'Midterm';

  async function render(container) {
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    if (!selectedSubjectId && subjects.length) selectedSubjectId = subjects[0].id;
    const subject = subjects.find((s) => s.id === selectedSubjectId);

    let categories = (await BCDB.getAll('categories'))
      .filter((c) => c.isActive !== false && c.period === selectedPeriod)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Filter by subject if category has subject set; otherwise global
    categories = categories.filter((c) => !c.subject || !subject || c.subject === subject.name || c.subject === subject.code);

    const enrollments = await BCDB.getAll('enrollments');
    const students = await BCDB.getAll('students');
    const grades = await BCDB.getAll('grades');

    const enrolledIds = enrollments.filter((e) => e.subjectId === selectedSubjectId).map((e) => e.studentId);
    let enrolled = students.filter((s) => enrolledIds.includes(s.id) && s.isActive !== false);
    enrolled.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));

    // Build column headers from categories
    const columns = [];
    categories.forEach((cat) => {
      const maxItems = Math.max(1, cat.maxItems || 1);
      for (let i = 1; i <= maxItems; i++) {
        columns.push({ cat, itemIndex: i, label: maxItems > 1 ? `${cat.name} ${i}` : cat.name });
      }
    });

    function getScore(studentId, categoryId, itemIndex) {
      return grades.find((g) =>
        g.studentId === studentId &&
        g.categoryId === categoryId &&
        g.itemIndex === itemIndex &&
        (g.period === selectedPeriod || !g.period) &&
        (!g.subject || !subject || g.subject === subject.name || g.subject === subject.code)
      );
    }

    function getItemMax(cat, itemIndex) {
      if (cat.itemMaxScores) {
        const parts = cat.itemMaxScores.split(',').map((x) => parseFloat(x.trim()));
        const v = parts[itemIndex - 1];
        if (v > 0) return v;
      }
      return cat.itemMaxScore > 0 ? cat.itemMaxScore : 100;
    }

    function computeWeighted(studentId) {
      let total = 0;
      let weightSum = 0;
      categories.forEach((cat) => {
        const maxItems = Math.max(1, cat.maxItems || 1);
        let sum = 0, maxSum = 0, count = 0;
        for (let i = 1; i <= maxItems; i++) {
          const g = getScore(studentId, cat.id, i);
          const mx = getItemMax(cat, i);
          if (g && g.score != null && g.score !== '') {
            sum += Number(g.score);
            maxSum += mx;
            count++;
          }
        }
        if (count > 0 && maxSum > 0) {
          const pct = (sum / maxSum) * 100;
          total += pct * (cat.weight || 0);
          weightSum += cat.weight || 0;
        }
      });
      if (weightSum <= 0) return null;
      // Normalize if some categories missing
      return (total / weightSum) * (categories.reduce((a, c) => a + (c.weight || 0), 0) || 1);
    }

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:200px">
          <label>Subject</label>
          <select id="gb-subject">
            ${subjects.length === 0 ? '<option>No subjects</option>' :
              subjects.map((s) => `<option value="${s.id}" ${s.id === selectedSubjectId ? 'selected' : ''}>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Period</label>
          <select id="gb-period">
            <option ${selectedPeriod === 'Midterm' ? 'selected' : ''}>Midterm</option>
            <option ${selectedPeriod === 'Finals' ? 'selected' : ''}>Finals</option>
          </select>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="gb-cats">Manage Categories</button>
      </div>

      ${!selectedSubjectId || enrolled.length === 0 || columns.length === 0 ? `
        <div class="card"><div class="empty">
          <div class="big">📊</div>
          <p>${!selectedSubjectId ? 'Select a subject.' : enrolled.length === 0 ? 'No enrolled students.' : 'No grade categories for this period. Click Manage Categories.'}</p>
        </div></div>
      ` : `
        <div class="card" style="padding:0;overflow:auto">
          <table class="data gb-table">
            <thead>
              <tr>
                <th style="position:sticky;left:0;background:var(--header);z-index:1">Student</th>
                ${columns.map((c) => `<th class="cat" title="Weight: ${((c.cat.weight || 0) * 100).toFixed(0)}%">${escapeHtml(c.label)}<br><small>/${getItemMax(c.cat, c.itemIndex)}</small></th>`).join('')}
                <th class="cat">Weighted %</th>
              </tr>
            </thead>
            <tbody>
              ${enrolled.map((s) => {
                const w = computeWeighted(s.id);
                return `
                  <tr>
                    <td style="position:sticky;left:0;background:var(--card);font-weight:600;white-space:nowrap">${escapeHtml(StudentsModule.fullName(s))}</td>
                    ${columns.map((c) => {
                      const g = getScore(s.id, c.cat.id, c.itemIndex);
                      const val = g && g.score != null ? g.score : '';
                      return `<td style="text-align:center">
                        <input class="score" type="number" min="0" step="0.01"
                          data-student="${s.id}" data-cat="${c.cat.id}" data-item="${c.itemIndex}"
                          value="${val}" placeholder="—">
                      </td>`;
                    }).join('')}
                    <td class="total" style="text-align:center">${w != null ? w.toFixed(1) : '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="text-muted mt-8" style="font-size:12px">Scores save automatically when you leave a cell. Weighted % uses category weights and only includes categories with at least one score.</p>
      `}
    `;

    container.querySelector('#gb-subject').addEventListener('change', (e) => {
      selectedSubjectId = +e.target.value || null;
      render(container);
    });
    container.querySelector('#gb-period').addEventListener('change', (e) => {
      selectedPeriod = e.target.value;
      render(container);
    });
    container.querySelector('#gb-cats').addEventListener('click', () => openCategories(container));

    container.querySelectorAll('input.score').forEach((input) => {
      input.addEventListener('change', async () => {
        const studentId = +input.dataset.student;
        const categoryId = +input.dataset.cat;
        const itemIndex = +input.dataset.item;
        const raw = input.value.trim();
        const score = raw === '' ? null : parseFloat(raw);

        const existing = getScore(studentId, categoryId, itemIndex);
        const cat = categories.find((c) => c.id === categoryId);
        const record = {
          id: existing?.id || await BCDB.nextId('grades'),
          studentId,
          categoryId,
          itemIndex,
          score,
          maxScore: cat ? getItemMax(cat, itemIndex) : 100,
          period: selectedPeriod,
          subject: subject?.name || subject?.code || '',
          subjectId: selectedSubjectId,
          recordedAt: new Date().toISOString()
        };
        await BCDB.put('grades', record);
        Sync.queueChange('grades', record);
        // Refresh only the weighted cell for speed — full re-render is fine for small classes
        render(container);
      });
    });
  }

  async function openCategories(container) {
    let categories = (await BCDB.getAll('categories')).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    function paint() {
      backdrop.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2>Grade Categories</h2>
            <button class="btn-icon modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Name</th><th>Period</th><th>Weight</th><th>Items</th><th>Max</th><th>Active</th><th></th></tr></thead>
                <tbody>
                  ${categories.map((c) => `
                    <tr>
                      <td>${escapeHtml(c.name)}</td>
                      <td>${escapeHtml(c.period)}</td>
                      <td>${((c.weight || 0) * 100).toFixed(0)}%</td>
                      <td>${c.maxItems || 1}</td>
                      <td>${c.itemMaxScore || 100}</td>
                      <td>${c.isActive !== false ? 'Yes' : 'No'}</td>
                      <td><button class="btn btn-sm btn-secondary cat-edit" data-id="${c.id}">Edit</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <button class="btn btn-primary mt-16" id="cat-add">+ Add Category</button>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary modal-close">Done</button>
          </div>
        </div>
      `;
      const close = () => { backdrop.remove(); render(container); };
      backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));
      backdrop.querySelector('#cat-add').addEventListener('click', () => editCat(null));
      backdrop.querySelectorAll('.cat-edit').forEach((btn) => {
        btn.addEventListener('click', () => editCat(categories.find((c) => c.id === +btn.dataset.id)));
      });
    }

    function editCat(cat) {
      const isNew = !cat;
      const c = cat || { name: '', weight: 0.1, period: selectedPeriod, maxItems: 1, itemMaxScore: 100, itemMaxScores: '', sortOrder: categories.length + 1, isActive: true, subject: '' };
      const form = document.createElement('div');
      form.className = 'modal-backdrop';
      form.style.zIndex = '110';
      form.innerHTML = `
        <div class="modal">
          <div class="modal-header"><h2>${isNew ? 'Add' : 'Edit'} Category</h2><button class="btn-icon f-close">✕</button></div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group"><label>Name</label><input id="c-name" value="${escapeAttr(c.name)}"></div>
              <div class="form-group"><label>Period</label>
                <select id="c-period"><option ${c.period === 'Midterm' ? 'selected' : ''}>Midterm</option><option ${c.period === 'Finals' ? 'selected' : ''}>Finals</option></select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Weight (0–1)</label><input id="c-weight" type="number" step="0.01" min="0" max="1" value="${c.weight}"></div>
              <div class="form-group"><label>Max Items</label><input id="c-items" type="number" min="1" value="${c.maxItems || 1}"></div>
              <div class="form-group"><label>Default Max Score</label><input id="c-max" type="number" min="1" value="${c.itemMaxScore || 100}"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Per-item maxes (comma-sep, optional)</label><input id="c-maxes" value="${escapeAttr(c.itemMaxScores || '')}" placeholder="10,15,20"></div>
              <div class="form-group"><label>Sort Order</label><input id="c-sort" type="number" value="${c.sortOrder || 0}"></div>
              <div class="form-group"><label>Active</label>
                <select id="c-active"><option value="1" ${c.isActive !== false ? 'selected' : ''}>Yes</option><option value="0" ${c.isActive === false ? 'selected' : ''}>No</option></select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary f-close">Cancel</button>
            <button class="btn btn-primary" id="c-save">Save</button>
          </div>
        </div>
      `;
      document.body.appendChild(form);
      form.querySelectorAll('.f-close').forEach((b) => b.addEventListener('click', () => form.remove()));
      form.querySelector('#c-save').addEventListener('click', async () => {
        const record = {
          id: isNew ? await BCDB.nextId('categories') : c.id,
          name: form.querySelector('#c-name').value.trim(),
          period: form.querySelector('#c-period').value,
          weight: parseFloat(form.querySelector('#c-weight').value) || 0,
          maxItems: parseInt(form.querySelector('#c-items').value, 10) || 1,
          itemMaxScore: parseFloat(form.querySelector('#c-max').value) || 100,
          itemMaxScores: form.querySelector('#c-maxes').value.trim(),
          sortOrder: parseInt(form.querySelector('#c-sort').value, 10) || 0,
          isActive: form.querySelector('#c-active').value === '1',
          subject: c.subject || ''
        };
        if (!record.name) { toast('Name required', 'error'); return; }
        await BCDB.put('categories', record);
        categories = (await BCDB.getAll('categories')).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        form.remove();
        paint();
        toast('Category saved', 'success');
      });
    }

    document.body.appendChild(backdrop);
    paint();
  }

  return { render };
})();
