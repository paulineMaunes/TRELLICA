/** Group Project Tracker — simple milestones per group set */
const ProjectModule = (() => {
  async function render(container) {
    const sets = await BCDB.getAll('groupSets');
    const projects = (await BCDB.getAll('settings')).find((x) => x.key === 'projects') || { id: 98, key: 'projects', items: [] };
    if (!projects.items) projects.items = [];

    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="pj-add">+ Project</button>
      </div>
      <div class="card">
        <div class="card-title">Group projects</div>
        ${projects.items.length === 0 ? '<div class="empty"><div class="big">📁</div><p>No projects yet</p></div>' : `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${projects.items.map((p, idx) => `
              <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                <strong>${escapeHtml(p.title)}</strong>
                <span class="text-muted"> · ${escapeHtml(p.status || 'In progress')}</span>
                <div class="text-muted" style="font-size:12px;margin-top:4px">${escapeHtml(p.notes || '')}</div>
                <div class="flex mt-8">
                  <button class="btn btn-sm btn-secondary pj-done" data-i="${idx}">Mark done</button>
                  <button class="btn btn-sm btn-danger pj-del" data-i="${idx}">Delete</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
      ${sets.length ? `<p class="text-muted" style="font-size:12px">Linked group sets available: ${sets.map((s) => escapeHtml(s.name)).join(', ')}</p>` : ''}
    `;
    container.querySelector('#pj-add').addEventListener('click', async () => {
      const title = prompt('Project title');
      if (!title) return;
      projects.items.push({ title, status: 'In progress', notes: '', createdAt: new Date().toISOString() });
      await BCDB.put('settings', projects);
      render(container);
    });
    container.querySelectorAll('.pj-done').forEach((b) => {
      b.addEventListener('click', async () => {
        projects.items[+b.dataset.i].status = 'Done';
        await BCDB.put('settings', projects);
        render(container);
      });
    });
    container.querySelectorAll('.pj-del').forEach((b) => {
      b.addEventListener('click', async () => {
        projects.items.splice(+b.dataset.i, 1);
        await BCDB.put('settings', projects);
        render(container);
      });
    });
  }
  return { render };
})();
