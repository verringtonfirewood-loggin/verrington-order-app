// src/lib/adminClientAuth.ts
export type AdminCreds = { username: string; password: string };

const KEY_USER = "vf_admin_user";
const KEY_PASS = "vf_admin_pass";

export function loadAdminCreds(): AdminCreds | null {
  if (typeof window === "undefined") return null;
  const username = window.sessionStorage.getItem(KEY_USER) || "";
  const password = window.sessionStorage.getItem(KEY_PASS) || "";
  if (!username || !password) return null;
  return { username, password };
}

export function saveAdminCreds(creds: AdminCreds) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY_USER, creds.username);
  window.sessionStorage.setItem(KEY_PASS, creds.password);
}

export function clearAdminCreds() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY_USER);
  window.sessionStorage.removeItem(KEY_PASS);
}

export function makeBasicAuthHeader(username: string, password: string) {
  const token = typeof window !== "undefined" ? window.btoa(`${username}:${password}`) : "";
  return `Basic ${token}`;
}

export async function adminFetch<T>(
  input: RequestInfo | URL,
  init: RequestInit & { username?: string; password?: string } = {}
): Promise<T> {
  const { username, password, ...rest } = init;

  let u = username || "";
  let p = password || "";

  if ((!u || !p) && typeof window !== "undefined") {
    const stored = loadAdminCreds();
    if (stored) {
      u = stored.username;
      p = stored.password;
    }
  }

  const headers = new Headers(rest.headers || {});
  if (u && p) headers.set("Authorization", makeBasicAuthHeader(u, p));

  const res = await fetch(input, { ...rest, headers });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error ? String(data.error) : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
