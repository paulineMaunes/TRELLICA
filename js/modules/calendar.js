/**
 * Academic Calendar — events, holidays, exams
 */
const CalendarModule = (() => {
  let month = new Date().getMonth();
  let year = new Date().getFullYear();

  async function render(container) {
    const events = (await BCDB.getAll('calendarEvents')).sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''));
    const byDate = {};
    events.forEach((e) => {
      if (!byDate[e.eventDate]) byDate[e.eventDate] = [];
      byDate[e.eventDate].push(e);
    });

    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = first.toLocaleString('default', { month: 'long' });

    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push('<div class="cal-cell empty"></div>');
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const evs = byDate[ds] || [];
      cells.push(`
        <div class="cal-cell" data-date="${ds}">
          <div class="cal-day">${d}</div>
          ${evs.slice(0, 3).map((e) => `<div class="cal-ev" title="${escapeAttr(e.title)}">${escapeHtml(e.title)}</div>`).join('')}
          ${evs.length > 3 ? `<div class="cal-ev more">+${evs.length - 3}</div>` : ''}
        </div>
      `);
    }

    const upcoming = events.filter((e) => e.eventDate >= new Date().toISOString().slice(0, 10)).slice(0, 12);

    container.innerHTML = `
      <div class="toolbar">
        <button class="btn btn-secondary" id="cal-prev">‹</button>
        <strong style="min-width:140px;text-align:center">${monthName} ${year}</strong>
        <button class="btn btn-secondary" id="cal-next">›</button>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="cal-add">+ Add Event</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 280px;gap:16px">
        <div class="card" style="padding:12px">
          <div class="cal-weekdays" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;font-size:12px;font-weight:600;color:var(--text-muted);text-align:center">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div class="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
            ${cells.join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Upcoming</div>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:480px;overflow:auto">
            ${upcoming.length === 0 ? '<p class="text-muted">No upcoming events</p>' : upcoming.map((e) => `
              <div style="padding:8px;border:1px solid var(--border);border-radius:8px">
                <div style="font-size:12px;color:var(--text-muted)">${escapeHtml(e.eventDate)} ${e.startTime || ''}</div>
                <strong>${escapeHtml(e.title)}</strong>
                ${e.category ? `<span class="badge badge-active" style="margin-left:6px">${escapeHtml(e.category)}</span>` : ''}
                <div class="flex mt-8">
                  <button class="btn btn-sm btn-secondary cal-edit" data-id="${e.id}">Edit</button>
                  <button class="btn btn-sm btn-danger cal-del" data-id="${e.id}">Del</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.querySelector('#cal-prev').addEventListener('click', () => {
      month--;
      if (month < 0) { month = 11; year--; }
      render(container);
    });
    container.querySelector('#cal-next').addEventListener('click', () => {
      month++;
      if (month > 11) { month = 0; year++; }
      render(container);
    });
    container.querySelector('#cal-add').addEventListener('click', () => openEvent(null, container));
    container.querySelectorAll('.cal-cell[data-date]').forEach((cell) => {
      cell.addEventListener('click', () => openEvent({ eventDate: cell.dataset.date }, container));
    });
    container.querySelectorAll('.cal-edit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        openEvent(await BCDB.getById('calendarEvents', +btn.dataset.id), container);
      });
    });
    container.querySelectorAll('.cal-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this event?')) return;
        await BCDB.remove('calendarEvents', +btn.dataset.id);
        toast('Deleted', 'success');
        render(container);
      });
    });
  }

  function openEvent(ev, container) {
    const isNew = !ev || !ev.id;
    const e = ev || { title: '', eventDate: new Date().toISOString().slice(0, 10), category: 'Academic', notes: '', startTime: '', endTime: '' };
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h2>${isNew ? 'Add' : 'Edit'} Event</h2><button class="btn-icon modal-close">✕</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group" style="grid-column:1/-1"><label>Title *</label><input id="ev-title" value="${escapeAttr(e.title || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Date</label><input type="date" id="ev-date" value="${escapeAttr(e.eventDate || '')}"></div>
            <div class="form-group"><label>Category</label>
              <select id="ev-cat">
                ${['Academic', 'Exam', 'Holiday', 'Deadline', 'Meeting', 'Other'].map((c) =>
                  `<option ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Start</label><input type="time" id="ev-start" value="${escapeAttr(e.startTime || '')}"></div>
            <div class="form-group"><label>End</label><input type="time" id="ev-end" value="${escapeAttr(e.endTime || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea id="ev-notes" rows="2">${escapeHtml(e.notes || '')}</textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="ev-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));
    backdrop.querySelector('#ev-save').addEventListener('click', async () => {
      const title = backdrop.querySelector('#ev-title').value.trim();
      if (!title) { toast('Title required', 'error'); return; }
      const rec = {
        id: isNew ? await BCDB.nextId('calendarEvents') : e.id,
        title,
        eventDate: backdrop.querySelector('#ev-date').value,
        category: backdrop.querySelector('#ev-cat').value,
        startTime: backdrop.querySelector('#ev-start').value,
        endTime: backdrop.querySelector('#ev-end').value,
        notes: backdrop.querySelector('#ev-notes').value.trim()
      };
      await BCDB.put('calendarEvents', rec);
      Sync.queueChange('calendarEvents', rec);
      toast('Event saved', 'success');
      close();
      render(container);
    });
  }

  return { render };
})();
