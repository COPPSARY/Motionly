import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const cli = resolve('bin/motionly.js');
let workspace = '';

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  return port;
}

afterEach(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe('local CLI workflow', () => {
  it('installs supported skills and scaffolds a project without overwriting them', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'motionly-cli-'));
    await exec(process.execPath, [cli, 'skills', 'add', '--all', '--scope', 'project'], {
      cwd: workspace,
    });

    for (const path of [
      '.claude/skills/motionly/SKILL.md',
      '.agents/skills/motionly/SKILL.md',
      '.gemini/skills/motionly/SKILL.md',
      '.kiro/skills/motionly/SKILL.md',
      '.rayu/skills/motionly/SKILL.md',
    ]) {
      expect((await stat(join(workspace, path))).isFile()).toBe(true);
    }

    const initialized = await exec(process.execPath, [cli, 'init', 'demo'], { cwd: workspace });
    expect(initialized.stdout).not.toContain('Next:');
    expect(await readFile(join(workspace, 'demo', 'meta.json'), 'utf8')).toContain(
      '"name": "demo"'
    );
    expect(await readFile(join(workspace, 'demo', 'AGENTS.md'), 'utf8')).toContain(
      '## `.motion` Syntax'
    );
    expect(await readFile(join(workspace, 'demo', 'project.motion'), 'utf8')).toContain(
      'easing power3.out'
    );
    expect((await stat(join(workspace, 'demo', 'assets'))).isDirectory()).toBe(true);
  });

  it('installs supported skills globally when requested', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'motionly-global-skills-'));
    const home = join(workspace, 'home');
    await mkdir(home);

    await exec(process.execPath, [cli, 'skills', 'add', '--all', '--scope', 'global'], {
      cwd: workspace,
      env: { ...process.env, HOME: home },
    });

    for (const path of [
      '.claude/skills/motionly/SKILL.md',
      '.agents/skills/motionly/SKILL.md',
      '.gemini/skills/motionly/SKILL.md',
      '.kiro/skills/motionly/SKILL.md',
      '.rayu/skills/motionly/SKILL.md',
    ]) {
      expect((await stat(join(home, path))).isFile()).toBe(true);
    }

    const initialized = await exec(process.execPath, [cli, 'init', 'demo'], {
      cwd: workspace,
      env: { ...process.env, HOME: home },
    });
    expect(initialized.stdout).not.toContain('Next:');
  });

  it('loads, serves, and saves a scaffolded local project', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'motionly-dev-'));
    await exec(process.execPath, [cli, 'init', 'demo'], { cwd: workspace });
    await writeFile(join(workspace, 'demo', 'assets', 'logo.svg'), '<svg></svg>');
    const port = await availablePort();
    const child = spawn(
      process.execPath,
      [cli, 'dev', 'demo', '--port', String(port), '--no-open'],
      { cwd: workspace, stdio: 'ignore' }
    );

    try {
      let response: Response | undefined;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          response = await fetch(`http://127.0.0.1:${port}/api/motion-project`);
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      }
      expect(response?.ok).toBe(true);
      const source = await response!.text();
      expect(source).toContain('value "demo"');

      const editor = await fetch(`http://127.0.0.1:${port}/`);
      const script = (await editor.text()).match(/<script[^>]+src="([^"]+)"/)?.[1];
      expect(script).toBeTruthy();
      const bundle = await fetch(`http://127.0.0.1:${port}${script}`);
      expect(bundle.headers.get('content-type')).toContain('text/javascript');

      const exportResponse = await fetch(`http://127.0.0.1:${port}/api/exports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          width: 16,
          height: 16,
          fps: 1,
          duration: 1,
          totalFrames: 1,
          hasAudio: false,
          audioStart: 0,
        }),
      });
      expect(exportResponse.status).toBe(201);
      expect(exportResponse.headers.get('content-type')).toContain('application/json');
      const exportJob = (await exportResponse.json()) as { id: string };
      expect(exportJob.id).toMatch(/^[a-z0-9-]+$/);
      const cancelledExport = await fetch(`http://127.0.0.1:${port}/api/exports/${exportJob.id}`, {
        method: 'DELETE',
      });
      expect(cancelledExport.status).toBe(204);

      const asset = await fetch(`http://127.0.0.1:${port}/assets/logo.svg`, { method: 'HEAD' });
      expect(asset.headers.get('content-length')).toBe('11');

      const updated = source.replace('value "demo"', 'value "Saved"');
      const saved = await fetch(`http://127.0.0.1:${port}/api/motion-project`, {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
        body: updated,
      });
      expect(saved.status).toBe(204);
      expect(await readFile(join(workspace, 'demo', 'project.motion'), 'utf8')).toContain(
        'value "Saved"'
      );
    } finally {
      child.kill();
    }
  });
});
