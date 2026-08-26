# @cortex/app-sdk

The app side of the Cortex host bridge.

```js
import { connectHost } from '@cortex/app-sdk';

const host = await connectHost();

if (host) {
  const key = await host.settings.get('modelKey');
  await host.notify({ title: 'Ready', body: 'The bot is up.' });
} else {
  // Standalone: no Cortex. Read your own .env and carry on.
}
```

`connectHost()` returns `null` whenever `CORTEX_HOST_ENDPOINT`, `CORTEX_HOST_TOKEN`
and `CORTEX_APP_ID` are not all present. That null branch is the contract that
keeps an App Store app runnable on its own — test it, don't assume it.

A call is refused with `HostError.code === 'permission_denied'` when the app's
`cortex-app.json` did not declare the permission that method costs. Permissions
are checked before anything else runs, so a refusal never depends on what the
host happens to have wired up.

## Installing

This package is distributed from git, not from the npm registry:

```json
{
  "dependencies": {
    "@cortex/app-sdk": "github:appfactory123/cortex-app-sdk#semver:^0.1.0"
  }
}
```

npm resolves that range against the repository's tags and records the exact
commit in your lockfile, so a git dependency is pinned more tightly than a
registry version — a tag can be moved upstream, a commit cannot.

The package needs no build step: it is plain ESM with hand-written types and no
dependencies, so installing straight from git costs you no toolchain.

### Private repository

npm shells out to `git`, so authentication is whatever your machine already
uses — nothing extra to configure per project:

- **https** (`github:` shorthand) uses your git credential helper, e.g.
  `osxkeychain` on macOS, or the helper `gh auth login` installs.
- **ssh** works too, if you prefer keys:
  `git+ssh://git@github.com/appfactory123/cortex-app-sdk.git#semver:^0.1.0`

In CI, provide a token the same way you would for `git clone` — for example
`git config --global url."https://x-access-token:$TOKEN@github.com/".insteadOf "https://github.com/"`.

## Releasing

The source of truth is `packages/app-sdk` in the Cortex monorepo, where it sits
in the same commit as the host method table it mirrors
(`lib/appstore/host-bridge/capabilities.ts`) — they cannot drift apart while
they ship together.

npm's git URL grammar has no subdirectory form, so the package is split out to
its own repository before it can be installed from git:

```sh
scripts/release-app-sdk.sh git@github.com:appfactory123/cortex-app-sdk.git
```

That script refuses to release a version tag that already exists, a dirty
working tree, or a LICENSE still carrying its placeholder, and runs
`verify:appstore-sdk-package` before anything leaves the machine.
