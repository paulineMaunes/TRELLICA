/**
 * BeepCheck Pro — IndexedDB offline store
 * Stores: students, subjects, enrollments, schedules, attendance, categories, grades, recitation, settings, syncQueue
 */
const DB_NAME = 'BeepCheckPro';
const DB_VERSION = 2;

const STORES = [
  'students',
  'subjects',
  'enrollments',
  'schedules',
  'attendance',
  'categories',
  'grades',
  'recitation',
  'settings',
  'syncQueue',
  'seating',
  'groupSets',
  'calendarEvents',
  'todos',
  'peerSessions',
  'peerRatings',
  'behavior',
  'stickyNotes',
  'reminders'
];

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id', autoIncrement: false });
          if (name === 'students') {
            store.createIndex('studentId', 'studentId', { unique: false });
            store.createIndex('nfcNumber', 'nfcNumber', { unique: false });
            store.createIndex('isActive', 'isActive', { unique: false });
          }
          if (name === 'attendance') {
            store.createIndex('byStudentDate', ['studentId', 'classDate'], { unique: false });
            store.createIndex('bySubjectDate', ['subject', 'classDate'], { unique: false });
          }
          if (name === 'grades') {
            store.createIndex('byStudentCat', ['studentId', 'categoryId'], { unique: false });
          }
          if (name === 'enrollments') {
            store.createIndex('bySubject', 'subjectId', { unique: false });
            store.createIndex('byStudent', 'studentId', { unique: false });
          }
          if (name === 'schedules') {
            store.createIndex('bySubject', 'subjectId', { unique: false });
          }
        }
      });
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function put(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

async function putMany(storeName, records) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach((r) => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function remove(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function nextId(storeName) {
  const all = await getAll(storeName);
  if (!all.length) return 1;
  return Math.max(...all.map((x) => x.id || 0)) + 1;
}

/** Export all data as a single JSON blob (for backup / Drive sync) */
async function exportAll() {
  const data = {};
  for (const name of STORES) {
    if (name === 'syncQueue') continue;
    data[name] = await getAll(name);
  }
  data.exportedAt = new Date().toISOString();
  data.version = 1;
  return data;
}

/** Import a full JSON backup (merge or replace) */
async function importAll(data, { replace = false } = {}) {
  for (const name of STORES) {
    if (name === 'syncQueue' || !data[name]) continue;
    if (replace) await clearStore(name);
    await putMany(name, data[name]);
  }
}

/** Seed default grade categories + optional seed.json students/subjects */
async function ensureDefaults() {
  // One-time seed from /data/seed.json when students empty
  const existingStudents = await getAll('students');
  if (existingStudents.length === 0) {
    try {
      const res = await fetch('./data/seed.json', { cache: 'no-store' });
      if (res.ok) {
        const seed = await res.json();
        for (const key of ['students', 'subjects', 'enrollments', 'schedules', 'calendarEvents']) {
          if (Array.isArray(seed[key]) && seed[key].length) {
            await putMany(key, seed[key]);
          }
        }
        console.log('Seeded from data/seed.json');
      }
    } catch (e) {
      console.warn('Seed load skipped', e);
    }
  }

  const cats = await getAll('categories');
  if (cats.length === 0) {
    const defaults = [
      { id: 1, name: 'Recitation', weight: 0.1, period: 'Midterm', maxItems: 1, itemMaxScore: 100, itemMaxScores: '', sortOrder: 1, isActive: true, subject: '' },
      { id: 2, name: 'Assignment/Activity', weight: 0.15, period: 'Midterm', maxItems: 2, itemMaxScore: 100, itemMaxScores: '', sortOrder: 2, isActive: true, subject: '' },
      { id: 3, name: 'Quizzes', weight: 0.15, period: 'Midterm', maxItems: 3, itemMaxScore: 100, itemMaxScores: '', sortOrder: 3, isActive: true, subject: '' },
      { id: 4, name: 'Project', weight: 0.2, period: 'Midterm', maxItems: 1, itemMaxScore: 100, itemMaxScores: '', sortOrder: 4, isActive: true, subject: '' },
      { id: 5, name: 'Attendance', weight: 0, period: 'Midterm', maxItems: 1, itemMaxScore: 100, itemMaxScores: '', sortOrder: 5, isActive: true, subject: '' },
      { id: 6, name: 'Midterm Exam', weight: 0.4, period: 'Midterm', maxItems: 1, itemMaxScore: 100, itemMaxScores: '', sortOrder: 6, isActive: true, subject: '' },
      { id: 7, name: 'Recitation', weight: 0.1, period: 'Finals', maxItems: 3, itemMaxScore: 100, itemMaxScores: '', sortOrder: 7, isActive: true, subject: '' },
      { id: 8, name: 'Assignment/Activity', weight: 0.15, period: 'Finals', maxItems: 2, itemMaxScore: 100, itemMaxScores: '', sortOrder: 8, isActive: true, subject: '' },
      { id: 9, name: 'Quizzes', weight: 0.15, period: 'Finals', maxItems: 3, itemMaxScore: 100, itemMaxScores: '', sortOrder: 9, isActive: true, subject: '' },
      { id: 10, name: 'Project', weight: 0.2, period: 'Finals', maxItems: 1, itemMaxScore: 100, itemMaxScores: '', sortOrder: 10, isActive: true, subject: '' },
      { id: 11, name: 'Attendance', weight: 0, period: 'Finals', maxItems: 1, itemMaxScore: 100, itemMaxScores: '', sortOrder: 11, isActive: true, subject: '' },
      { id: 12, name: 'Final Exam', weight: 0.4, period: 'Finals', maxItems: 1, itemMaxScore: 100, itemMaxScores: '', sortOrder: 12, isActive: true, subject: '' }
    ];
    await putMany('categories', defaults);
  }

  const settings = await getAll('settings');
  if (settings.length === 0) {
    await put('settings', { id: 1, key: 'app', passcode: '1234', lastSync: null, driveFolderId: null });
  }

  // Seed students from bundled CSV-derived JSON (once)
  const existingStudents = await getAll('students');
  if (existingStudents.length === 0) {
    try {
      const res = await fetch('./data/students-seed.json');
      if (res.ok) {
        const list = await res.json();
        await putMany('students', list);
      }
    } catch (e) { console.warn('student seed', e); }
  }

  // Seed subjects
  const existingSubjects = await getAll('subjects');
  if (existingSubjects.length === 0) {
    try {
      const res = await fetch('./data/subjects-seed.json');
      if (res.ok) {
        const list = await res.json();
        await putMany('subjects', list);
      }
    } catch (e) { console.warn('subject seed', e); }
  }
}

window.BCDB = {
  openDB, getAll, getById, put, putMany, remove, clearStore, nextId,
  exportAll, importAll, ensureDefaults, STORES
};
