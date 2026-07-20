# {{name}}

This is a local Motionly project.

Motionly starts the project automatically after `init`. To reopen it later:

```bash
npx @coppsary/motionly dev
```

Motionly opens `project.motion`, resolves media from `assets/` by filename, and saves visual edits back to the project file. Put images, SVG, video, and audio in `assets/`, then import them from `project.motion`, for example:

```motion
import "./assets/logo.svg" as logo
```

The browser-only Motionly editor remains available with `npx @coppsary/motionly`.

## Create with an agent

The installed skill is available as `/motionly`. Start your prompt with it so the agent loads the Motionly authoring workflow and references:

```text
/motionly Inspect the assets in this project, storyboard the animation, and create or refine project.motion.
```
