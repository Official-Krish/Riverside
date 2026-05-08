const TOKEN_KEY = "weave-token";
const NAME_KEY = "weave-name";

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredName() {
  return window.localStorage.getItem(NAME_KEY);
}

export function setStoredName(name: string) {
  const trimmedName = name.trim();

  if (trimmedName) {
    window.localStorage.setItem(NAME_KEY, trimmedName);
  } else {
    window.localStorage.removeItem(NAME_KEY);
  }

  window.dispatchEvent(new Event("weave-auth-changed"));
}

export function persistAuth(token: string, name?: string | null) {
  window.localStorage.setItem(TOKEN_KEY, token);

  if (name && name.trim()) {
    window.localStorage.setItem(NAME_KEY, name.trim());
  } else {
    window.localStorage.removeItem(NAME_KEY);
  }

  window.dispatchEvent(new Event("weave-auth-changed"));
}

export function clearStoredAuth() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(NAME_KEY);
  window.dispatchEvent(new Event("weave-auth-changed"));
  window.location.href = "/";
}
