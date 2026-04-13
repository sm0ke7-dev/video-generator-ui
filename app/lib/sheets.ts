export const SHEET_GIDS = {
  TITLE: 0,
  AUDIO: 133642313,
  FINAL_OUTPUT: 1677247627,
  KEYWORDS: 1758979414,
  VIDEO_CLIPS: 1869172958,
  CAPTIONS: 204559524,
  CONTROL_PANEL: 204732952,
  BG_MUSIC: 480985891,
  PHONETIC_TEXT: 774757930,
  MAKE_VIDEO_FLAGS: 889953456,
} as const;

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

const GID_TO_NAME: Record<number, string> = {
  [SHEET_GIDS.TITLE]: 'Business Data',
  [SHEET_GIDS.AUDIO]: 'Audio',
  [SHEET_GIDS.FINAL_OUTPUT]: 'pasteBoard',
  [SHEET_GIDS.KEYWORDS]: 'Content Generator',
  [SHEET_GIDS.VIDEO_CLIPS]: 'Video',
  [SHEET_GIDS.CAPTIONS]: 'Text',
  [SHEET_GIDS.CONTROL_PANEL]: 'start_button',
  [SHEET_GIDS.BG_MUSIC]: 'bgAudio',
  [SHEET_GIDS.PHONETIC_TEXT]: 'Phonetic Text',
  [SHEET_GIDS.MAKE_VIDEO_FLAGS]: 'start_button',
};

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function base64UrlEncode(data: ArrayBuffer | string): string {
  let str: string;
  if (typeof data === 'string') {
    str = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    str = btoa(s);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_JSON env var not set');
  const key: ServiceAccountKey = JSON.parse(keyJson);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encClaims = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encHeader}.${encClaims}`;

  const pk = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(key.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    pk,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token fetch failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };

  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

async function sheetsFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${pathname}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
  return res;
}

export async function getSheetData(
  sheetName: string,
  range = 'A:ZZ',
  spreadsheetId = SPREADSHEET_ID
): Promise<string[][]> {
  const encoded = encodeURIComponent(`${sheetName}!${range}`);
  const res = await sheetsFetch(`${spreadsheetId}/values/${encoded}`);
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

export async function getSheetDataByGid(gid: number, range = 'A:ZZ'): Promise<string[][]> {
  const name = GID_TO_NAME[gid];
  if (!name) throw new Error(`No sheet name mapped for GID ${gid}`);
  return getSheetData(name, range);
}

export async function writeSheetData(
  sheetName: string,
  range: string,
  values: string[][],
  spreadsheetId = SPREADSHEET_ID
): Promise<void> {
  const encoded = encodeURIComponent(`${sheetName}!${range}`);
  await sheetsFetch(
    `${spreadsheetId}/values/${encoded}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values }) }
  );
}

export async function getSheetNames(): Promise<{ title: string; sheetId: number }[]> {
  const res = await sheetsFetch(`${SPREADSHEET_ID}?fields=sheets.properties`);
  const data = (await res.json()) as {
    sheets?: { properties?: { title?: string; sheetId?: number } }[];
  };
  return (data.sheets ?? []).map((s) => ({
    title: s.properties?.title ?? '',
    sheetId: s.properties?.sheetId ?? 0,
  }));
}
