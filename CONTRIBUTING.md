# Contributing

Install dependencies, make focused changes, and run:

```bash
npm run type-check
npm run test:run
npm run build
npm run qa:editor
```

Core modules:

- `src/composition/types.ts` — public contracts
- `src/composition/runtime.ts` — playback and seeking
- `src/composition/presets.ts` — reusable GSAP choreography
- `src/composition/exporter.ts` — frame export from the mounted composition
- `src/compositions/` — product films and examples
- `src/ui/` — visual editor

Keep public interfaces typed, keep the preset surface small, and include real-browser visual evidence for motion changes.
