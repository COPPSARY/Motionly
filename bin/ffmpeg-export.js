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
  if (request.method === 'POST' && url.pathname === '/api/exports') {
    await createJob(request, response);
    return;
  }
  const match = /^\/api\/exports\/([a-z0-9-]+)(?:\/(frames\/(\d+)|audio|finish))?$/.exec(
    url.pathname
  );
  if (!match) return respond(response, 404, 'Unknown export endpoint');
  const id = match[1];
  const action = match[2];
  if (!id) return respond(response, 404, 'Unknown export job');
  const job = jobs.get(id);
  if (!job) return respond(response, 404, 'Export job not found');

  if (request.method === 'DELETE' && !action) {
    jobs.delete(id);
    await rm(job.directory, { recursive: true, force: true });
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

  if (request.method === 'PUT' && action === 'audio') {
    if (!job.hasAudio) return respond(response, 409, 'This export was not created with audio');
    await writeRequest(request, join(job.directory, 'audio-input'), MAX_AUDIO_BYTES);
    job.audioReceived = true;
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
    if (job.hasAudio && !job.audioReceived) {
      return respond(response, 409, 'The attached audio file was not uploaded');
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
  const audioStart = nonNegativeNumber(input.audioStart ?? 0, 'audioStart', duration);
  const expectedFrames = Math.max(1, Math.ceil(duration * fps));
  if (totalFrames !== expectedFrames) throw new Error(`Expected ${expectedFrames} frames`);
  const id = randomUUID();
  const directory = await mkdtemp(join(tmpdir(), 'motionly-export-'));
  jobs.set(id, {
    directory,
    fps,
    duration,
    totalFrames,
    receivedFrames: new Set(),
    hasAudio: input.hasAudio === true,
    audioStart,
    audioReceived: false,
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
  if (job.hasAudio) {
    args.push('-itsoffset', String(job.audioStart), '-i', join(job.directory, 'audio-input'));
  }
  args.push('-map', '0:v:0');
  if (job.hasAudio) args.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k');
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
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

  jobs.delete(id);
  try {
    await runFfmpeg(args);
    const output = await stat(outputPath);
    response.statusCode = 200;
    response.setHeader('content-type', 'video/mp4');
    response.setHeader('content-length', String(output.size));
    await pipeline(createReadStream(outputPath), response);
  } finally {
    await rm(job.directory, { recursive: true, force: true });
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true });
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
      if (code === 0) resolve();
      else reject(new Error(errorOutput.trim() || `ffmpeg exited with code ${String(code)}`));
    });
  });
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
