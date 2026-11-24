/**
 * QR Code helper — student card / attendance check-in payload
 * Uses online QR image API when available; always shows copyable payload offline.
 */
const QrModule = (() => {
  let selectedStudentId = null;

  async function render(container) {
    const students = (await BCDB.getAll('students')).filter((s) => s.isActive !== false);
    students.sort((a, b) => StudentsModule.fullName(a).localeCompare(StudentsModule.fullName(b)));
    if (!selectedStudentId && students.length) selectedStudentId = students[0].id;
    const s = students.find((x) => x.id === selectedStudentId);

    const payload = s
      ? JSON.stringify({
          app: 'BeepCheckPro',
          studentId: s.studentId || s.nfcNumber || String(s.id),
          nfc: s.nfcNumber || '',
          name: StudentsModule.fullName(s),
          course: s.course || ''
        })
      : '';

    const qrUrl = payload
      ? 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(payload)
      : '';

    container.innerHTML = `
      <div class="toolbar">
        <div class="form-group" style="margin:0;min-width:240px">
          <label>Student</label>
          <select id="qr-stu">
            ${students.map((x) => `<option value="${x.id}" ${x.id === selectedStudentId ? 'selected' : ''}>${escapeHtml(StudentsModule.fullName(x))}</option>`).join('') || '<option>No students</option>'}
          </select>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="qr-copy" ${!payload ? 'disabled' : ''}>Copy payload</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card" style="text-align:center">
          <div class="card-title">Student QR</div>
          ${qrUrl ? `<img src="${qrUrl}" alt="QR" width="220" height="220" style="border:1px solid var(--border);border-radius:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
            <p class="text-muted" style="display:none">QR image needs internet. Payload below still works offline.</p>` : '<p class="text-muted">Select a student</p>'}
          <p class="text-muted mt-8" style="font-size:12px">Scan encodes student ID / NFC for attendance tools.</p>
        </div>
        <div class="card">
          <div class="card-title">Payload (offline-safe)</div>
          <pre id="qr-payload" style="background:var(--bg);padding:12px;border-radius:8px;font-size:12px;overflow:auto;white-space:pre-wrap">${escapeHtml(payload)}</pre>
          <div class="card-title mt-16">Quick attendance link text</div>
          <p class="text-muted" style="font-size:13px">
            ${s ? `BeepCheck · ${escapeHtml(StudentsModule.fullName(s))} · ${escapeHtml(s.nfcNumber || s.studentId || String(s.id))}` : '—'}
          </p>
        </div>
      </div>
      <div class="card mt-16">
        <div class="card-title">Class check-in code</div>
        <p class="text-muted" style="margin-bottom:12px;font-size:13px">Generate a one-time code students can type or scan for today's session (stored locally).</p>
        <div class="flex">
          <button class="btn btn-primary" id="qr-session">Generate session code</button>
          <span id="qr-session-code" style="font-size:24px;font-weight:700;letter-spacing:4px;color:var(--accent)"></span>
        </div>
      </div>
    `;

    container.querySelector('#qr-stu').addEventListener('change', (e) => {
      selectedStudentId = +e.target.value || null;
      render(container);
    });
    container.querySelector('#qr-copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(payload);
        toast('Copied', 'success');
      } catch {
        toast('Copy failed', 'error');
      }
    });
    container.querySelector('#qr-session').addEventListener('click', () => {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      container.querySelector('#qr-session-code').textContent = code;
      sessionStorage.setItem('bc_session_code', code);
      sessionStorage.setItem('bc_session_at', new Date().toISOString());
      toast('Session code: ' + code, 'success');
    });
  }

  return { render };
})();
