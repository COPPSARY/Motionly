import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const jobs = new Map();
const MAX_FRAME_BYTES = 100 * 1024 * 1024;
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;

/** Handle an export request in the standalone npm CLI server. */
export async function handleFfmpegExportRequest(request, response) {
  const url = new URL(request.url ?? '/', 'http://motionly.local');
  if (!url.pathname.startsWith('/api/exports')) return false;

  try {
    await handleExportRequest(request, response, url);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : new Error(String(error)));
    } else {
      response.statusCode = 500;
      response.setHeader('content-type', 'text/plain;charset=utf-8');
      response.end(error instanceof Error ? error.message : String(error));
    }
  }
  return true;
}

/** Connect-compatible middleware used by the Vite development and preview servers. */
export function createFfmpegExportMiddleware() {
  return (request, response, next) => {
    void handleFfmpegExportRequest(request, response).then((handled) => {
      if (!handled) next();
    }, next);
  };
}

async function handleExportRequest(request, response, url) {
  if (url.pathname === '/api/exports/ffmpeg') {
    if (request.method === 'GET') {
      respond(response, (await ffmpegAvailable()) ? 204 : 503, '');
      return;
    }
    if (request.method === 'POST') {
      if (
        request.headers['x-motionly-action'] !== 'install-ffmpeg' ||
        !sameOrigin(request)
      ) {
        respond(response, 403, 'FFmpeg installation was not authorized');
        return;
      }
      await installFfmpeg();
      if (await ffmpegAvailable()) {
        respond(response, 204, '');
      } else {
        respond(
          response,
          202,
          'FFmpeg was installed, but Motionly must be restarted so the updated PATH is available.'
        );
      }
      return;
    }
    respond(response, 405, 'Method not allowed');
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/exports') {
    await createJob(request, response);
    return;
  }
  const match = /^\/api\/exports\/([a-z0-9-]+)(?:\/(frames\/(\d+)|audio(?:\/(\d+))?|finish))?$/.exec(
    url.pathname
  );
  if (!match) return respond(response, 404, 'Unknown export endpoint');
  const id = match[1];
  const action = match[2];
  if (!id) return respond(response, 404, 'Unknown export job');
  const job = jobs.get(id);
  if (!job) return respond(response, 404, 'Export job not found');

  if (request.method === 'DELETE' && !action) {
    if (job.ffmpeg) {
      job.ffmpeg.kill();
    } else {
      jobs.delete(id);
      await rm(job.directory, { recursive: true, force: true });
    }
    respond(response, 204);
    return;
  }

  if (request.method === 'PUT' && action?.startsWith('frames/')) {
    const index = Number(match[3]);
    if (!Number.isInteger(index) || index < 0 || index >= job.totalFrames) {
      return respond(response, 409, `Invalid frame ${index}`);
    }
    if (job.receivedFrames.has(index)) return respond(response, 409, `Duplicate frame ${index}`);
    if (request.headers['content-type'] !== 'image/jpeg') {
      return respond(response, 415, 'Export frames must be JPEG images');
    }
    await writeRequest(
      request,
      join(job.directory, `frame-${String(index).padStart(8, '0')}.jpg`),
      MAX_FRAME_BYTES
    );
    job.receivedFrames.add(index);
    respond(response, 204);
    return;
  }

  if (request.method === 'PUT' && action?.startsWith('audio')) {
    // `/audio` is the pre-multitrack path and means the first (only) clip.
    const index = match[4] === undefined ? 0 : Number(match[4]);
    if (!Number.isInteger(index) || index < 0 || index >= job.audioClips.length) {
      return respond(response, 409, `This export has no audio clip ${index}`);
    }
    await writeRequest(request, join(job.directory, `audio-${index}`), MAX_AUDIO_BYTES);
    job.receivedAudio.add(index);
    respond(response, 204);
    return;
  }

  if (request.method === 'POST' && action === 'finish') {
    if (job.receivedFrames.size !== job.totalFrames) {
      return respond(
        response,
        409,
        `Missing ${job.totalFrames - job.receivedFrames.size} export frames`
      );
    }
    if (job.receivedAudio.size !== job.audioClips.length) {
      return respond(
        response,
        409,
        `Missing ${job.audioClips.length - job.receivedAudio.size} audio clip uploads`
      );
    }
    await finishJob(id, job, response);
    return;
  }

  respond(response, 405, 'Method not allowed');
}

async function createJob(request, response) {
  const input = JSON.parse((await readRequest(request, 64 * 1024)).toString('utf8'));
  positiveInteger(input.width, 'width', 8192);
  positiveInteger(input.height, 'height', 8192);
  const fps = positiveNumber(input.fps, 'fps', 240);
  const duration = positiveNumber(input.duration, 'duration', 24 * 60 * 60);
  const totalFrames = positiveInteger(input.totalFrames, 'totalFrames', 24 * 60 * 60 * 240);
  const quality = input.quality ?? 'high';
  if (!['low', 'medium', 'high', 'very-high'].includes(quality)) {
    throw new Error('Invalid export quality');
  }
  const bitrateMbps = positiveNumber(input.bitrateMbps ?? 10, 'bitrate', 200);
  const audioClips = normalizeAudioClips(input, duration);
  const expectedFrames = Math.max(1, Math.ceil(duration * fps));
  if (totalFrames !== expectedFrames) throw new Error(`Expected ${expectedFrames} frames`);
  const id = randomUUID();
  const directory = await mkdtemp(join(tmpdir(), 'motionly-export-'));
  jobs.set(id, {
    directory,
    fps,
    duration,
    totalFrames,
    quality,
    bitrateMbps,
    receivedFrames: new Set(),
    audioClips,
    receivedAudio: new Set(),
  });
  response.statusCode = 201;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ id }));
}

async function finishJob(id, job, response) {
  const outputPath = join(job.directory, 'motionly.mp4');
  const framePattern = join(job.directory, 'frame-%08d.jpg');
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-framerate',
    String(job.fps),
    '-start_number',
    '0',
    '-i',
    framePattern,
  ];
  for (let index = 0; index < job.audioClips.length; index += 1) {
    args.push('-i', join(job.directory, `audio-${index}`));
  }
  args.push('-map', '0:v:0');
  const mix = audioMixFilter(job.audioClips);
  if (mix) {
    args.push('-filter_complex', mix, '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  }
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    String(job.quality === 'low' ? 28 : job.quality === 'medium' ? 23 : job.quality === 'high' ? 18 : 15),
    '-maxrate',
    `${job.bitrateMbps}M`,
    '-bufsize',
    `${job.bitrateMbps * 2}M`,
    '-vf',
    'pad=ceil(iw/2)*2:ceil(ih/2)*2:color=black,format=yuv420p',
    '-frames:v',
    String(job.totalFrames),
    '-t',
    String(job.duration),
    '-movflags',
    '+faststart',
    outputPath
  );

  try {
    await runFfmpeg(args, job);
    const output = await stat(outputPath);
    response.statusCode = 200;
    response.setHeader('content-type', 'video/mp4');
    response.setHeader('content-length', String(output.size));
    await pipeline(createReadStream(outputPath), response);
  } finally {
    jobs.delete(id);
    await rm(job.directory, { recursive: true, force: true });
  }
}

function runFfmpeg(args, job) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true });
    if (job) job.ffmpeg = child;
    let errorOutput = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      errorOutput = `${errorOutput}${chunk}`.slice(-16_384);
    });
    child.once('error', (error) => {
      reject(
        error.code === 'ENOENT'
          ? new Error('ffmpeg is not installed or is not available on PATH')
          : error
      );
    });
    child.once('close', (code) => {
      if (job) job.ffmpeg = null;
      if (code === 0) resolve();
      else reject(new Error(errorOutput.trim() || `ffmpeg exited with code ${String(code)}`));
    });
  });
}

async function ffmpegAvailable() {
  try {
    await runFfmpeg(['-version']);
    return true;
  } catch {
    return false;
  }
}

async function installFfmpeg() {
  let command;
  let args;
  let interactive = false;
  if (process.platform === 'win32') {
    command = 'winget';
    args = [
      'install',
      '--id',
      'Gyan.FFmpeg',
      '--exact',
      '--silent',
      '--accept-package-agreements',
      '--accept-source-agreements',
    ];
  } else if (process.platform === 'darwin') {
    command = 'brew';
    args = ['install', 'ffmpeg'];
  } else if (process.platform === 'linux') {
    const managers = [
      ['apt-get', ['install', '-y', 'ffmpeg']],
      ['dnf', ['install', '-y', 'ffmpeg']],
      ['yum', ['install', '-y', 'ffmpeg']],
      ['pacman', ['-S', '--noconfirm', 'ffmpeg']],
      ['zypper', ['--non-interactive', 'install', 'ffmpeg']],
      ['apk', ['add', 'ffmpeg']],
    ];
    const selected = await firstAvailable(managers);
    if (!selected) throw new Error('No supported Linux package manager was found');
    [command, args] = selected;
    if (typeof process.getuid === 'function' && process.getuid() !== 0) {
      if (await commandAvailable('pkexec')) {
        args = [command, ...args];
        command = 'pkexec';
      } else {
        args = [command, ...args];
        command = 'sudo';
        interactive = true;
      }
    }
  } else {
    throw new Error(`Automatic FFmpeg installation is not supported on ${process.platform}`);
  }
  try {
    await runCommand(command, args, interactive);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Automatic FFmpeg installation failed: ${detail}. Install FFmpeg manually, add ffmpeg to PATH, then restart Motionly.`
    );
  }
}

async function firstAvailable(options) {
  for (const [command, args] of options) {
    if (await commandAvailable(command)) return [command, args];
  }
  return null;
}

async function commandAvailable(command) {
  try {
    await runCommand(command, ['--version']);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args, interactive = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: interactive ? 'inherit' : 'pipe',
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) {
      stream?.setEncoding('utf8');
      stream?.on('data', (chunk) => {
        output = `${output}${chunk}`.slice(-16_384);
      });
    }
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(output.trim() || `${command} exited with code ${String(code)}`));
    });
  });
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

async function writeRequest(request, path, maxBytes) {
  let size = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.byteLength;
      callback(size > maxBytes ? new Error('Export upload is too large') : null, chunk);
    },
  });
  try {
    await pipeline(request, limiter, createWriteStream(path));
  } catch (error) {
    await rm(path, { force: true });
    throw error;
  }
}

async function readRequest(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) throw new Error('Export upload is too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Read the audio clip list, tolerating the pre-multitrack `hasAudio` shape so an
 * older editor build served by this CLI still exports its single audio track.
 */
export function normalizeAudioClips(input, duration) {
  const raw = Array.isArray(input.audioClips)
    ? input.audioClips
    : input.hasAudio === true
      ? [{ start: input.audioStart ?? 0 }]
      : [];
  if (raw.length > 64) throw new Error('Too many audio clips');
  return raw.map((clip, index) => {
    const start = nonNegativeNumber(clip.start ?? 0, `audioClips[${index}].start`, duration);
    return {
      start,
      // A clip without a duration plays to the end of the project, which is
      // what the single background track used to do.
      duration:
        clip.duration === undefined
          ? Math.max(0, duration - start)
          : nonNegativeNumber(clip.duration, `audioClips[${index}].duration`, duration),
      trimIn: nonNegativeNumber(clip.trimIn ?? 0, `audioClips[${index}].trimIn`, 24 * 60 * 60),
      fadeIn: nonNegativeNumber(clip.fadeIn ?? 0, `audioClips[${index}].fadeIn`, duration),
      fadeOut: nonNegativeNumber(clip.fadeOut ?? 0, `audioClips[${index}].fadeOut`, duration),
      // Preview clamps element volume to 1, so the export must not boost
      // either. Clamp rather than reject: a loud value should not fail a render.
      volume: Math.min(
        1,
        nonNegativeNumber(clip.volume ?? 1, `audioClips[${index}].volume`, 64)
      ),
      speed: Math.min(16, Math.max(0.0625, positiveNumber(clip.speed ?? 1, `audioClips[${index}].speed`, 16))),
    };
  });
}

/** ffmpeg only accepts atempo between 0.5 and 2, so extreme rates are chained. */
function tempoFilters(speed) {
  const factors = [];
  let remaining = speed;
  while (remaining > 2) {
    factors.push(2);
    remaining /= 2;
  }
  while (remaining < 0.5) {
    factors.push(0.5);
    remaining /= 0.5;
  }
  if (Math.abs(remaining - 1) > 1e-6) factors.push(remaining);
  return factors.map((factor) => `atempo=${factor.toFixed(6)}`);
}

/**
 * Trim, retime, fade, level and delay each clip onto the project timeline, then
 * sum them. `normalize=0` keeps a single clip at its authored level instead of
 * amix quietening everything by the number of inputs.
 */
export function audioMixFilter(clips) {
  if (clips.length === 0) return '';
  const chains = clips.map((clip, index) => {
    const sourceEnd = clip.trimIn + clip.duration * clip.speed;
    const steps = [
      `atrim=start=${clip.trimIn.toFixed(6)}:end=${sourceEnd.toFixed(6)}`,
      'asetpts=PTS-STARTPTS',
      ...tempoFilters(clip.speed),
    ];
    if (clip.volume !== 1) steps.push(`volume=${clip.volume.toFixed(6)}`);
    if (clip.fadeIn > 0) steps.push(`afade=t=in:st=0:d=${clip.fadeIn.toFixed(6)}`);
    if (clip.fadeOut > 0) {
      const from = Math.max(0, clip.duration - clip.fadeOut);
      steps.push(`afade=t=out:st=${from.toFixed(6)}:d=${clip.fadeOut.toFixed(6)}`);
    }
    const delayMs = Math.round(clip.start * 1000);
    if (delayMs > 0) steps.push(`adelay=${delayMs}:all=1`);
    return `[${index + 1}:a]${steps.join(',')}[a${index}]`;
  });
  const inputs = clips.map((_, index) => `[a${index}]`).join('');
  return `${chains.join(';')};${inputs}amix=inputs=${clips.length}:normalize=0[aout]`;
}

function positiveInteger(value, name, max) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > max) {
    throw new Error(`Invalid export ${name}`);
  }
  return value;
}

function positiveNumber(value, name, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) {
    throw new Error(`Invalid export ${name}`);
  }
  return value;
}

function nonNegativeNumber(value, name, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(`Invalid export ${name}`);
  }
  return value;
}

function respond(response, status, message) {
  response.statusCode = status;
  if (message) response.setHeader('content-type', 'text/plain;charset=utf-8');
  response.end(message);
}
