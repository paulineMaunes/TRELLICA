/**
 * Google Calendar–style monthly grid (IndexedDB calendarEvents)
 */
const CalendarModule = (() => {
  const COLORS = [
    { id: 'cobalt', hex: '#2563EB', label: 'Cobalt' },
    { id: 'forest', hex: '#059669', label: 'Forest' },
    { id: 'tomato', hex: '#DC2626', label: 'Tomato' },
    { id: 'tangerine', hex: '#EA580C', label: 'Tangerine' },
    { id: 'lavender', hex: '#7C3AED', label: 'Lavender' },
    { id: 'graphite', hex: '#475569', label: 'Graphite' }
  ];

  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth(); // 0-11
  let eventsCache = [];

  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseYmd(s) {
    const [y, m, d] = (s || '').split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function monthLabel(y, m) {
    return new Date(y, m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  function eventsForDate(dateStr) {
    return eventsCache
      .filter((e) => e.eventDate === dateStr)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  function colorHex(c) {
    return (COLORS.find((x) => x.id === c || x.hex === c) || COLORS[0]).hex;
  }

  function formatTime(t) {
    if (!t) return '';
    const [hh, mm] = t.split(':').map(Number);
    if (Number.isNaN(hh)) return t;
    const am = hh < 12;
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm || 0).padStart(2, '0')}${am ? 'am' : 'pm'}`;
  }

  async function loadEvents() {
    eventsCache = await BCDB.getAll('calendarEvents');
  }

  function openCreateModal(host, dateStr, existing) {
    const isEdit = !!existing;
    const overlay = document.createElement('div');
    overlay.className = 'cal-modal-overlay';
    const color = existing?.color || 'cobalt';
    overlay.innerHTML = `
      <div class="cal-modal" role="dialog" aria-modal="true">
        <div class="cal-modal-head">
          <strong>${isEdit ? 'Edit event' : 'Create event'}</strong>
          <button type="button" class="btn-icon cal-close" title="Close">✕</button>
        </div>
        <form class="cal-form">
          <label>Event title<input name="title" required autofocus value="${escapeAttr(existing?.title || '')}" placeholder="Add title"></label>
          <label>Date<input name="eventDate" type="date" required value="${escapeAttr(existing?.eventDate || dateStr)}"></label>
          <label class="cal-allday"><input type="checkbox" name="allDay" ${existing?.allDay ? 'checked' : ''}> All-day</label>
          <div class="cal-times ${existing?.allDay ? 'hidden' : ''}">
            <label>Start<input name="startTime" type="time" value="${escapeAttr(existing?.startTime || '09:00')}"></label>
            <label>End<input name="endTime" type="time" value="${escapeAttr(existing?.endTime || '10:00')}"></label>
          </div>
          <label>Location (optional)<input name="location" value="${escapeAttr(existing?.location || '')}" placeholder="Room or place"></label>
          <label>Notes<textarea name="notes" rows="3" placeholder="Description">${escapeHtml(existing?.notes || '')}</textarea></label>
          <div class="cal-swatches" role="listbox" aria-label="Event color">
            ${COLORS.map((c) => `
              <button type="button" class="cal-swatch ${c.id === color || c.hex === color ? 'active' : ''}"
                data-color="${c.id}" style="background:${c.hex}" title="${c.label}"></button>`).join('')}
          </div>
          <div class="cal-modal-actions">
            <button type="button" class="btn btn-secondary cal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>`;
    host.appendChild(overlay);
    let selectedColor = color;
    const form = overlay.querySelector('.cal-form');
    const times = overlay.querySelector('.cal-times');
    overlay.querySelector('[name=allDay]').addEventListener('change', (e) => {
      times.classList.toggle('hidden', e.target.checked);
    });
    overlay.querySelectorAll('.cal-swatch').forEach((b) => {
      b.addEventListener('click', () => {
        overlay.querySelectorAll('.cal-swatch').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        selectedColor = b.dataset.color;
      });
    });
    const close = () => overlay.remove();
    overlay.querySelector('.cal-close').addEventListener('click', close);
    overlay.querySelector('.cal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const rec = {
        id: existing?.id || await BCDB.nextId('calendarEvents'),
        title: String(fd.get('title') || '').trim(),
        eventDate: String(fd.get('eventDate') || dateStr),
        allDay: !!fd.get('allDay'),
        startTime: fd.get('allDay') ? '' : String(fd.get('startTime') || ''),
        endTime: fd.get('allDay') ? '' : String(fd.get('endTime') || ''),
        location: String(fd.get('location') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        color: selectedColor,
        category: existing?.category || 'Other',
        updatedAt: new Date().toISOString(),
        createdAt: existing?.createdAt || new Date().toISOString()
      };
      if (!rec.title) { toast('Title required', 'error'); return; }
      await BCDB.put('calendarEvents', rec);
      if (window.Sync) Sync.queueChange('calendarEvents', rec);
      close();
      toast(isEdit ? 'Event updated' : 'Event created', 'success');
      if (host._calRerender) host._calRerender();
    });
  }

  function openDetail(host, ev, anchorEl) {
    const pop = document.createElement('div');
    pop.className = 'cal-popover';
    const hex = colorHex(ev.color);
    const when = parseYmd(ev.eventDate).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    const timeBit = ev.allDay ? 'All day' : [formatTime(ev.startTime), formatTime(ev.endTime)].filter(Boolean).join(' – ');
    pop.innerHTML = `
      <div class="cal-pop-actions">
        <button type="button" class="btn-icon cal-edit" title="Edit">✎</button>
        <button type="button" class="btn-icon cal-del" title="Delete">🗑</button>
        <button type="button" class="btn-icon cal-x" title="Close">✕</button>
      </div>
      <div class="cal-pop-head">
        <span class="cal-pop-swatch" style="background:${hex}"></span>
        <div>
          <strong>${escapeHtml(ev.title)}</strong>
          <div class="text-muted" style="font-size:12px">${escapeHtml(when)}${timeBit ? ' · ' + escapeHtml(timeBit) : ''}</div>
        </div>
      </div>
      ${ev.location ? `<div class="cal-pop-row">📍 ${escapeHtml(ev.location)}</div>` : ''}
      ${ev.notes ? `<div class="cal-pop-row">📝 ${escapeHtml(ev.notes)}</div>` : ''}`;
    host.appendChild(pop);
    const close = () => pop.remove();
    pop.querySelector('.cal-x').addEventListener('click', close);
    pop.querySelector('.cal-edit').addEventListener('click', () => {
      close();
      openCreateModal(host, ev.eventDate, ev);
    });
    pop.querySelector('.cal-del').addEventListener('click', async () => {
      if (!confirm('Delete this event?')) return;
      await BCDB.remove('calendarEvents', ev.id);
      if (window.Sync) Sync.queueChange('calendarEvents', { id: ev.id, _deleted: true });
      close();
      toast('Event deleted', 'success');
      if (host._calRerender) host._calRerender();
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  function buildGrid(host) {
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // Sunday start
    const today = ymd(new Date());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    const weeks = [];
    for (let w = 0; w < 6; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));

    host.innerHTML = `
      <div class="cal-shell">
        <div class="cal-toolbar">
          <div class="cal-toolbar-left">
            <button type="button" class="btn btn-secondary btn-sm" id="cal-today">Today</button>
            <button type="button" class="btn-icon" id="cal-prev" title="Previous month">‹</button>
            <button type="button" class="btn-icon" id="cal-next" title="Next month">›</button>
            <h2 class="cal-month-title">${escapeHtml(monthLabel(viewYear, viewMonth))}</h2>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="cal-add">+ Event</button>
        </div>
        <div class="cal-dow">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => `<div>${d}</div>`).join('')}
        </div>
        <div class="cal-grid">
          ${weeks.map((week) => week.map((d) => {
            const ds = ymd(d);
            const inMonth = d.getMonth() === viewMonth;
            const isToday = ds === today;
            const list = eventsForDate(ds);
            const dayNum = d.getDate();
            const label = (!inMonth && dayNum === 1)
              ? d.toLocaleString(undefined, { month: 'short' }) + ' ' + dayNum
              : String(dayNum);
            return `
              <div class="cal-cell ${inMonth ? '' : 'muted'} ${isToday ? 'today' : ''}" data-date="${ds}">
                <div class="cal-daynum ${isToday ? 'badge' : ''}">${escapeHtml(label)}</div>
                <div class="cal-events">
                  ${list.map((ev) => {
                    const hex = colorHex(ev.color);
                    if (ev.allDay || !ev.startTime) {
                      return `<button type="button" class="cal-pill" data-id="${ev.id}" style="background:${hex}">${escapeHtml(ev.title)}</button>`;
                    }
                    return `<button type="button" class="cal-timed" data-id="${ev.id}">
                      <span class="dot" style="background:${hex}"></span>
                      <span class="t">${escapeHtml(formatTime(ev.startTime))}</span>
                      <span class="n">${escapeHtml(ev.title)}</span>
                    </button>`;
                  }).join('')}
                </div>
              </div>`;
          }).join('')).join('')}
        </div>
      </div>`;

    host.querySelector('#cal-today').addEventListener('click', () => {
      const n = new Date();
      viewYear = n.getFullYear();
      viewMonth = n.getMonth();
      host._calRerender();
    });
    host.querySelector('#cal-prev').addEventListener('click', () => {
      viewMonth -= 1;
      if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
      host._calRerender();
    });
    host.querySelector('#cal-next').addEventListener('click', () => {
      viewMonth += 1;
      if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
      host._calRerender();
    });
    host.querySelector('#cal-add').addEventListener('click', () => openCreateModal(host, today));
    host.querySelectorAll('.cal-cell').forEach((cell) => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('[data-id]')) return;
        openCreateModal(host, cell.dataset.date);
      });
    });
    host.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ev = eventsCache.find((x) => String(x.id) === String(btn.dataset.id));
        if (ev) openDetail(host, ev, btn);
      });
    });
  }

  async function render(container) {
    await loadEvents();
    const host = document.createElement('div');
    host.className = 'cal-root';
    container.innerHTML = '';
    container.appendChild(host);
    host._calRerender = async () => {
      await loadEvents();
      buildGrid(host);
    };
    buildGrid(host);
  }

  /** Embed into dashboard: returns HTML string placeholder — use renderInto */
  async function renderInto(el) {
    await render(el);
  }

  return { render, renderInto, COLORS };
})();
