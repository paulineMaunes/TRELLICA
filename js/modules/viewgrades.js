/** Show individual student grades */
const ViewGradesModule = (() => {
  let studentId = null;
  let period = 'Midterm';

  async function render(container) {
    const students = (await BCDB.getAll('students')).filter((s) => s.isActive !== false)
      .sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));
    if (!studentId && students.length) studentId = students[0].id;
    const categories = (await BCDB.getAll('categories')).filter((c) => c.isActive !== false && c.period === period)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const grades = await BCDB.getAll('grades');
    const student = students.find((s) => s.id === studentId);

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:220px">
          <label>Student</label>
          <select id="vg-stu">${students.map((s) => `<option value="${s.id}" ${s.id===studentId?'selected':''}>${escapeHtml(StudentsModule.fullName(s))}</option>`).join('')}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Period</label>
          <select id="vg-period"><option ${period==='Midterm'?'selected':''}>Midterm</option><option ${period==='Finals'?'selected':''}>Finals</option></select>
        </div>
      </div>
      <div class="card">
        <div class="card-title">${student ? escapeHtml(StudentsModule.fullName(student)) : '—'} · ${escapeHtml(period)}</div>
        ${!student ? '<p class="text-muted">No student</p>' : `
          <table class="data">
            <thead><tr><th>Category</th><th>Weight</th><th>Scores</th><th>Category %</th></tr></thead>
            <tbody>
              ${categories.map((cat) => {
                const maxItems = Math.max(1, cat.maxItems || 1);
                const parts = [];
                let sum = 0, maxSum = 0, n = 0;
                for (let i = 1; i <= maxItems; i++) {
                  const g = grades.find((x) => x.studentId === studentId && x.categoryId === cat.id && x.itemIndex === i && (x.period === period || !x.period));
                  const mx = cat.itemMaxScore || 100;
                  if (g && g.score != null) {
                    parts.push(g.score + '/' + mx);
                    sum += Number(g.score); maxSum += mx; n++;
                  } else parts.push('—');
                }
                const pct = n && maxSum ? ((sum / maxSum) * 100).toFixed(1) : '—';
                return `<tr>
                  <td>${escapeHtml(cat.name)}</td>
                  <td>${((cat.weight||0)*100).toFixed(0)}%</td>
                  <td>${parts.join(', ')}</td>
                  <td><strong>${pct}</strong></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
    container.querySelector('#vg-stu').addEventListener('change', (e) => { studentId = +e.target.value; render(container); });
    container.querySelector('#vg-period').addEventListener('change', (e) => { period = e.target.value; render(container); });
  }
  return { render };
})();
