/**
 * Roles & account allow-list for Trellica
 */
const Roles = (() => {
  const SUPERADMIN = 'joanepauline.maunes@laverdad.edu.ph';
  const ROLE = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    INSTRUCTOR: 'instructor',
    STUDENT: 'student'
  };

  const EXTRA_ALLOWED = {
    'joanepauline.maunes@laverdad.edu.ph': ROLE.SUPERADMIN,
    'maunes.pauline@gmail.com': ROLE.ADMIN,
    'pauline.maunes@gmail.com': ROLE.STUDENT
  };

  const DEFAULT_DOMAINS = ['student.laverdad.edu.ph', 'laverdad.edu.ph'];

  function norm(email) {
    return String(email || '').trim().toLowerCase();
  }

  function isDomainAllowed(email) {
    const d = norm(email).split('@')[1] || '';
    return DEFAULT_DOMAINS.some((x) => d === x || d.endsWith('.' + x));
  }

  function isExtraAllowed(email) {
    return !!EXTRA_ALLOWED[norm(email)];
  }

  function isAllowedEmail(email) {
    const e = norm(email);
    if (!e) return false;
    return isDomainAllowed(e) || isExtraAllowed(e);
  }

  function roleOfSync(email) {
    const e = norm(email);
    if (!e) return null;
    if (EXTRA_ALLOWED[e]) return EXTRA_ALLOWED[e];
    if (e.endsWith('@student.laverdad.edu.ph')) return ROLE.STUDENT;
    if (e.endsWith('@laverdad.edu.ph')) return ROLE.INSTRUCTOR;
    return null;
  }

  async function getMembersMap() {
    const map = { ...EXTRA_ALLOWED };
    try {
      if (window.BCDB && BCDB.getAll) {
        const settings = await BCDB.getAll('settings');
        const s = settings.find((x) => x.key === 'app') || settings[0];
        if (s && Array.isArray(s.members)) {
          s.members.forEach((m) => {
            if (m.email) map[norm(m.email)] = m.role || ROLE.INSTRUCTOR;
          });
        }
      }
    } catch (_) {}
    map[SUPERADMIN] = ROLE.SUPERADMIN;
    return map;
  }

  async function roleOf(email) {
    const e = norm(email);
    if (!e) return null;
    // Built-in map first (works before DB is open)
    if (EXTRA_ALLOWED[e]) return EXTRA_ALLOWED[e];
    try {
      const map = await getMembersMap();
      if (map[e]) return map[e];
    } catch (_) {}
    return roleOfSync(e);
  }

  function isStaff(role) {
    return role === ROLE.SUPERADMIN || role === ROLE.ADMIN || role === ROLE.INSTRUCTOR;
  }

  async function addMember(email, role) {
    const e = norm(email);
    if (!e) throw new Error('Email required');
    if (!isAllowedEmail(e) && !isDomainAllowed(e)) {
      if (!isDomainAllowed(e) && !isExtraAllowed(e)) {
        throw new Error('Email must be @laverdad.edu.ph, @student.laverdad.edu.ph, or a listed test account');
      }
    }
    const allowedRoles = [ROLE.ADMIN, ROLE.INSTRUCTOR, ROLE.STUDENT];
    if (!allowedRoles.includes(role) && role !== ROLE.SUPERADMIN) {
      throw new Error('Invalid role');
    }
    if (e === SUPERADMIN) throw new Error('Cannot change superadmin');
    const settings = await BCDB.getAll('settings');
    let s = settings.find((x) => x.key === 'app') || settings[0];
    if (!s) s = { id: 1, key: 'app' };
    if (!Array.isArray(s.members)) s.members = [];
    const i = s.members.findIndex((m) => norm(m.email) === e);
    if (i >= 0) s.members[i] = { email: e, role };
    else s.members.push({ email: e, role });
    await BCDB.put('settings', s);
    return s.members;
  }

  async function removeMember(email) {
    const e = norm(email);
    if (e === SUPERADMIN) throw new Error('Cannot remove superadmin');
    const settings = await BCDB.getAll('settings');
    let s = settings.find((x) => x.key === 'app') || settings[0];
    if (!s || !Array.isArray(s.members)) return [];
    s.members = s.members.filter((m) => norm(m.email) !== e);
    await BCDB.put('settings', s);
    return s.members;
  }

  return {
    SUPERADMIN,
    ROLE,
    EXTRA_ALLOWED,
    DEFAULT_DOMAINS,
    norm,
    isAllowedEmail,
    isDomainAllowed,
    roleOf,
    roleOfSync,
    isStaff,
    getMembersMap,
    addMember,
    removeMember
  };
})();
window.Roles = Roles;
