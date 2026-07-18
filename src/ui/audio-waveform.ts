export interface AudioPeak {
  min: number;
  max: number;
}

export const MAX_WAVEFORM_BUCKETS = 4096;

export function waveformBucketCount(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 64;
  return Math.min(MAX_WAVEFORM_BUCKETS, Math.max(64, Math.ceil(duration * 80)));
}

export async function extractAudioPeaks(
  channels: readonly Float32Array[],
  requestedBuckets: number,
  cancelled: () => boolean = () => false
): Promise<AudioPeak[]> {
  if (cancelled() || channels.length === 0) return [];
  const length = Math.min(...channels.map((channel) => channel.length));
  if (length === 0) return [];
  const bucketCount = Math.min(
    length,
    MAX_WAVEFORM_BUCKETS,
    Math.max(1, Math.floor(requestedBuckets))
  );
  const peaks: AudioPeak[] = [];
  let highest = 0;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    if (bucket > 0 && bucket % 64 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (cancelled()) return [];
    }
    const start = Math.floor((bucket * length) / bucketCount);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) * length) / bucketCount));
    let min = 1;
    let max = -1;
    for (const channel of channels) {
      for (let sample = start; sample < end; sample += 1) {
        const value = channel[sample] ?? 0;
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }
    highest = Math.max(highest, Math.abs(min), Math.abs(max));
    peaks.push({ min, max });
  }

  if (highest <= Number.EPSILON) return peaks.map(() => ({ min: 0, max: 0 }));
  return peaks.map(({ min, max }) => ({ min: min / highest, max: max / highest }));
}

export function waveformPath(peaks: readonly AudioPeak[], height = 24): string {
  if (peaks.length === 0) return '';
  const center = height / 2;
  const amplitude = Math.max(0, center - 1);
  const point = (index: number, value: number) =>
    `${index + 0.5} ${(center - value * amplitude).toFixed(2)}`;
  const upper = peaks.map((peak, index) => point(index, peak.max));
  const lower = peaks.map((peak, index) => point(index, peak.min)).reverse();
  return `M${upper.join('L')}L${lower.join('L')}Z`;
}
