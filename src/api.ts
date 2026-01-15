import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from './auth';

const API_BASE = process.env.API_BASE || 'http://10.0.2.2:3000';

async function authHeaders() {
  const token = await getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function apiGET(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPOST(path: string, body: any) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function presignUpload(filename: string, content_type: string, size: number) {
  return apiPOST('/api/v1/firmwares/presign', { filename, content_type, size });
}
