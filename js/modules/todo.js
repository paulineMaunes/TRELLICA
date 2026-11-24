/**
 * Todo List
 */
const TodoModule = (() => {
  async function render(container) {
    let items = await BCDB.getAll('todos');
    items.sort((a, b) => {
      if ((a.status === 'Done') !== (b.status === 'Done')) return a.status === 'Done' ? 1 : -1;
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });

    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="todo-add">+ Add Task</button>
      </div>
      <div class="card">
        <div class="card-title">Tasks (${items.filter((t) => t.status !== 'Done').length} open)</div>
        ${items.length === 0 ? '<div class="empty"><div class="big">✓</div><p>No tasks yet</p></div>' : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${items.map((t) => `
              <div class="flex" style="padding:12px;border:1px solid var(--border);border-radius:8px;opacity:${t.status === 'Done' ? 0.55 : 1}">
                <input type="checkbox" class="todo-check" data-id="${t.id}" ${t.status === 'Done' ? 'checked' : ''} style="width:18px;height:18px">
                <div style="flex:1">
                  <div style="font-weight:600;${t.status === 'Done' ? 'text-decoration:line-through' : ''}">${escapeHtml(t.title)}</div>
                  <div class="text-muted" style="font-size:12px">
                    ${t.priority ? `<span class="badge ${t.priority === 'High' ? 'badge-absent' : t.priority === 'Medium' ? 'badge-late' : 'badge-active'}">${escapeHtml(t.priority)}</span> ` : ''}
                    ${t.dueDate ? 'Due ' + escapeHtml(t.dueDate) : ''}
                    ${t.notes ? ' · ' + escapeHtml(t.notes) : ''}
                  </div>
                </div>
                <button class="btn btn-sm btn-secondary todo-edit" data-id="${t.id}">Edit</button>
                <button class="btn btn-sm btn-danger todo-del" data-id="${t.id}">Del</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    container.querySelector('#todo-add').addEventListener('click', () => openForm(null, container));
    container.querySelectorAll('.todo-edit').forEach((btn) => {
      btn.addEventListener('click', async () => openForm(await BCDB.getById('todos', +btn.dataset.id), container));
    });
    container.querySelectorAll('.todo-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete task?')) return;
        await BCDB.remove('todos', +btn.dataset.id);
        render(container);
      });
    });
    container.querySelectorAll('.todo-check').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const t = await BCDB.getById('todos', +cb.dataset.id);
        if (!t) return;
        t.status = cb.checked ? 'Done' : 'Open';
        t.completedAt = cb.checked ? new Date().toISOString() : null;
        await BCDB.put('todos', t);
        render(container);
      });
    });
  }

  function openForm(item, container) {
    const isNew = !item;
    const t = item || { title: '', notes: '', priority: 'Medium', status: 'Open', dueDate: '' };
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h2>${isNew ? 'Add' : 'Edit'} Task</h2><button class="btn-icon modal-close">✕</button></div>
        <div class="modal-body">
          <div class="form-row"><div class="form-group" style="grid-column:1/-1"><label>Title *</label><input id="t-title" value="${escapeAttr(t.title)}"></div></div>
          <div class="form-row">
            <div class="form-group"><label>Priority</label>
              <select id="t-pri"><option ${t.priority === 'Low' ? 'selected' : ''}>Low</option><option ${t.priority === 'Medium' ? 'selected' : ''}>Medium</option><option ${t.priority === 'High' ? 'selected' : ''}>High</option></select>
            </div>
            <div class="form-group"><label>Due date</label><input type="date" id="t-due" value="${escapeAttr(t.dueDate || '')}"></div>
          </div>
          <div class="form-row"><div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea id="t-notes" rows="2">${escapeHtml(t.notes || '')}</textarea></div></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="t-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));
    backdrop.querySelector('#t-save').addEventListener('click', async () => {
      const title = backdrop.querySelector('#t-title').value.trim();
      if (!title) { toast('Title required', 'error'); return; }
      const rec = {
        id: isNew ? await BCDB.nextId('todos') : t.id,
        title,
        notes: backdrop.querySelector('#t-notes').value.trim(),
        priority: backdrop.querySelector('#t-pri').value,
        status: t.status || 'Open',
        dueDate: backdrop.querySelector('#t-due').value,
        createdAt: t.createdAt || new Date().toISOString(),
        completedAt: t.completedAt || null
      };
      await BCDB.put('todos', rec);
      Sync.queueChange('todos', rec);
      toast('Saved', 'success');
      close();
      render(container);
    });
  }

  return { render };
})();
