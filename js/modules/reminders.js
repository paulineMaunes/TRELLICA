/**
 * Reminders
 */
const RemindersModule = (() => {
  async function render(container) {
    const items = (await BCDB.getAll('reminders')).sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));
    const now = new Date().toISOString();

    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="rm-add">+ Add reminder</button>
      </div>
      <div class="card">
        <div class="card-title">Reminders</div>
        ${items.length === 0 ? '<div class="empty"><div class="big">🔔</div><p>No reminders</p></div>' : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${items.map((r) => {
              const overdue = r.dueAt && r.dueAt < now && r.status !== 'Done';
              return `
                <div class="flex" style="padding:12px;border:1px solid var(--border);border-radius:8px;${overdue ? 'border-color:var(--danger)' : ''}">
                  <input type="checkbox" class="rm-check" data-id="${r.id}" ${r.status === 'Done' ? 'checked' : ''} style="width:18px;height:18px">
                  <div style="flex:1">
                    <div style="font-weight:600">${escapeHtml(r.title)}</div>
                    <div class="text-muted" style="font-size:12px">
                      ${r.dueAt ? escapeHtml(r.dueAt.replace('T', ' ').slice(0, 16)) : 'No due time'}
                      ${overdue ? ' · <span style="color:var(--danger)">Overdue</span>' : ''}
                    </div>
                  </div>
                  <button class="btn btn-sm btn-danger rm-del" data-id="${r.id}">Del</button>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    container.querySelector('#rm-add').addEventListener('click', () => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const def = new Date();
      def.setHours(def.getHours() + 1, 0, 0, 0);
      const local = def.toISOString().slice(0, 16);
      backdrop.innerHTML = `
        <div class="modal">
          <div class="modal-header"><h2>New reminder</h2><button class="btn-icon modal-close">✕</button></div>
          <div class="modal-body">
            <div class="form-row"><div class="form-group" style="grid-column:1/-1"><label>Title *</label><input id="rm-title"></div></div>
            <div class="form-row"><div class="form-group"><label>Due</label><input type="datetime-local" id="rm-due" value="${local}"></div></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary modal-close">Cancel</button>
            <button class="btn btn-primary" id="rm-save">Save</button>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
      const close = () => backdrop.remove();
      backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));
      backdrop.querySelector('#rm-save').addEventListener('click', async () => {
        const title = backdrop.querySelector('#rm-title').value.trim();
        if (!title) { toast('Title required', 'error'); return; }
        const due = backdrop.querySelector('#rm-due').value;
        const rec = {
          id: await BCDB.nextId('reminders'),
          title,
          dueAt: due ? new Date(due).toISOString() : null,
          status: 'Open',
          createdAt: new Date().toISOString()
        };
        await BCDB.put('reminders', rec);
        Sync.queueChange('reminders', rec);
        toast('Reminder added', 'success');
        close();
        render(container);
      });
    });

    container.querySelectorAll('.rm-check').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const r = await BCDB.getById('reminders', +cb.dataset.id);
        if (!r) return;
        r.status = cb.checked ? 'Done' : 'Open';
        await BCDB.put('reminders', r);
        render(container);
      });
    });
    container.querySelectorAll('.rm-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await BCDB.remove('reminders', +btn.dataset.id);
        render(container);
      });
    });
  }

  return { render };
})();
