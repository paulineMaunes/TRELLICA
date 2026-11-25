/** Classroom countdown timer — large display */
const TimerModule = (() => {
  let remaining = 5 * 60;
  let total = 5 * 60;
  let running = false;
  let interval = null;

  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function paint(container) {
    const cls = remaining <= 10 ? 'danger' : remaining <= 60 ? 'warn' : '';
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:40px 20px">
        <div class="card-title" style="justify-content:center">Classroom Timer</div>
        <div class="timer-display ${cls}" id="timer-face">${fmt(remaining)}</div>
        <div class="flex flex-wrap" style="justify-content:center;margin-top:24px">
          <button class="btn btn-primary" id="t-start">${running ? 'Pause' : 'Start'}</button>
          <button class="btn btn-secondary" id="t-reset">Reset</button>
        </div>
        <div class="flex flex-wrap" style="justify-content:center;margin-top:16px">
          <button class="btn btn-sm btn-secondary t-preset" data-m="1">1 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="3">3 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="5">5 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="10">10 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="15">15 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="30">30 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="45">45 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="60">60 min</button>
        </div>
        <div class="form-row" style="max-width:280px;margin:20px auto 0">
          <div class="form-group"><label>Custom minutes</label>
            <input type="number" id="t-custom" min="1" max="180" value="5">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-secondary w-full" id="t-set">Set</button>
          </div>
        </div>
      </div>
    `;
    container.querySelector('#t-start').addEventListener('click', () => {
      if (running) pause();
      else start(container);
      paint(container);
    });
    container.querySelector('#t-reset').addEventListener('click', () => {
      pause();
      remaining = total;
      paint(container);
    });
    container.querySelectorAll('.t-preset').forEach((b) => {
      b.addEventListener('click', () => {
        pause();
        total = remaining = (+b.dataset.m) * 60;
        paint(container);
      });
    });
    container.querySelector('#t-set').addEventListener('click', () => {
      const m = Math.max(1, Math.min(180, +container.querySelector('#t-custom').value || 5));
      pause();
      total = remaining = m * 60;
      paint(container);
    });
  }

  function start(container) {
    if (running) return;
    running = true;
    interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        pause();
        try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6T').play(); } catch (_) {}
        toast('Time is up!', 'success');
      }
      const face = document.getElementById('timer-face');
      if (face) {
        face.textContent = fmt(remaining);
        face.className = 'timer-display ' + (remaining <= 10 ? 'danger' : remaining <= 60 ? 'warn' : '');
      } else {
        pause();
      }
    }, 1000);
  }

  function pause() {
    running = false;
    if (interval) clearInterval(interval);
    interval = null;
  }

  function render(container) {
    paint(container);
  }

  return { render };
})();
