const EMPLOYEE_PASSWORD_PREFIX = "TAPIN_EMPLOYEE_PASSWORD_";
const EMPLOYEE_SESSION_PREFIX = "TAPIN_EMPLOYEE_SESSION_";
const EMPLOYEE_LOGIN_GUARD_PREFIX = "TAPIN_EMPLOYEE_LOGIN_GUARD_";

function employeeCredential_(employeeId) {
  const raw = PropertiesService.getScriptProperties().getProperty(EMPLOYEE_PASSWORD_PREFIX + employeeId);
  return raw ? JSON.parse(raw) : null;
}

function handleEmployeeSetupPassword_(request, runtimeConfig) {
  return integrityLock_(function () {
    const employee = requireEmployeeByDevice_(runtimeConfig, request.deviceUUID);
    if (employeeCredential_(employee.employeeId)) throw new Error("Password is already set. Please sign in");
    const password = String(request.password == null ? "" : request.password);
    if (password.length < 8 || password.length > 128) throw new Error("Password must be between 8 and 128 characters");
    if (password !== request.confirmPassword) throw new Error("Passwords do not match");
    const salt = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    const hash = EmployeePassword.derive(sha256Hex_(password), salt);
    PropertiesService.getScriptProperties().setProperty(EMPLOYEE_PASSWORD_PREFIX + employee.employeeId, JSON.stringify({ algorithm: "scrypt-sha256-v1", salt: salt, hash: hash }));
    return jsonResponse_(true, "Password set. Please sign in again", { requiresPasswordSetup: false, isAuthenticated: false });
  });
}

function handleEmployeeLogin_(request, runtimeConfig) {
  return integrityLock_(function () {
    const employee = requireEmployeeByDevice_(runtimeConfig, request.deviceUUID);
    checkEmployeeLoginAllowed_(employee.employeeId);
    const credential = employeeCredential_(employee.employeeId);
    if (!credential) throw new Error("Set your password before signing in");
    const password = String(request.password == null ? "" : request.password);
    const validLength = password.length >= 8 && password.length <= 128;
    const hash = validLength ? EmployeePassword.derive(sha256Hex_(password), credential.salt) : "";
    if (credential.algorithm !== "scrypt-sha256-v1" || !constantTimeEqual_(hash, credential.hash)) {
      recordEmployeeLoginFailure_(employee.employeeId);
      return jsonResponse_(false, "Incorrect password");
    }
    PropertiesService.getScriptProperties().deleteProperty(EMPLOYEE_LOGIN_GUARD_PREFIX + employee.employeeId);
    const session = createEmployeeSession_(employee, request.deviceUUID);
    return jsonResponse_(true, "Signed in", { token: session.token, expiresAt: session.expiresAt, employeeName: employee.name, deviceUUID: employee.deviceUUID, isRegistered: true, isAuthenticated: true, requiresPasswordSetup: false });
  });
}

function employeeLoginGuard_(employeeId) {
  const raw = PropertiesService.getScriptProperties().getProperty(EMPLOYEE_LOGIN_GUARD_PREFIX + employeeId);
  return raw ? JSON.parse(raw) : { count: 0, firstFailedAt: Date.now(), lockedUntil: 0 };
}

function checkEmployeeLoginAllowed_(employeeId) {
  if (employeeLoginGuard_(employeeId).lockedUntil > Date.now()) throw new Error("Too many failed attempts. Please try again later");
}

function recordEmployeeLoginFailure_(employeeId) {
  const now = Date.now();
  const lockMs = DEFAULT_CONFIG.ADMIN_LOGIN_LOCK_MINUTES * 60 * 1000;
  const current = employeeLoginGuard_(employeeId);
  const expired = current.firstFailedAt < now - lockMs;
  const count = expired ? 1 : current.count + 1;
  PropertiesService.getScriptProperties().setProperty(EMPLOYEE_LOGIN_GUARD_PREFIX + employeeId, JSON.stringify({
    count: count, firstFailedAt: expired ? now : current.firstFailedAt,
    lockedUntil: count >= DEFAULT_CONFIG.ADMIN_LOGIN_MAX_FAILURES ? now + lockMs : 0
  }));
}

function constantTimeEqual_(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function employeeSession_(employeeId) {
  const raw = PropertiesService.getScriptProperties().getProperty(EMPLOYEE_SESSION_PREFIX + employeeId);
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (!session || typeof session.token !== "string" || !session.deviceUUID || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
  return session;
}

function createEmployeeSession_(employee, deviceUUID) {
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const expiresAt = Date.now() + DEFAULT_CONFIG.ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  PropertiesService.getScriptProperties().setProperty(EMPLOYEE_SESSION_PREFIX + employee.employeeId, JSON.stringify({ token: token, deviceUUID: normalizeText_(deviceUUID), expiresAt: expiresAt }));
  return { token: token, expiresAt: new Date(expiresAt).toISOString() };
}

function requireEmployeeSession_(request, runtimeConfig) {
  const token = normalizeText_(request.employeeToken);
  if (!token) throw new Error("Please sign in with your password. Employee session is required");
  const employee = requireEmployeeByDevice_(runtimeConfig, request.deviceUUID);
  const session = employeeSession_(employee.employeeId);
  if (!session || !constantTimeEqual_(session.token, token) || session.deviceUUID !== normalizeText_(request.deviceUUID)) throw new Error("Employee session expired. Please sign in again");
  return employee;
}

function handleEmployeeLogout_(request, runtimeConfig) {
  return integrityLock_(function () {
    let employee;
    try { employee = requireEmployeeByDevice_(runtimeConfig, request.deviceUUID); } catch (_error) {
      return jsonResponse_(true, "Signed out");
    }
    const token = normalizeText_(request.employeeToken);
    const session = employeeSession_(employee.employeeId);
    if (session && constantTimeEqual_(session.token, token) && session.deviceUUID === normalizeText_(request.deviceUUID)) {
      PropertiesService.getScriptProperties().deleteProperty(EMPLOYEE_SESSION_PREFIX + employee.employeeId);
    }
    return jsonResponse_(true, "Signed out");
  });
}
