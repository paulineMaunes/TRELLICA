/** Lesson presentation — embed URL or fullscreen blank board tip */
const PresentModule = (() => {
  function render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title">Lesson presentation</div>
        <p class="text-muted" style="margin-bottom:14px">Paste a public Canva, Google Slides, or PowerPoint Online share link to embed. For desktop PowerPoint, share via OneDrive/Office online.</p>
        <div class="form-row">
          <div class="form-group" style="grid-column:1/-1">
            <label>Presentation URL</label>
            <input id="pres-url" placeholder="https://www.canva.com/design/.../view or slides.google.com/...">
          </div>
        </div>
        <button class="btn btn-primary" id="pres-load">Load</button>
        <button class="btn btn-secondary" id="pres-full">Open in new tab</button>
      </div>
      <div class="card" id="pres-frame-wrap" style="padding:0;overflow:hidden;min-height:480px;display:none">
        <iframe id="pres-frame" style="width:100%;height:70vh;border:0" allowfullscreen></iframe>
      </div>
    `;
    const load = () => {
      let url = container.querySelector('#pres-url').value.trim();
      if (!url) { toast('Enter a URL', 'error'); return; }
      // Canva view → embed-ish
      if (url.includes('canva.com') && !url.includes('/view?embed')) {
        url = url.replace(/\/view.*$/, '/view?embed');
      }
      if (url.includes('docs.google.com/presentation') && !url.includes('/embed')) {
        url = url.replace('/edit', '/embed').replace('/pub', '/embed');
        if (!url.includes('/embed')) url += url.includes('?') ? '&rm=minimal' : '/embed?rm=minimal';
      }
      const wrap = container.querySelector('#pres-frame-wrap');
      const frame = container.querySelector('#pres-frame');
      frame.src = url;
      wrap.style.display = 'block';
    };
    container.querySelector('#pres-load').addEventListener('click', load);
    container.querySelector('#pres-full').addEventListener('click', () => {
      const url = container.querySelector('#pres-url').value.trim();
      if (url) window.open(url, '_blank');
    });
  }
  return { render };
})();
