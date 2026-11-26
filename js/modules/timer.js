/**
 * Classroom Timer — large display + looping alarm until Stop
 */
const TimerModule = (() => {
  let total = 5 * 60;
  let remaining = 5 * 60;
  let running = false;
  let interval = null;
  let alarmInterval = null;
  let audioCtx = null;
  let alarming = false;

  function fmt(sec) {
    const s = Math.max(0, sec | 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function beepOnce() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      for (let i = 0; i < 2; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 880 : 1320;
        gain.gain.setValueAtTime(0.0001, now + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.22 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.22);
        osc.stop(now + i * 0.22 + 0.22);
      }
    } catch (e) {
      console.warn('beep', e);
    }
  }

  function startAlarm(container) {
    if (alarming) return;
    alarming = true;
    beepOnce();
    alarmInterval = setInterval(beepOnce, 900);
    const stopBtn = container.querySelector('#t-stop-alarm');
    if (stopBtn) stopBtn.style.display = '';
    toast('Time is up! Click Stop alarm to silence.', 'success');
  }

  function stopAlarm(container) {
    alarming = false;
    if (alarmInterval) clearInterval(alarmInterval);
    alarmInterval = null;
    const stopBtn = container.querySelector('#t-stop-alarm');
    if (stopBtn) stopBtn.style.display = 'none';
  }

  function pause() {
    running = false;
    if (interval) clearInterval(interval);
    interval = null;
  }

  function paint(container) {
    const display = container.querySelector('.timer-digits');
    const btn = container.querySelector('#t-start');
    if (display) {
      display.textContent = fmt(remaining);
      display.classList.toggle('urgent', remaining > 0 && remaining <= 60 || remaining === 0);
    }
    if (btn) btn.textContent = running ? 'Pause' : remaining === 0 ? 'Restart' : 'Start';
  }

  function start(container) {
    if (running) return;
    stopAlarm(container);
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
        startAlarm(container);
      }
      paint(container);
    }, 1000);
    paint(container);
  }

  function render(container) {
    stopAlarm(container);
    container.innerHTML = `
      <div class="timer-hero card" style="width:100%">
        <div class="card-title" style="justify-content:center;font-size:18px">Classroom Timer</div>
        <div class="timer-digits">${fmt(remaining)}</div>
        <div class="flex flex-wrap" style="justify-content:center;gap:10px;margin-bottom:16px">
          <button class="btn btn-primary" id="t-start" style="min-width:120px">Start</button>
          <button class="btn btn-secondary" id="t-reset">Reset</button>
          <button class="btn btn-primary" id="t-stop-alarm" style="display:none;background:var(--danger);min-width:140px">⏹ Stop alarm</button>
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
        <p class="text-muted" style="margin-top:16px;font-size:12px">Alarm loops at 00:00 until you press Stop alarm</p>
      </div>`;
    container.querySelector('#t-start').addEventListener('click', () => {
      if (running) pause();
      else start(container);
      paint(container);
    });
    container.querySelector('#t-reset').addEventListener('click', () => {
      pause();
      stopAlarm(container);
      remaining = total;
      paint(container);
    });
    container.querySelector('#t-stop-alarm').addEventListener('click', () => stopAlarm(container));
    container.querySelectorAll('.t-preset').forEach((b) => {
      b.addEventListener('click', () => {
        pause();
        stopAlarm(container);
        total = remaining = (+b.dataset.m) * 60;
        paint(container);
      });
    });
    container.querySelector('#t-set').addEventListener('click', () => {
      const m = Math.max(1, Math.min(180, +container.querySelector('#t-custom').value || 5));
      pause();
      stopAlarm(container);
      total = remaining = m * 60;
      paint(container);
    });
  }

  return { render };
})();
