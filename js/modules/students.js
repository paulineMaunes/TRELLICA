/**
 * Students + Enrollment module
 */
const StudentsModule = (() => {
  function photoCircle(s, size) {
    const st = size || 36;
    if (s.photoDataUrl) {
      return `<div class="stu-avatar" style="width:${st}px;height:${st}px;background-image:url('${String(s.photoDataUrl).replace(/'/g, '')}')"></div>`;
    }
    const ini = ((s.firstName || '?')[0] || '') + ((s.lastName || '')[0] || '');
    return `<div class="stu-avatar" style="width:${st}px;height:${st}px">${escapeHtml(ini.toUpperCase())}</div>`;
  }

  function readPhotoFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (file.size > 2.5 * 1024 * 1024) {
        reject(new Error('Image must be under 2.5 MB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
  }

  let filter = '';
  let showInactive = false;

  function fullName(s) {
    return `${s.lastName || ''}, ${s.firstName || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
  }

  async function render(container) {
    const students = await BCDB.getAll('students');
    let list = students.slice();
    if (!showInactive) list = list.filter((s) => s.isActive !== false);
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter((s) =>
        fullName(s).toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q) ||
        (s.nfcNumber || '').toLowerCase().includes(q) ||
        (s.course || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => fullName(a).localeCompare(fullName(b), undefined, { sensitivity: 'base' }));

    container.innerHTML = `
      <div class="toolbar">
        <div class="search-box"><input type="search" id="stu-search" placeholder="Search name, ID, NFC…" value="${escapeAttr(filter)}"></div>
        <label class="flex" style="font-size:13px;font-weight:500;cursor:pointer">
          <input type="checkbox" id="stu-inactive" ${showInactive ? 'checked' : ''}> Show inactive
        </label>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="stu-add">+ Add Student</button>
      </div>
      <div class="card">
        <div class="card-title">
          <span>Students (${list.length})</span>
        </div>
        <div class="table-wrap">
          ${list.length === 0 ? `
            <div class="empty"><div class="big">👥</div><p>No students yet. Add your first student.</p></div>
          ` : `
            <table class="data">
              <thead>
                <tr>
                  <th></th><th>Name</th>
                  <th>Student #</th>
                  <th>NFC / ID</th>
                  <th>Course</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${list.map((s) => `
                  <tr class="${s.isActive === false ? 'inactive' : ''}" data-id="${s.id}">
                    <td>${photoCircle(s, 40)}</td>
                    <td><strong>${escapeHtml(fullName(s))}</strong>${s.nickName ? ` <span class="text-muted">(${escapeHtml(s.nickName)})</span>` : ''}</td>
                    <td>${escapeHtml(s.studentNumber || '—')}</td>
                    <td>${escapeHtml(s.nfcNumber || s.studentId || '—')}</td>
                    <td>${escapeHtml(s.course || '—')}</td>
                    <td>${escapeHtml(s.email || '—')}</td>
                    <td>${s.isActive === false ? '<span class="badge badge-inactive">Inactive</span>' : '<span class="badge badge-active">Active</span>'}</td>
                    <td>
                      <button class="btn btn-sm btn-secondary stu-edit" data-id="${s.id}">Edit</button>
                      <button class="btn btn-sm btn-secondary stu-enroll" data-id="${s.id}">Enroll</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

    container.querySelector('#stu-search').addEventListener('input', (e) => {
      filter = e.target.value;
      render(container);
    });
    container.querySelector('#stu-inactive').addEventListener('change', (e) => {
      showInactive = e.target.checked;
      render(container);
    });
    container.querySelector('#stu-add').addEventListener('click', () => openForm(null, container));
    container.querySelectorAll('.stu-edit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const s = await BCDB.getById('students', +btn.dataset.id);
        openForm(s, container);
      });
    });
    container.querySelectorAll('.stu-enroll').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const s = await BCDB.getById('students', +btn.dataset.id);
        openEnroll(s, container);
      });
    });
  }

  function openForm(student, container) {
    const isNew = !student;
    const s = student || {
      firstName: '', lastName: '', nickName: '', gender: '', age: '',
      course: '', yearLevel: '', section: '', studentId: '', studentNumber: '',
      nfcNumber: '', contactNumber: '', email: '', alternateEmail: '',
      address: '', guardianName: '', guardianContact: '', medicalNotes: '',
      scholarshipStatus: '', remarks: '', isActive: true
    };

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header">
          <h2>${isNew ? 'Add Student' : 'Edit Student'}</h2>
          <button class="btn-icon modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Last Name *</label><input id="f-last" value="${escapeAttr(s.lastName)}" required></div>
            <div class="form-group"><label>First Name *</label><input id="f-first" value="${escapeAttr(s.firstName)}" required></div>
            <div class="form-group"><label>Nickname</label><input id="f-nick" value="${escapeAttr(s.nickName)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Gender</label>
              <select id="f-gender">
                <option value="">—</option>
                <option ${s.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option ${s.gender === 'Male' ? 'selected' : ''}>Male</option>
              </select>
            </div>
            <div class="form-group"><label>Age</label><input id="f-age" value="${escapeAttr(s.age)}"></div>
            <div class="form-group"><label>Course</label><input id="f-course" value="${escapeAttr(s.course)}" placeholder="e.g. BSIS2"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Year Level</label><input id="f-year" value="${escapeAttr(s.yearLevel)}"></div>
            <div class="form-group"><label>Section</label><input id="f-section" value="${escapeAttr(s.section)}"></div>
            <div class="form-group"><label>Scholarship</label><input id="f-schol" value="${escapeAttr(s.scholarshipStatus)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Student ID (school)</label><input id="f-sid" value="${escapeAttr(s.studentId)}"></div>
            <div class="form-group"><label>Student Number</label><input id="f-snum" value="${escapeAttr(s.studentNumber)}"></div>
            <div class="form-group"><label>NFC Number</label><input id="f-nfc" value="${escapeAttr(s.nfcNumber)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Contact</label><input id="f-contact" value="${escapeAttr(s.contactNumber)}"></div>
            <div class="form-group"><label>Email</label><input id="f-email" type="email" value="${escapeAttr(s.email)}"></div>
            <div class="form-group"><label>Alt. Email</label><input id="f-aemail" type="email" value="${escapeAttr(s.alternateEmail)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Guardian Name</label><input id="f-gname" value="${escapeAttr(s.guardianName)}"></div>
            <div class="form-group"><label>Guardian Contact</label><input id="f-gcontact" value="${escapeAttr(s.guardianContact)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="grid-column:1/-1"><label>Address</label><input id="f-addr" value="${escapeAttr(s.address)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="grid-column:1/-1"><label>Medical Notes</label><textarea id="f-med" rows="2">${escapeHtml(s.medicalNotes || '')}</textarea></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="grid-column:1/-1"><label>Remarks</label><textarea id="f-remarks" rows="2">${escapeHtml(s.remarks || '')}</textarea></div>
          </div>
          ${!isNew ? `
            <div class="form-row">
              <div class="form-group">
                <label>Status</label>
                <select id="f-active">
                  <option value="1" ${s.isActive !== false ? 'selected' : ''}>Active</option>
                  <option value="0" ${s.isActive === false ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          ${!isNew ? '<button class="btn btn-danger" id="f-delete">Delete</button>' : ''}
          <div class="spacer" style="flex:1"></div>
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="f-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();
    backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    
    let pendingPhoto = s.photoDataUrl || '';
    const preview = backdrop.querySelector('#f-photo-preview');
    function setPreview(dataUrl) {
      pendingPhoto = dataUrl || '';
      if (dataUrl) {
        preview.style.backgroundImage = `url('${dataUrl.replace(/'/g, '')}')`;
        preview.textContent = '';
      } else {
        preview.style.backgroundImage = '';
        preview.textContent = ((s.firstName || '?')[0] || '') + ((s.lastName || '')[0] || '');
      }
    }
    async function onPhoto(file) {
      try {
        const data = await readPhotoFile(file);
        setPreview(data);
      } catch (err) {
        toast(err.message || 'Photo failed', 'error');
      }
    }
    backdrop.querySelector('#f-photo-file')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) onPhoto(f);
      e.target.value = '';
    });
    backdrop.querySelector('#f-photo-cam')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) onPhoto(f);
      e.target.value = '';
    });
    backdrop.querySelector('#f-photo-clear')?.addEventListener('click', () => setPreview(''));

    backdrop.querySelector('#f-save').addEventListener('click', async () => {
      const last = backdrop.querySelector('#f-last').value.trim();
      const first = backdrop.querySelector('#f-first').value.trim();
      if (!last || !first) {
        toast('Last name and first name are required', 'error');
        return;
      }
      const now = new Date().toISOString();
      const record = {
        id: isNew ? await BCDB.nextId('students') : s.id,
        lastName: last,
        firstName: first,
        nickName: backdrop.querySelector('#f-nick').value.trim(),
        gender: backdrop.querySelector('#f-gender').value,
        age: backdrop.querySelector('#f-age').value.trim(),
        course: backdrop.querySelector('#f-course').value.trim(),
        yearLevel: backdrop.querySelector('#f-year').value.trim(),
        section: backdrop.querySelector('#f-section').value.trim(),
        studentId: backdrop.querySelector('#f-sid').value.trim(),
        studentNumber: backdrop.querySelector('#f-snum').value.trim(),
        nfcNumber: backdrop.querySelector('#f-nfc').value.trim(),
        contactNumber: backdrop.querySelector('#f-contact').value.trim(),
        email: backdrop.querySelector('#f-email').value.trim(),
        alternateEmail: backdrop.querySelector('#f-aemail').value.trim(),
        address: backdrop.querySelector('#f-addr').value.trim(),
        guardianName: backdrop.querySelector('#f-gname').value.trim(),
        guardianContact: backdrop.querySelector('#f-gcontact').value.trim(),
        medicalNotes: backdrop.querySelector('#f-med').value.trim(),
        remarks: backdrop.querySelector('#f-remarks').value.trim(),
        scholarshipStatus: backdrop.querySelector('#f-schol').value.trim(),
        isActive: isNew ? true : backdrop.querySelector('#f-active').value === '1',
        createdAt: s.createdAt || now,
        updatedAt: now,
        photoPath: s.photoPath || '',
        photoDataUrl: (typeof pendingPhoto !== 'undefined' ? pendingPhoto : s.photoDataUrl) || ''
      };
      await BCDB.put('students', record);
      toast(isNew ? 'Student added' : 'Student updated', 'success');
      close();
      render(container);
      Sync.queueChange('students', record);
    });

    if (!isNew) {
      backdrop.querySelector('#f-delete').addEventListener('click', async () => {
        if (!confirm(`Permanently delete ${fullName(s)} and their enrollments?`)) return;
        // Hard delete enrollments (matches desktop)
        const enrs = await BCDB.getAll('enrollments');
        for (const e of enrs.filter((x) => x.studentId === s.id)) {
          await BCDB.remove('enrollments', e.id);
        }
        await BCDB.remove('students', s.id);
        toast('Student deleted', 'success');
        close();
        render(container);
        Sync.queueChange('students', { id: s.id, _deleted: true });
      });
    }
  }

  async function openEnroll(student, container) {
    const subjects = (await BCDB.getAll('subjects')).filter((s) => s.isActive !== false);
    const enrollments = await BCDB.getAll('enrollments');
    const enrolledIds = new Set(enrollments.filter((e) => e.studentId === student.id).map((e) => e.subjectId));

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>Enroll — ${escapeHtml(fullName(student))}</h2>
          <button class="btn-icon modal-close">✕</button>
        </div>
        <div class="modal-body">
          ${subjects.length === 0 ? '<p class="text-muted">No active subjects. Create subjects first.</p>' : `
            <p class="text-muted" style="margin-bottom:12px">Select subjects to enroll this student in.</p>
            <div id="enroll-list" style="display:flex;flex-direction:column;gap:8px">
              ${subjects.map((sub) => `
                <label class="flex" style="padding:10px;border:1px solid var(--border);border-radius:8px;cursor:pointer">
                  <input type="checkbox" data-sid="${sub.id}" ${enrolledIds.has(sub.id) ? 'checked' : ''}>
                  <span><strong>${escapeHtml(sub.code || '')}</strong> — ${escapeHtml(sub.name || '')}
                    <span class="text-muted">(${escapeHtml(sub.semester || '')} ${escapeHtml(sub.academicYear || '')})</span>
                  </span>
                </label>
              `).join('')}
            </div>
          `}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="enroll-save" ${subjects.length === 0 ? 'disabled' : ''}>Save Enrollment</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', close));

    backdrop.querySelector('#enroll-save')?.addEventListener('click', async () => {
      const checks = backdrop.querySelectorAll('#enroll-list input[type=checkbox]');
      const wanted = new Set();
      checks.forEach((c) => { if (c.checked) wanted.add(+c.dataset.sid); });

      // Remove unenrolled
      for (const e of enrollments.filter((x) => x.studentId === student.id)) {
        if (!wanted.has(e.subjectId)) {
          await BCDB.remove('enrollments', e.id);
        }
      }
      // Add new
      for (const sid of wanted) {
        if (!enrolledIds.has(sid)) {
          const id = await BCDB.nextId('enrollments');
          await BCDB.put('enrollments', { id, studentId: student.id, subjectId: sid });
        }
      }
      toast('Enrollment updated', 'success');
      close();
      Sync.queueChange('enrollments', { studentId: student.id });
    });
  }

  return { render, fullName };
})();
