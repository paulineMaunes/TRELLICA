/**
 * Sticky Notes board
 */
const StickyModule = (() => {
  const COLORS = ['#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#e0e7ff', '#ffedd5'];

  async function render(container) {
    const notes = (await BCDB.getAll('stickyNotes')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="st-add">+ New note</button>
      </div>
      <div id="sticky-board" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">
        ${notes.length === 0 ? '<div class="empty" style="grid-column:1/-1"><div class="big">📌</div><p>No sticky notes</p></div>' : notes.map((n) => `
          <div class="sticky-note" data-id="${n.id}" style="background:${n.color || COLORS[0]};border-radius:8px;padding:14px;min-height:120px;box-shadow:var(--shadow);position:relative">
            <button class="btn-icon st-del" data-id="${n.id}" style="position:absolute;top:4px;right:4px;font-size:12px">✕</button>
            <div class="st-body" contenteditable="true" data-id="${n.id}" style="outline:none;font-size:14px;line-height:1.4;min-height:80px">${escapeHtml(n.text || '')}</div>
            <div class="text-muted" style="font-size:11px;margin-top:8px">${escapeHtml((n.updatedAt || '').slice(0, 16).replace('T', ' '))}</div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelector('#st-add').addEventListener('click', async () => {
      const rec = {
        id: await BCDB.nextId('stickyNotes'),
        text: '',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        updatedAt: new Date().toISOString()
      };
      await BCDB.put('stickyNotes', rec);
      render(container);
    });

    container.querySelectorAll('.st-body').forEach((el) => {
      let timer;
      el.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const n = await BCDB.getById('stickyNotes', +el.dataset.id);
          if (!n) return;
          n.text = el.innerText;
          n.updatedAt = new Date().toISOString();
          await BCDB.put('stickyNotes', n);
        }, 400);
      });
    });

    container.querySelectorAll('.st-del').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await BCDB.remove('stickyNotes', +btn.dataset.id);
        render(container);
      });
    });
  }

  return { render };
})();
