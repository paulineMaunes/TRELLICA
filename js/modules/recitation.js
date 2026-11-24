/**
 * Recitation + Duck Race style random picker
 */
const RecitationModule = (() => {
  let selectedSubjectId = null;
  let pool = []; // student ids in current race
  let racing = false;

  async function render(container) {
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    if (!selectedSubjectId && subjects.length) selectedSubjectId = subjects[0].id;
    const subject = subjects.find((s) => s.id === selectedSubjectId);

    const enrollments = await BCDB.getAll('enrollments');
    const students = await BCDB.getAll('students');
    const points = await BCDB.getAll('recitation');

    const enrolledIds = enrollments.filter((e) => e.subjectId === selectedSubjectId).map((e) => e.studentId);
    let enrolled = students.filter((s) => enrolledIds.includes(s.id) && s.isActive !== false);
    enrolled.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));

    // Points leaderboard for this subject
    const subjectName = subject?.name || subject?.code || '';
    const pointsByStudent = {};
    points
      .filter((p) => !p.subject || p.subject === subjectName || p.subjectId === selectedSubjectId)
      .forEach((p) => {
        pointsByStudent[p.studentId] = (pointsByStudent[p.studentId] || 0) + (p.points || 0);
      });

    const leaderboard = enrolled
      .map((s) => ({ student: s, pts: pointsByStudent[s.id] || 0 }))
      .sort((a, b) => b.pts - a.pts);

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:200px">
          <label>Subject</label>
          <select id="rec-subject">
            ${subjects.length === 0 ? '<option>No subjects</option>' :
              subjects.map((s) => `<option value="${s.id}" ${s.id === selectedSubjectId ? 'selected' : ''}>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="rec-reset-pool">Reset pool</button>
        <button class="btn btn-primary" id="rec-race" ${enrolled.length < 1 ? 'disabled' : ''}>🦆 Start Duck Race</button>
        <button class="btn btn-secondary" id="rec-pick" ${enrolled.length < 1 ? 'disabled' : ''}>Random Pick</button>
      </div>

      <div class="card">
        <div class="card-title">Duck Race Arena</div>
        <div class="race-arena" id="race-arena">
          <div class="race-finish"></div>
          <div id="race-lanes" style="position:relative;height:100%;min-height:200px"></div>
        </div>
        <div id="race-result"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <div class="card-title">Class roster (tap to toggle in pool)</div>
          <div id="rec-roster" style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto">
            ${enrolled.length === 0 ? '<p class="text-muted">No enrolled students.</p>' :
              enrolled.map((s) => {
                const inPool = pool.includes(s.id);
                return `
                  <label class="flex" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:${inPool ? 'var(--lavender)' : 'transparent'}">
                    <input type="checkbox" class="pool-check" data-id="${s.id}" ${inPool ? 'checked' : ''}>
                    <span style="flex:1">${escapeHtml(StudentsModule.fullName(s))}</span>
                    <span class="badge badge-active">${pointsByStudent[s.id] || 0} pts</span>
                  </label>
                `;
              }).join('')}
          </div>
          <div class="mt-8 flex">
            <button class="btn btn-sm btn-secondary" id="rec-all">Select all</button>
            <button class="btn btn-sm btn-secondary" id="rec-none">Clear</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Leaderboard</div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>#</th><th>Student</th><th>Points</th><th></th></tr></thead>
              <tbody>
                ${leaderboard.length === 0 ? '<tr><td colspan="4" class="text-muted">—</td></tr>' :
                  leaderboard.map((row, i) => `
                    <tr>
                      <td>${i + 1}</td>
                      <td>${escapeHtml(StudentsModule.fullName(row.student))}</td>
                      <td><strong>${row.pts}</strong></td>
                      <td><button class="btn btn-sm btn-primary add-pt" data-id="${row.student.id}">+1</button></td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#rec-subject').addEventListener('change', (e) => {
      selectedSubjectId = +e.target.value || null;
      pool = [];
      render(container);
    });

    container.querySelectorAll('.pool-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = +cb.dataset.id;
        if (cb.checked) {
          if (!pool.includes(id)) pool.push(id);
        } else {
          pool = pool.filter((x) => x !== id);
        }
        render(container);
      });
    });
    container.querySelector('#rec-all')?.addEventListener('click', () => {
      pool = enrolled.map((s) => s.id);
      render(container);
    });
    container.querySelector('#rec-none')?.addEventListener('click', () => {
      pool = [];
      render(container);
    });
    container.querySelector('#rec-reset-pool')?.addEventListener('click', () => {
      pool = enrolled.map((s) => s.id);
      render(container);
      toast('Pool reset to full class', 'success');
    });

    container.querySelectorAll('.add-pt').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await addPoints(+btn.dataset.id, 1, subject);
        render(container);
      });
    });

    container.querySelector('#rec-pick')?.addEventListener('click', async () => {
      const ids = pool.length ? pool : enrolled.map((s) => s.id);
      if (!ids.length) return;
      const winnerId = ids[Math.floor(Math.random() * ids.length)];
      const winner = enrolled.find((s) => s.id === winnerId);
      showWinner(container, winner, subject);
      // remove from pool so they don't get picked again immediately
      pool = pool.filter((x) => x !== winnerId);
    });

    container.querySelector('#rec-race')?.addEventListener('click', () => {
      const ids = pool.length ? pool : enrolled.map((s) => s.id);
      if (ids.length < 1) return;
      runRace(container, ids.map((id) => enrolled.find((s) => s.id === id)).filter(Boolean), subject);
    });
  }

  function showWinner(container, winner, subject) {
    const result = container.querySelector('#race-result');
    if (!result || !winner) return;
    result.innerHTML = `
      <div class="picked-card mt-16">
        <div style="font-size:40px">🎯</div>
        <div class="name">${escapeHtml(StudentsModule.fullName(winner))}</div>
        <div class="sub">${winner.nickName ? escapeHtml(winner.nickName) + ' · ' : ''}${escapeHtml(winner.course || '')}</div>
        <div class="flex mt-16" style="justify-content:center">
          <button class="btn btn-success" id="award-1">+1 Point</button>
          <button class="btn btn-primary" id="award-2">+2 Points</button>
          <button class="btn btn-secondary" id="award-3">+3 Points</button>
        </div>
      </div>
    `;
    result.querySelector('#award-1').addEventListener('click', async () => {
      await addPoints(winner.id, 1, subject);
      toast('+1 point awarded', 'success');
      render(container);
    });
    result.querySelector('#award-2').addEventListener('click', async () => {
      await addPoints(winner.id, 2, subject);
      toast('+2 points awarded', 'success');
      render(container);
    });
    result.querySelector('#award-3').addEventListener('click', async () => {
      await addPoints(winner.id, 3, subject);
      toast('+3 points awarded', 'success');
      render(container);
    });
  }

  function runRace(container, racers, subject) {
    if (racing || racers.length < 1) return;
    racing = true;
    const arena = container.querySelector('#race-lanes');
    const result = container.querySelector('#race-result');
    result.innerHTML = '';
    const h = Math.max(200, racers.length * 48);
    arena.style.minHeight = h + 'px';
    arena.innerHTML = '';

    const ducks = racers.map((s, i) => {
      const el = document.createElement('div');
      el.className = 'duck';
      el.style.top = (i * 48 + 8) + 'px';
      el.style.left = '8px';
      el.textContent = `🦆 ${StudentsModule.fullName(s).split(',')[0]}`;
      el.dataset.id = s.id;
      arena.appendChild(el);
      return { el, student: s, progress: 0 };
    });

    // finish line is ~ right: 40px, so race distance ~ arena width - 100
    const arenaWidth = arena.parentElement.clientWidth || 600;
    const finishAt = arenaWidth - 90;

    const speeds = ducks.map(() => 0.4 + Math.random() * 0.9);
    let frame = 0;
    const maxFrames = 90 + Math.floor(Math.random() * 40);

    function tick() {
      frame++;
      let winner = null;
      ducks.forEach((d, i) => {
        d.progress += speeds[i] * (2 + Math.random());
        // slight random boost
        if (Math.random() < 0.05) d.progress += 3;
        const left = Math.min(finishAt, 8 + (d.progress / 100) * (finishAt - 8));
        d.el.style.left = left + 'px';
        if (left >= finishAt - 2 && !winner) winner = d;
      });

      if (winner || frame >= maxFrames) {
        // ensure a winner
        if (!winner) {
          winner = ducks.reduce((a, b) => (a.progress > b.progress ? a : b));
        }
        winner.el.classList.add('winner');
        winner.el.style.left = finishAt + 'px';
        racing = false;
        // remove from pool
        pool = pool.filter((x) => x !== winner.student.id);
        showWinner(container, winner.student, subject);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  async function addPoints(studentId, pts, subject) {
    const record = {
      id: await BCDB.nextId('recitation'),
      studentId,
      points: pts,
      notes: '',
      subject: subject?.name || subject?.code || '',
      subjectId: selectedSubjectId,
      recordedAt: new Date().toISOString()
    };
    await BCDB.put('recitation', record);
    Sync.queueChange('recitation', record);
  }

  return { render };
})();
