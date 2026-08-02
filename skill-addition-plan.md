# Motionly Skill Addition Plan

## Goal

Make every Motionly authoring skill available to installed agents and prevent
stale or partial context from causing reverse-engineering of compiled bundles.

The agent should receive the complete authoring contract:

`storyboard -> scenes -> components/layouts/showcases -> animations -> renderer`

It should not need to infer the authoring API from `dist/`, source maps,
minified output, or `node_modules/@coppsary/motionly`.

## Scope

Install and maintain all focused skills under `motionly-skills/skills/`:

- `motion-dsl`
- `scenes`
- `motion-system`
- `components`
- `svg`
- `animation`
- `easing`
- `camera`
- `composition`
- `typography`
- `transitions`
- `timeline`
- `assets`
- `rendering`
- `templates`

Also install the shared routing files:

- `motionly-skills/AGENTS.md`
- `motionly-skills/llms.txt`

Do not add implementation source, compiled output, source maps, or package
internals to the skill bundle.

## Plan

### 1. Establish one source of truth

- Treat `motionly-skills/` as the authoritative installed reference library.
- Update `templates/motionly-skill/SKILL.md` to match the current storyboard and
  scene-based authoring model.
- Remove stale instructions that prohibit `scene`, `component`, `layout`, or
  `showcase` blocks.
- Put the non-negotiable discovery order in the top-level skill:
  1. Read `AGENTS.md` and `llms.txt`.
  2. Read every focused skill for substantial animation work.
  3. Use catalog examples.
  4. Inspect readable source only when documentation cannot answer.
  5. Treat built output as a last-resort diagnostic, never as an authoring API.
- Add a fail-closed instruction: if a required skill is missing or conflicts
  with the scene model, report that the installed skill is stale instead of
  reverse-engineering the package.

### 2. Install the complete bundle

- Ensure the installer copies every `SKILL.md`, `AGENTS.md`, and `llms.txt`
  from `motionly-skills/`.
- Include the new `scenes` skill in the installed library and all routing
  indexes.
- Keep installation provider-neutral so Codex, Claude, Gemini, opencode,
  Kiro, and RAYU receive the same Motionly contract.
- Verify the npm package file list includes the complete skill library.

### 3. Make loading deterministic

- For substantial `.motion` creation, storyboard, retiming, transition, or
  repair work, require the agent to load all focused Motionly skills before
  authoring.
- Keep `llms.txt` for discovery and routing, but do not rely on the agent to
  guess which foundational skill it needs.
- Require `motion-dsl`, `scenes`, `motion-system`, `components`, and
  `transitions` at minimum for animation creation.
- Allow focused loading for small read-only questions where loading the entire
  bundle adds no value.

### 4. Add safe skill upgrades

- Add an explicit `skills update` or `skills add --force` operation for
  updating an existing installation.
- Preserve the current default behavior of not overwriting user-edited files.
- Record the installed Motionly skill version and bundle manifest.
- On update, report which files changed, which files were preserved, and which
  files are missing.
- Make the upgrade path update both the top-level `SKILL.md` and all reference
  files; updating only the top-level file is insufficient.

### 5. Keep generated project guidance aligned

- Update the project `AGENTS.md` template to mention `scenes` and the complete
  installed bundle.
- Update installation and AI-authoring documentation with the full bundle
  contents and the upgrade command.
- Ensure examples use the current scene-first model and never teach stale flat
  syntax as the default.
- Keep the repository-local `.agents/skills/write-motionly` guidance aligned
  with the installed skill template.

### 6. Add regression coverage

Test a fresh project installation for:

- all supported providers
- every focused skill file, including `scenes`
- `AGENTS.md`, `llms.txt`, and the top-level skill
- the anti-reverse-engineering rule
- the absence of stale “do not invent scene” guidance
- consistent content across providers

Test upgrades for:

- updating a known stale installation
- adding newly introduced skills
- preserving an explicitly edited file by default
- reporting the installed and available versions

Run:

- the CLI workflow tests
- skill validation for every installed skill folder
- package file-list or npm-pack verification
- `git diff --check`

### 7. Validate with the failing scenario

Use the same graph-and-typography request that previously triggered bundle
inspection. The agent must:

- read the installed Motionly guidance
- plan scenes before object animation
- use documented primitives, components, or catalog examples
- avoid `dist/`, source maps, and `node_modules` inspection
- produce editable `.motion` source
- run the documented Motionly inspection command

The test fails if the agent starts by searching compiled output or creates a
temporary parser/evaluator harness to rediscover supported syntax.

## Acceptance Criteria

- A fresh install exposes every current Motionly skill.
- An existing install can be upgraded explicitly.
- All installed files describe the same authoring model.
- Scene-first authoring is the default for new animation work.
- Missing documentation causes a clear stale-skill error, not reverse
  engineering.
- The complete skill bundle remains limited to authoring documentation and
  examples; implementation internals remain outside the agent skill.

## Non-Goals

- Do not expose the whole repository to the agent by default.
- Do not copy `dist/`, source maps, minified bundles, or `node_modules`.
- Do not add a plugin system or speculative skill-discovery architecture.
- Do not silently overwrite user-customized installed skills.
