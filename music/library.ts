import type { ScoreDocument } from './score';

export type SavedScore = {
  score: ScoreDocument;
  source: string;
  origin: '简谱' | '导入' | '示例';
  updatedAt: string;
};

export async function libraryRequest<T = void>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init).catch(() => { throw new Error('无法连接服务器乐谱库。'); });
  const result = response.status === 204 ? undefined : await response.json().catch(() => null);
  if (!response.ok || result === null) throw new Error(typeof result?.detail === 'string' ? result.detail : '服务器乐谱库暂不可用。');
  return result as T;
}
