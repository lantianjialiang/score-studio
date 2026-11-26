export const runtime = 'nodejs';

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length'));
  if (length > 11 * 1024 * 1024) return Response.json({ detail: '请上传不超过 10 MB 的图片。' }, { status: 413 });
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data;')) return Response.json({ detail: '请上传图片文件。' }, { status: 415 });

  const base = process.env.OMR_BACKEND_URL ?? 'http://127.0.0.1:8000';
  try {
    const response = await fetch(new URL('/recognize', base), {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: request.body,
      duplex: 'half',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(80000)]),
    } as RequestInit & { duplex: 'half' });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ detail: '无法连接图片识别服务，请确认 FastAPI 已启动。' }, { status: 503 });
  }
}