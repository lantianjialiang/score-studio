import { createVoice, timeline, type Voice } from './playback';
import type { ScoreDocument } from './score';

export async function exportMp3(score: ScoreDocument, speed: number, voice: Voice) {
  const { events, length } = timeline(score.measures);
  const unit = 60 / (score.tempo * speed);
  const seconds = length * unit;
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('乐谱没有可导出的时长。');
  if (seconds > 1200) throw new Error('按当前速度导出的音频超过 20 分钟。请提高速度后重试。');
  const [Tone, { Mp3Encoder }] = await Promise.all([import('tone'), import('@breezystack/lamejs')]);
  const sampleRate = 44100;
  const context = new Tone.OfflineContext(1, seconds + 0.5, sampleRate);
  const instrument = createVoice(Tone, context, voice);
  let timer: number | undefined;
  try {
    await Promise.race([instrument.ready, new Promise<void>(resolve => {
      timer = window.setTimeout(() => { instrument.disablePendingSamples(); resolve(); }, 8000);
    })]);
    if (timer !== undefined) window.clearTimeout(timer);
    for (const { note, offset, length, continuation } of events) {
      if (note.midi !== null && !continuation) instrument.play(note.midi, length * unit * .98, .035 + offset * unit);
    }
    const buffer = await context.render();
    const samples = buffer.getChannelData(0);
    const encoder = new Mp3Encoder(1, sampleRate, 128);
    const frames: BlobPart[] = [];
    const blockSize = 1152;
    const pcm = new Int16Array(blockSize);
    for (let start = 0; start < samples.length; start += blockSize) {
      const count = Math.min(blockSize, samples.length - start);
      for (let i = 0; i < count; i++) {
        const value = Math.max(-1, Math.min(1, samples[start + i]));
        pcm[i] = Math.round(value * (value < 0 ? 32768 : 32767));
      }
      const frame = encoder.encodeBuffer(pcm.subarray(0, count));
      if (frame.length) frames.push(new Uint8Array(frame));
      if (start % (blockSize * 96) === 0) await new Promise(resolve => window.setTimeout(resolve, 0));
    }
    frames.push(new Uint8Array(encoder.flush()));
    return new Blob(frames, { type: 'audio/mpeg' });
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
    instrument.dispose();
    context.dispose();
  }
}
