#!/usr/bin/env node
// Zero-dependency Motionly CLI and local editor server.

import { createServer } from 'node:http';
import { handleFfmpegExportRequest } from './ffmpeg-export.js';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = normalize(join(here, '..'));
const dist = join(root, 'dist');
const skillTemplatePath = join(root, 'templates', 'motionly-skill', 'SKILL.md');
const projectTemplateRoot = join(root, 'templates', 'project');
// The full, maintained skill library (llms.txt index + focused SKILL.md files).
// It ships inside the published package and is installed beside the top-level
// SKILL.md as a `references/` bundle so agents get real depth, not one file.
const skillsLibraryRoot = join(root, 'motionly-skills');

const PROVIDERS = {
  codex: '.agents/skills/motionly/SKILL.md',
  claude: '.claude/skills/motionly/SKILL.md',
  gemini: '.gemini/skills/motionly/SKILL.md',
  opencode: '.opencode/skills/motionly/SKILL.md',
  kiro: '.kiro/skills/motionly/SKILL.md',
  rayu: '.rayu/skills/motionly/SKILL.md',
};

const AGENT_LABELS = {
  codex: 'Codex',
  claude: 'Claude Code',
  gemini: 'Gemini CLI',
  opencode: 'opencode',
  kiro: 'Kiro',
  rayu: 'RAYU',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.motion': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.map': 'application/json; charset=utf-8',
};

function parsePort(argv) {
  const flag = argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (flag >= 0 && argv[flag + 1]) return Number(argv[flag + 1]);
  const env = Number(process.env.PORT);
  return Number.isFinite(env) && env > 0 ? env : 4173;
}

function optionValues(argv, name) {
  return argv.flatMap((arg, index) => (arg === name && argv[index + 1] ? [argv[index + 1]] : []));
}

function firstPositional(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--port' || argv[index] === '-p') {
      index += 1;
    } else if (!argv[index].startsWith('-')) {
      return argv[index];
    }
  }
  return undefined;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureBuilt() {
  if (await exists(join(dist, 'index.html'))) return true;
  console.error(
    '\nMotionly is not built yet.\n' +
      'Run "npm run build" in the project, or use the published package which ships the build.\n'
  );
  return false;
}

function openBrowser(url) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    // Opening the browser is best-effort.
  }
}

async function installSkills(base, providers) {
  const unknown = providers.find((provider) => !PROVIDERS[provider]);
  if (unknown)
    throw new Error(`Unknown provider "${unknown}". Use: ${Object.keys(PROVIDERS).join(', ')}`);

  const source = await readFile(skillTemplatePath, 'utf8');
  const libraryAvailable = await exists(skillsLibraryRoot);
  for (const provider of providers) {
    const relative = PROVIDERS[provider];
    const target = join(base, relative);
    const skillDir = dirname(target);
    await mkdir(skillDir, { recursive: true });
    try {
      await writeFile(target, source, { encoding: 'utf8', flag: 'wx' });
      console.log(`Added ${provider}: ${target}`);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      console.log(`Kept ${provider}: ${target} already exists`);
    }
    if (libraryAvailable) {
      const added = await copyReferenceLibrary(skillsLibraryRoot, join(skillDir, 'references'));
      if (added) console.log(`  + reference library: ${added} file${added === 1 ? '' : 's'}`);
    }
  }
}

/**
 * Recursively copy the discovery index and focused SKILL.md files from the
 * skill library into an installed `references/` folder. Provider-specific
 * `agents/` metadata is skipped, and existing files are never overwritten so
 * user edits survive re-running the installer. Returns the number of new files.
 */
async function copyReferenceLibrary(source, destination) {
  let copied = 0;
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name === 'agents') continue;
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) {
      copied += await copyReferenceLibrary(from, to);
    } else if (
      entry.name === 'SKILL.md' ||
      entry.name === 'llms.txt' ||
      entry.name === 'AGENTS.md'
    ) {
      try {
        await writeFile(to, await readFile(from), { flag: 'wx' });
        copied += 1;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  }
  return copied;
}

async function choose(terminal, question, options) {
  console.log(`\n${question}`);
  options.forEach((option, index) => console.log(`  ${index + 1}. ${option.label}`));

  while (true) {
    const answer = (await terminal.question('Select [1]: ')).trim() || '1';
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && options[index]) return options[index].value;
    console.log(`Choose a number from 1 to ${options.length}.`);
  }
}

async function selectSkillOptions(terminal, providers, scope) {
  const selectedScope =
    scope ??
    (await choose(terminal, 'Where should Motionly install the skill?', [
      { label: 'Project — this project only', value: 'project' },
      { label: 'Global — every project for this user', value: 'global' },
    ]));

  let selectedProviders = providers;
  if (!selectedProviders.length) {
    const provider = await choose(terminal, 'Which agents should receive the Motionly skill?', [
      { label: 'All supported agents', value: 'all' },
      ...Object.keys(PROVIDERS).map((id) => ({ label: AGENT_LABELS[id], value: id })),
    ]);
    selectedProviders = provider === 'all' ? Object.keys(PROVIDERS) : [provider];
  }

  return { providers: [...new Set(selectedProviders)], scope: selectedScope };
}

function skillBase(scope, projectBase) {
  return scope === 'global' ? homedir() : projectBase;
}

function parseSkillOptions(argv) {
  const scopes = optionValues(argv, '--scope');
  if (scopes.length > 1) throw new Error('Choose only one --scope.');
  const scope = scopes[0];
  if (scope && scope !== 'project' && scope !== 'global')
    throw new Error('Scope must be "project" or "global".');

  const providers = argv.includes('--all')
    ? Object.keys(PROVIDERS)
    : optionValues(argv, '--provider');
  return { providers, scope };
}

async function resolveSkillOptions(argv) {
  let options = parseSkillOptions(argv);
  if (
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    (!options.scope || !options.providers.length)
  ) {
    console.log('\nMotionly skill setup');
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try {
      options = await selectSkillOptions(terminal, options.providers, options.scope);
    } finally {
      terminal.close();
    }
  } else {
    options.scope ??= 'project';
  }

  if (!options.providers.length)
    throw new Error(
      'Choose --provider <name> or --all. Add --scope project|global to choose where.'
    );
  return options;
}

async function promptForAgent(scope) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const choice = await choose(terminal, 'Which agent are you using?', [
      ...Object.keys(PROVIDERS).map((id) => ({ label: AGENT_LABELS[id], value: id })),
      { label: 'All supported agents', value: 'all' },
    ]);
    const providers = choice === 'all' ? Object.keys(PROVIDERS) : [choice];
    return { providers, scope };
  } finally {
    terminal.close();
  }
}

async function initProject(name, argv = []) {
  if (!name || name.startsWith('-'))
    throw new Error('Usage: npx @coppsary/motionly init <project-folder>');
  const target = resolve(name);
  if (await exists(target)) {
    if ((await readdir(target)).length) throw new Error(`Folder is not empty: ${target}`);
  } else {
    await mkdir(target, { recursive: true });
  }

  const created = new Date().toISOString();
  const replacements = { '{{name}}': basename(target), '{{created}}': created };
  for (const filename of ['AGENTS.md', 'project.motion', 'meta.json', 'README.md']) {
    let content = await readFile(join(projectTemplateRoot, filename), 'utf8');
    for (const [token, value] of Object.entries(replacements))
      content = content.replaceAll(token, value);
    await writeFile(join(target, filename), content, { encoding: 'utf8', flag: 'wx' });
  }
  await mkdir(join(target, 'assets'));
  console.log(`Created ${target}`);
  // Skills install unless opted out. Explicit --provider/--all/--scope flags win
  // (non-interactive/CI). Otherwise, in a terminal, ask which agent to set up;
  // with no terminal and no flags, default to every supported agent.
  if (!argv.includes('--skip-skills') && !argv.includes('--no-skills')) {
    const explicit = parseSkillOptions(argv);
    const scope = explicit.scope ?? 'project';
    let providers = explicit.providers;
    if (!providers.length) {
      providers =
        process.stdin.isTTY && process.stdout.isTTY
          ? (await promptForAgent(scope)).providers
          : Object.keys(PROVIDERS);
    }
    if (providers.length) await installSkills(skillBase(scope, target), providers);
  }
  if (process.stdin.isTTY && process.stdout.isTTY) {
    console.log(`\n  To reopen later: cd ${name} && npx @coppsary/motionly dev`);
    await serveEditor(argv, target);
  }
}

async function readRequestBody(request, maximum = 5_000_000) {
  let source = '';
  for await (const chunk of request) {
    source += chunk;
    if (source.length > maximum) throw new Error('TOO_LARGE');
  }
  return source;
}

function safeFile(rootPath, pathname) {
  const filePath = normalize(join(rootPath, pathname));
  return filePath === rootPath || filePath.startsWith(`${rootPath}${sep}`) ? filePath : null;
}

async function serveFile(response, filePath, method = 'GET') {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error('NOT_FOUND');
  response.writeHead(200, {
    'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': info.size,
  });
  response.end(method === 'HEAD' ? undefined : await readFile(filePath));
}

async function serveEditor(argv, projectFolder = null) {
  if (!(await ensureBuilt())) process.exitCode = 1;
  if (process.exitCode) return;

  const projectRoot = projectFolder ? resolve(projectFolder) : null;
  const projectPath = projectRoot ? join(projectRoot, 'project.motion') : null;
  const assetsRoot = projectRoot ? join(projectRoot, 'assets') : null;
  if (projectPath && !(await exists(projectPath))) throw new Error(`Missing ${projectPath}`);
  if (assetsRoot && !(await exists(assetsRoot))) throw new Error(`Missing ${assetsRoot}`);

  const port = parsePort(argv);
  if (!Number.isFinite(port) || port < 1 || port > 65535)
    throw new Error('Port must be between 1 and 65535.');
  const noOpen = argv.includes('--no-open');

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);

      if (await handleFfmpegExportRequest(request, response)) return;

      if (projectPath && pathname === '/api/motion-project') {
        if (request.method === 'GET' || request.method === 'HEAD') {
          const source = await readFile(projectPath);
          response.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': source.length,
            'X-Motionly-Project-Name': basename(projectPath),
            'Cache-Control': 'no-store',
          });
          response.end(request.method === 'HEAD' ? undefined : source);
          return;
        }
        if (request.method === 'PUT') {
          const source = await readRequestBody(request);
          if (!source.includes('canvas {')) {
            response.writeHead(400).end('Invalid .motion project');
            return;
          }
          await writeFile(projectPath, source, 'utf8');
          response.writeHead(204).end();
          return;
        }
        response.writeHead(405, { Allow: 'GET, HEAD, PUT' }).end();
        return;
      }

      if (pathname.startsWith('/assets/')) {
        const bundledAsset = safeFile(dist, pathname.slice(1));
        if (bundledAsset && (await exists(bundledAsset))) {
          await serveFile(response, bundledAsset, request.method);
          return;
        }
      }

      if (assetsRoot && pathname.startsWith('/assets/')) {
        const filePath = safeFile(assetsRoot, pathname.slice('/assets/'.length));
        if (!filePath) {
          response.writeHead(403).end('Forbidden');
          return;
        }
        await serveFile(response, filePath, request.method);
        return;
      }

      let relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      let filePath = safeFile(dist, relative.replace(/^\/+/, ''));
      if (!filePath) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      try {
        await serveFile(response, filePath, request.method);
      } catch {
        await serveFile(response, join(dist, 'index.html'), request.method);
      }
    } catch (error) {
      const status =
        error.message === 'TOO_LARGE' ? 413 : error.message === 'NOT_FOUND' ? 404 : 500;
      response.writeHead(status).end(status === 500 ? 'Internal Server Error' : error.message);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}${projectRoot ? '/editor' : ''}`;
    console.log(
      `\n  Motionly is running.\n  Open this URL in your browser: ${url}${projectRoot ? `\n  Project: ${projectRoot}` : ''}\n  Press Ctrl+C to stop.\n`
    );
    if (!noOpen) openBrowser(url);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${port} is in use. Try: npx @coppsary/motionly ${projectRoot ? 'dev ' : ''}--port ${port + 1}`
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  });
}

function printHelp() {
  console.log(`Motionly

  npx @coppsary/motionly init <project-folder>            Create a project; asks which agent to set up
  npx @coppsary/motionly init <folder> --provider codex   Create a project; install for one agent (no prompt)
  npx @coppsary/motionly init <folder> --all              Create a project; install for every agent
  npx @coppsary/motionly init <folder> --skip-skills      Create a project without agent skills
  npx @coppsary/motionly skills add                       Install agent skills into an existing project
  npx @coppsary/motionly skills add --all
  npx @coppsary/motionly skills add --provider <codex|claude|gemini|opencode|kiro|rayu>
  npx @coppsary/motionly dev [project-folder]             Reopen and edit a local project

Options: --scope <project|global>, --port <number>, --no-open`);
}

async function main() {
  const argv = process.argv.slice(2);
  const [command, subcommand] = argv;
  if (command === 'skills') {
    if (subcommand !== 'add')
      throw new Error(
        'Usage: npx @coppsary/motionly skills add [--provider <name> | --all] [--scope project|global]'
      );
    const options = await resolveSkillOptions(argv.slice(2));
    await installSkills(skillBase(options.scope, process.cwd()), options.providers);
    return;
  }
  if (command === 'init') {
    await initProject(argv[1], argv.slice(2));
    return;
  }
  if (command === 'dev') {
    const folder = firstPositional(argv.slice(1)) ?? '.';
    await serveEditor(argv.slice(1), folder);
    return;
  }
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  await serveEditor(argv);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
