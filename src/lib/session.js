const ADMIN_SESSION_KEY = 'df_admin_session';
const USER_PHONE_KEY = 'df_user_phone';

export function getAdminSession() {
  const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setAdminSession(session) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function getUserPhone() {
  return sessionStorage.getItem(USER_PHONE_KEY);
}

export function setUserPhone(phone) {
  sessionStorage.setItem(USER_PHONE_KEY, phone);
}

export function clearUserPhone() {
  sessionStorage.removeItem(USER_PHONE_KEY);
}
