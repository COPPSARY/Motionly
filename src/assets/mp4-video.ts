import {
  DataStream,
  createFile,
  type MP4BoxBuffer,
  type Movie,
  type Sample,
  type VisualSampleEntry,
} from 'mp4box';

export interface DemuxedMp4Video {
  codec: string;
  width: number;
  height: number;
  duration: number;
  description?: Uint8Array<ArrayBuffer>;
  samples: Sample[];
}

export function demuxMp4(buffer: ArrayBuffer): Promise<DemuxedMp4Video> {
  return new Promise((resolve, reject) => {
    const file = createFile();
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    file.onError = (module, message) => fail(`${module}: ${message}`);
    file.onReady = (info: Movie) => {
      const track = info.videoTracks[0];
      if (!track) return fail('MP4 contains no video track');
      const samples: Sample[] = [];
      file.onSamples = (_id, _user, batch) => {
        samples.push(...batch);
        if (samples.length < track.nb_samples || settled) return;
        settled = true;
        resolve({
          codec: track.codec,
          width: track.video?.width ?? track.track_width,
          height: track.video?.height ?? track.track_height,
          duration: track.duration / track.timescale,
          description: decoderDescription(file, track.id),
          samples,
        });
      };
      file.setExtractionOptions(track.id, undefined, { nbSamples: track.nb_samples });
      file.start();
    };
    const data = buffer.slice(0) as MP4BoxBuffer;
    data.fileStart = 0;
    file.appendBuffer(data, true);
    file.flush();
  });
}

function decoderDescription(file: ReturnType<typeof createFile>, trackId: number) {
  const entry = file.getTrackById(trackId).mdia.minf.stbl.stsd.entries[0] as VisualSampleEntry;
  const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C;
  if (!box) return undefined;
  const stream = new DataStream();
  (box as unknown as { write(output: DataStream): void }).write(stream);
  return new Uint8Array(stream.buffer.slice(8));
}

export class Mp4FrameSource {
  readonly canvas: HTMLCanvasElement;
  private readonly decoder: VideoDecoder;
  private readonly config: VideoDecoderConfig;
  private readonly samples: Sample[];
  private readonly frames: VideoFrame[] = [];
  private current?: VideoFrame;
  private sampleIndex = 0;
  private lastTime = -1;
  private decoderError?: DOMException;

  static async create(video: DemuxedMp4Video): Promise<Mp4FrameSource> {
    if (typeof VideoDecoder === 'undefined')
      throw new Error('WebCodecs VideoDecoder is unavailable');
    const config: VideoDecoderConfig = {
      codec: video.codec,
      codedWidth: video.width,
      codedHeight: video.height,
      description: video.description,
    };
    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) throw new Error(`WebCodecs does not support ${video.codec}`);
    return new Mp4FrameSource(video, support.config ?? config);
  }

  private constructor(video: DemuxedMp4Video, config: VideoDecoderConfig) {
    this.samples = video.samples;
    this.config = config;
    this.canvas = document.createElement('canvas');
    this.canvas.width = video.width;
    this.canvas.height = video.height;
    this.decoder = new VideoDecoder({
      output: (frame) => this.frames.push(frame),
      error: (error) => (this.decoderError = error),
    });
    this.decoder.configure(config);
  }

  async renderAt(time: number): Promise<void> {
    const target = Math.max(0, time) * 1_000_000;
    if (this.lastTime < 0 || target < this.lastTime) this.restartAt(target);
    this.lastTime = target;
    await this.decodeThrough(target + 250_000);
    this.frames.sort((left, right) => left.timestamp - right.timestamp);
    while (this.frames[0] && this.frames[0].timestamp <= target) {
      this.current?.close();
      this.current = this.frames.shift();
    }
    if (!this.current && this.frames[0]) this.current = this.frames.shift();
    if (!this.current) throw new Error('WebCodecs produced no video frame');
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not create decoded video canvas');
    context.drawImage(this.current, 0, 0, this.canvas.width, this.canvas.height);
  }

  close(): void {
    this.current?.close();
    this.frames.splice(0).forEach((frame) => frame.close());
    this.decoder.close();
  }

  private restartAt(timestamp: number): void {
    this.current?.close();
    this.current = undefined;
    this.frames.splice(0).forEach((frame) => frame.close());
    this.decoder.reset();
    this.decoder.configure(this.config);
    const target = timestamp / 1_000_000;
    this.sampleIndex = 0;
    for (let index = 0; index < this.samples.length; index += 1) {
      const sample = this.samples[index]!;
      if (sample.cts / sample.timescale > target) break;
      if (sample.is_sync) this.sampleIndex = index;
    }
  }

  private async decodeThrough(timestamp: number): Promise<void> {
    let decoded = 0;
    while (this.sampleIndex < this.samples.length) {
      const sample = this.samples[this.sampleIndex]!;
      const sampleTime = (sample.cts / sample.timescale) * 1_000_000;
      if (decoded && sampleTime > timestamp) break;
      if (!sample.data) throw new Error('MP4 sample data is unavailable');
      this.decoder.decode(
        new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: sampleTime,
          duration: (sample.duration / sample.timescale) * 1_000_000,
          data: sample.data,
        })
      );
      this.sampleIndex += 1;
      decoded += 1;
    }
    if (decoded) await this.decoder.flush();
    if (this.decoderError) throw this.decoderError;
  }
}
