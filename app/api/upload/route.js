import { put } from '@vercel/blob';

const MAX_BYTES = 3 * 1024 * 1024; // 3MB safety ceiling (compressed photos are far smaller)

export async function POST(req) {
  const { dataUrl } = await req.json();
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return Response.json({ error: 'No valid image data provided.' }, { status: 400 });
  }
  const base64 = dataUrl.split(',')[1];
  if (!base64) return Response.json({ error: 'Malformed image data.' }, { status: 400 });

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_BYTES) {
    return Response.json({ error: 'Image too large.' }, { status: 400 });
  }

  const filename = `nominees/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const blob = await put(filename, buffer, {
    access: 'public',
    contentType: 'image/jpeg',
  });

  return Response.json({ url: blob.url });
}
