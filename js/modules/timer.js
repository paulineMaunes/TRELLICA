/**
 * Classroom Timer — large display (~80% viewport) + end tone
 */
const TimerModule = (() => {
  let total = 5 * 60;
  let remaining = 5 * 60;
  let running = false;
  let interval = null;
  let audioCtx = null;

  function fmt(sec) {
    const s = Math.max(0, sec | 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function playAlarm() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      // three beeps
      for (let i = 0; i < 4; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i % 2 === 0 ? 880 : 1175;
        gain.gain.setValueAtTime(0.0001, now + i * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.45 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.45 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.45);
        osc.stop(now + i * 0.45 + 0.4);
      }
    } catch (e) {
      console.warn('alarm', e);
      try {
        const a = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6T');
        a.play();
      } catch (_) {}
    }
  }

  function pause() {
    running = false;
    if (interval) clearInterval(interval);
    interval = null;
  }

  function paint(container) {
    const urgent = remaining > 0 && remaining <= 60;
    const display = container.querySelector('.timer-digits');
    const btn = container.querySelector('#t-start');
    if (display) {
      display.textContent = fmt(remaining);
      display.classList.toggle('urgent', urgent || remaining === 0);
    }
    if (btn) btn.textContent = running ? 'Pause' : remaining === 0 ? 'Restart' : 'Start';
  }

  function start(container) {
    if (running) return;
    if (remaining <= 0) remaining = total;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (_) {}
    running = true;
    interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        pause();
        playAlarm();
        toast('Time is up!', 'success');
      }
      paint(container);
    }, 1000);
    paint(container);
  }

  function render(container) {
    container.innerHTML = `
      <div class="timer-hero card" style="width:100%">
        <div class="card-title" style="justify-content:center;font-size:18px">Classroom Timer</div>
        <div class="timer-digits ${remaining <= 60 ? 'urgent' : ''}">${fmt(remaining)}</div>
        <div class="flex flex-wrap" style="justify-content:center;gap:10px;margin-bottom:16px">
          <button class="btn btn-primary" id="t-start" style="min-width:120px">${running ? 'Pause' : 'Start'}</button>
          <button class="btn btn-secondary" id="t-reset">Reset</button>
        </div>
        <div class="flex flex-wrap" style="justify-content:center;gap:8px">
          <button class="btn btn-sm btn-secondary t-preset" data-m="1">1 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="5">5 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="10">10 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="15">15 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="30">30 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="45">45 min</button>
          <button class="btn btn-sm btn-secondary t-preset" data-m="60">60 min</button>
        </div>
        <div class="form-row" style="max-width:320px;margin:20px auto 0">
          <div class="form-group"><label>Custom minutes</label>
            <input type="number" id="t-custom" min="1" max="180" value="5">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-secondary w-full" id="t-set">Set</button>
          </div>
        </div>
        <p class="text-muted" style="margin-top:16px;font-size:12px">An alarm tone plays when the timer reaches 00:00</p>
      </div>`;
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

  return { render };
})();
