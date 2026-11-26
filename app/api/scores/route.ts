import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { durations, type NoteEvent } from '../../../music/score';
import type { SavedScore } from '../../../music/library';

export const runtime = 'nodejs';
const directory = resolve(/* turbopackIgnore: true */ process.env.SCORE_STORAGE_DIR || '.data/scores');
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const maxBytes = 10 * 1024 * 1024;
const failed = (detail: string, status: number) => Response.json({ detail }, { status });

function isSavedScore(value: SavedScore | null, id: string): value is SavedScore {
  const score = value?.score;
  return Boolean(value && ['简谱', '导入', '示例'].includes(value.origin) && typeof value.source === 'string' &&
    score && score.id === id && typeof score.title === 'string' && score.title.trim() && score.title.length <= 200 &&
    Number.isFinite(score.tempo) && score.tempo > 0 &&
    /^[A-G][#b]?m?$/.test(score.keySignature) && Number.isInteger(score.timeSignature?.numerator) &&
    score.timeSignature.numerator >= 1 && score.timeSignature.numerator <= 32 &&
    [1, 2, 4, 8, 16].includes(score.timeSignature.denominator) &&
    Array.isArray(score.measures) && score.measures.length >= 1 && score.measures.length <= 2000 &&
    score.measures.every((bar, index) => bar?.index === index && Array.isArray(bar.notes) && bar.notes.every((note: NoteEvent) =>
      note && typeof note.id === 'string' && (note.midi === null || (Number.isInteger(note.midi) && note.midi >= 0 && note.midi <= 127)) &&
      Object.hasOwn(durations, note.duration) && Number.isInteger(note.dots) && note.dots >= 0 && note.dots <= 2 &&
      (note.isTieStart === undefined || typeof note.isTieStart === 'boolean'))));
}

export async function GET() {
  try {
    await mkdir(directory, { recursive: true });
    const files = (await readdir(/* turbopackIgnore: true */ directory)).filter(file => file.endsWith('.json') && uuid.test(file.slice(0, -5)));
    const data = await Promise.all(files.map(async file => {
      try { return JSON.parse(await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ directory, file), 'utf8')) as SavedScore; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    }));
    return Response.json(data.filter(entry => entry !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return failed('服务器无法读取乐谱库。', 500);
  }
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!uuid.test(id)) return failed('乐谱编号无效。', 400);
  if (Number(request.headers.get('content-length')) > maxBytes) return failed('乐谱文件过大。', 413);
  let entry;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > maxBytes) return failed('乐谱文件过大。', 413);
    entry = JSON.parse(body);
  } catch { return failed('无法读取乐谱内容。', 400); }
  if (!isSavedScore(entry, id)) return failed('乐谱内容或曲名无效。', 422);
  const temp = join(directory, randomUUID() + '.tmp');
  const saved = { score: entry.score, source: entry.source, origin: entry.origin, updatedAt: new Date().toISOString() };
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temp, JSON.stringify(saved), { flag: 'wx' });
    await rename(temp, join(directory, id + '.json'));
    return Response.json(saved);
  } catch {
    await rm(temp, { force: true }).catch(() => undefined);
    return failed('服务器保存乐谱失败。', 500);
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!uuid.test(id)) return failed('乐谱编号无效。', 400);
  try {
    await rm(join(directory, id + '.json'), { force: true });
    return new Response(null, { status: 204 });
  } catch { return failed('服务器删除乐谱失败。', 500); }
}
