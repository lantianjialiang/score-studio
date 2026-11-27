import type { ScoreDocument } from './score';
import { basePath, staticPages } from './deployment';

export type SavedScore = {
  score: ScoreDocument;
  source: string;
  origin: '简谱' | '导入' | '示例';
  updatedAt: string;
};

const storageKey = 'score-studio:scores:' + basePath;

function readBrowserScores(): SavedScore[] {
  const entries: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (!Array.isArray(entries)) throw new Error('无法读取当前浏览器的乐谱库。');
  return entries;
}

function writeBrowserScores(entries: SavedScore[]) {
  try { localStorage.setItem(storageKey, JSON.stringify(entries)); }
  catch { throw new Error('无法保存到浏览器。请检查存储权限或可用空间。'); }
}

export async function listScores(signal?: AbortSignal) {
  signal?.throwIfAborted();
  return staticPages ? readBrowserScores() : libraryRequest<SavedScore[]>('/api/scores', { signal, cache: 'no-store' });
}

export async function putScore(entry: Omit<SavedScore, 'updatedAt'>) {
  if (!staticPages) return libraryRequest<SavedScore>('/api/scores?id=' + entry.score.id, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entry),
  });
  const saved = { ...entry, updatedAt: new Date().toISOString() };
  writeBrowserScores([saved, ...readBrowserScores().filter(item => item.score.id !== entry.score.id)]);
  return saved;
}

export async function removeScore(id: string) {
  if (!staticPages) return libraryRequest('/api/scores?id=' + id, { method: 'DELETE' });
  writeBrowserScores(readBrowserScores().filter(item => item.score.id !== id));
}

async function libraryRequest<T = void>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init).catch(() => { throw new Error('无法连接服务器乐谱库。'); });
  const result = response.status === 204 ? undefined : await response.json().catch(() => null);
  if (!response.ok || result === null) throw new Error(typeof result?.detail === 'string' ? result.detail : '服务器乐谱库暂不可用。');
  return result as T;
}
