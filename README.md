# Jinion

A coding agent for your terminal. It reads your project, changes the code and checks its work, while you steer.

[jinion.co](https://jinion.co) · [Documentation](https://docs.jinion.co)

## Install

You need Node.js 22 or later and a Claude account on a subscription, such as Pro or Max, or a ChatGPT login for Codex.

```sh
npm i -g @jinion/cli
cd ~/code/my-project
jinion
```

Sign in with `/account` the first time. To try Jinion without a model, run `jinion --demo`.

The [documentation](https://docs.jinion.co) covers the rest: your first task, permission modes, memory, skills and MCP
servers, every command and shortcut.

## Develop

```text
packages/core            @jinion/core             Jinion without a screen: the agent, conversations, settings
apps/cli                 @jinion/cli              the `jinion` command, a terminal app on the core
apps/docs                @jinion/docs             docs.jinion.co
apps/website             @jinion/website          jinion.co
packages/tui             @jinion/tui              the terminal UI framework, on Ink and React
packages/virtualization  @jinion/virtualization   mounts only what is in view of a long list
packages/spacing         @jinion/spacing          checks the blank lines between statements
```

```sh
pnpm install
pnpm dev                 # run the CLI from source, in this repository
pnpm dev --demo          # the scripted demo
pnpm dev:docs            # the docs at http://localhost:3000
pnpm dev:website         # jinion.co
pnpm typecheck
pnpm test                # pnpm test:watch while working
pnpm lint                # Biome and the spacing checker; pnpm lint:fix applies the fixes
pnpm build
```

Packages export their TypeScript sources under the `development` condition, so `pnpm dev`, `pnpm typecheck` and
`pnpm test` work without building first. If your shell sets `NODE_ENV=production`, run the tests with
`NODE_ENV=development`.

To run your build as `jinion` in any project, link the command into a folder on your `PATH`, and run `pnpm build` again
after each change:

```sh
pnpm build
ln -s "$PWD/apps/cli/bin/jinion.js" ~/.local/bin/jinion
```

- [AGENTS.md](AGENTS.md): the architecture of the CLI, and the conventions for code, layout, tests and commits.
- [ROADMAP.md](ROADMAP.md): what is left to build.
- [packages/tui/README.md](packages/tui/README.md) and [apps/docs/README.md](apps/docs/README.md): the UI framework,
  and how docs pages are written.

CI runs lint, typecheck, test and build on every push to `main` and every pull request (`.github/workflows/ci.yml`).

The docs and the website deploy to Railway from `main`, as described in `.railway/railway.ts`. After changing that file,
run `railway config apply` to apply it.
