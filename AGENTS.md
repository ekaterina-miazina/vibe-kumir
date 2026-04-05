# AGENTS.md

## Project purpose

VibeKumir is a browser-only robot programming environment built with Vue 3 and TypeScript. The app lets a user edit a small Kumir-like program, run it against a grid world, and inspect the resulting robot state, paint, walls, and runtime events.

## Stack

- Vue 3
- TypeScript
- Vite
- Vitest
- Playwright

## Common commands

Run all commands from the repository root.

```bash
npm install
npm run dev
npm run build
npm test
npm run test:e2e
npm run lint
```

Default local dev server:

- URL: `http://127.0.0.1:4173/`
- Command: `npm run dev`

## Code layout

- `src/App.vue`: main UI shell, editor, world grid, controls, and runtime log rendering.
- `src/main.ts`: Vue bootstrap.
- `src/style.css`: global app styles.
- `src/core/language/ast.ts`: AST types for the mini language.
- `src/core/language/parser.ts`: parser for Kumir-like syntax.
- `src/core/runtime/interpreter.ts`: runtime execution and event production.
- `src/core/robot/world.ts`: mutable world model for robot position, paint, and walls.
- `tests/unit`: unit tests for parser/runtime/world behavior.
- `tests/e2e`: browser-level smoke tests.

## Programming rules for this project

- Keep the robot core in `src/core` framework-agnostic. Do not couple parser, interpreter, or world model to Vue APIs or DOM state.
- Prefer small, explicit TypeScript data structures over class hierarchies or meta-programming.
- Treat the parser and interpreter as deterministic core logic. Behavioral changes there should come with unit tests.
- Preserve the existing Kumir-like Russian command vocabulary unless the task explicitly requires language changes.
- Keep runtime failures as structured events where possible. Avoid throwing uncaught generic errors into the UI.
- When adding new language constructs, update all three layers together:
  - `ast.ts`
  - `parser.ts`
  - `interpreter.ts`
- If a feature changes how the world is edited or displayed, keep UI behavior in `App.vue` and world invariants in `world.ts`.
- Avoid hidden state transitions in the UI. Prefer named functions like the existing `run`, `reset`, `applyResize`, and `toggle...` handlers.

## Testing expectations

- Run `npm test` for any change to parsing, runtime behavior, or the world model.
- Run `npm run build` after UI or TypeScript changes.
- Run `npm run test:e2e` when changing user-visible flows, startup behavior, button labels, or page-level wiring.
- Add or update tests for bug fixes, especially around:
  - collisions
  - wall checks
  - paint state
  - loops and conditionals
  - parser error handling

## UI guidance

- Preserve the current single-page layout unless a task explicitly asks for a redesign.
- Keep the grid interactions direct and predictable: click for cell actions, explicit tools for robot and wall editing.
- Do not move core execution logic into template expressions. Keep logic in script functions.
- Keep labels and user-facing messages consistent. The code editor uses Russian program syntax, while some UI labels may still be English; avoid accidental mixed renames without updating tests.

## Git workflow

- Write commit messages in Russian.
- Prefer descriptive commit messages that briefly explain what was changed, rather than terse generic summaries.
- Do not create or use feature branches for this project. Make all commits directly on `main`.
- Do not open pull requests on GitHub for this project.

## Change checklist

Before finishing work, verify the relevant items:

- code compiles with `npm run build`
- unit tests pass with `npm test`
- any new syntax is reflected in AST, parser, interpreter, and tests
- UI labels referenced by Playwright tests still match expectations
- no change breaks the fixed dev port `4173`
