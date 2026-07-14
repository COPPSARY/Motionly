# Contributing to Motionly

Thank you for your interest in contributing to Motionly!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Motionly.git`
3. Install dependencies: `npm install`
4. Start dev server: `npm run dev`

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run type-check` - Run TypeScript checks
- `npm test` - Run tests
- `npm run format` - Format code with Prettier

### Project Structure

- `src/types/` - TypeScript type definitions
- `src/core/` - Core utilities
- `src/language/` - .motion parser
- `src/scene/` - Scene graph builder
- `src/animation/` - Animation system
- `src/render/` - Canvas renderer
- `src/export/` - MP4 and export pipeline
- `src/ui/` - Active Svelte editor and app shell

## Coding Standards

- Use TypeScript with strict mode
- Follow Prettier formatting (100 char width, single quotes)
- Write tests for new features
- Use conventional commits (`feat:`, `fix:`, `docs:`)

## Pull Requests

- Create a branch: `feature/your-feature` or `fix/your-fix`
- Write clear commit messages
- Ensure tests pass: `npm run test:run`
- Ensure types are valid: `npm run type-check`

## Good First Issues

Look for issues tagged `good first issue`:
- Add animation presets
- Improve documentation
- Add tests
- Create `.motion` examples
- Improve timeline and export reliability

## Resources

- [Motion Language Reference](docs/motion-language.md)
- [Architecture](docs/architecture-evaluation.md)
- [Rendering Research](docs/rendering-research.md)

Thank you for contributing! 🎬
