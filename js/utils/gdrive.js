import { showToast } from './toast.js';
import { GDRIVE_CLIENT_ID } from '../config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'ganaderia-backup.json';
const LS_CONNECTED = 'gdrive_connected';
const LS_LAST_SYNC = 'gdrive_last_sync';

// Cliente interactivo (popup en PC/Android, redirect en iOS PWA)
let _tokenClient = null;
// Cliente silencioso (siempre popup/iframe — funciona en todos los contextos)
let _silentClient = null;
let _accessToken = null;

// ── Setup ──────────────────────────────────────────────────────────────────

export function gdriveIsConfigured() {
  return !!GDRIVE_CLIENT_ID;
}

export function gdriveHasSavedConnection() {
  return localStorage.getItem(LS_CONNECTED) === '1';
}

export function gdriveIsAuthenticated() {
  return !!_accessToken;
}

export function gdriveGetLastSync() {
  return localStorage.getItem(LS_LAST_SYNC);
}

function isIOSStandalone() {
  return !!navigator.standalone;
}

async function loadGIS() {
  if (window.google?.accounts?.oauth2) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function gdriveInit() {
  if (!GDRIVE_CLIENT_ID) return;
  await loadGIS();

  // Cliente silencioso: siempre popup (usa iframe oculto, no bloquea)
  _silentClient = google.accounts.oauth2.initTokenClient({
    client_id: GDRIVE_CLIENT_ID,
    scope: SCOPE,
    callback: () => {}
  });

  // Cliente interactivo: redirect en iOS PWA (evita bloqueo de popups)
  const ios = isIOSStandalone();
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GDRIVE_CLIENT_ID,
    scope: SCOPE,
    ux_mode: ios ? 'redirect' : 'popup',
    redirect_uri: ios ? (window.location.origin + window.location.pathname) : undefined,
    callback: () => {}
  });
}

// Extrae el token del hash de la URL tras redirect OAuth en iOS
export function gdriveHandleRedirectToken() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token=')) return false;
  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  if (!token) return false;
  _accessToken = token;
  localStorage.setItem(LS_CONNECTED, '1');
  history.replaceState(null, '', window.location.pathname);
  return true;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function gdriveSignIn() {
  if (isIOSStandalone()) {
    localStorage.setItem(LS_CONNECTED, '1');
    _tokenClient.requestAccessToken({ prompt: 'select_account' });
    return; // página redirige a Google — el Promise nunca resuelve
  }
  await new Promise((resolve, reject) => {
    _tokenClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      _accessToken = resp.access_token;
      resolve();
    };
    _tokenClient.error_callback = (err) => reject(new Error(err.type ?? 'error'));
    _tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
  localStorage.setItem(LS_CONNECTED, '1');
}

export async function gdriveSignInSilent() {
  // Usa siempre el cliente popup para silent auth (iframe, nunca redirige)
  await new Promise((resolve, reject) => {
    _silentClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      _accessToken = resp.access_token;
      resolve();
    };
    _silentClient.error_callback = (err) => reject(new Error(err.type ?? 'error'));
    _silentClient.requestAccessToken({ prompt: '' });
  });
}

export function gdriveSignOut() {
  if (_accessToken) google.accounts.oauth2.revoke(_accessToken, () => {});
  _accessToken = null;
  localStorage.removeItem(LS_CONNECTED);
  localStorage.removeItem(LS_LAST_SYNC);
}

// ── Drive REST API ─────────────────────────────────────────────────────────

async function driveGet(path) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${_accessToken}` }
  });
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  return r.json();
}

async function findBackupFile() {
  const d = await driveGet(
    `files?spaces=appDataFolder&q=name%3D'${BACKUP_FILENAME}'&fields=files(id,modifiedTime)`
  );
  return d.files?.[0] ?? null;
}

export async function gdriveGetFileInfo() {
  return findBackupFile();
}

export async function gdriveUpload(data) {
  const content = JSON.stringify(data);
  const file = await findBackupFile();

  let r;
  if (file) {
    r = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${_accessToken}`,
          'Content-Type': 'application/json'
        },
        body: content
      }
    );
  } else {
    const boundary = 'gb1';
    const meta = JSON.stringify({ name: BACKUP_FILENAME, parents: ['appDataFolder'] });
    const body = [
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      meta,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      content,
      `--${boundary}--`
    ].join('\r\n');
    r = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_accessToken}`,
          'Content-Type': 'multipart/related; boundary=gb1'
        },
        body
      }
    );
  }

  if (!r.ok) throw new Error(`Drive upload ${r.status}`);
  localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
}

export async function gdriveDownload() {
  const file = await findBackupFile();
  if (!file) return null;
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${_accessToken}` } }
  );
  if (!r.ok) throw new Error(`Drive download ${r.status}`);
  const data = await r.json();
  localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
  return { data, modifiedTime: file.modifiedTime };
}

// ── Auto-sync ──────────────────────────────────────────────────────────────

export async function gdriveAutoSync(importAllFn, exportAllFn) {
  if (!gdriveIsConfigured() || !gdriveHasSavedConnection() || !_silentClient) return;

  // Si ya tenemos token (p.ej. tras redirect iOS) no hace falta auth silencioso
  if (!_accessToken) {
    try {
      await gdriveSignInSilent();
    } catch {
      return;
    }
  }

  try {
    const file = await findBackupFile();

    if (!file) {
      const data = await exportAllFn();
      await gdriveUpload(data);
      showToast('Backup inicial subido a Drive');
      return;
    }

    const lastSync = localStorage.getItem(LS_LAST_SYNC);
    const driveNewer = !lastSync || new Date(file.modifiedTime) > new Date(lastSync);

    if (driveNewer) {
      const result = await gdriveDownload();
      if (result) {
        await importAllFn(result.data);
        showToast('Datos sincronizados desde Drive');
      }
    } else {
      const data = await exportAllFn();
      await gdriveUpload(data);
    }
  } catch (e) {
    console.error('Drive auto-sync error:', e);
  }
}
