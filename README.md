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

```json
{
  "dependencies": {
    "@cortex/app-sdk": "github:appfactory123/cortex-app-sdk#v0.2.0"
  }
}
```

**Pin an exact tag, not a range.** `#semver:^0.2.0` works under npm but fails
under bun, which does not parse semver ranges for git dependencies — it passes
the literal string through as a git ref:

```
bun add "github:appfactory123/cortex-app-sdk#semver:^0.2.0"
  → GET https://codeload.github.com/.../legacy.tar.gz/semver:%5E0.2.0
```

An exact tag installs cleanly under both, and npm still records the resolved
commit in your lockfile — so a tag pin is a commit pin in practice. That is the
same rule Cortex applies to a manifest's `install.npm.version`: a range is not
a pin.

The repository is public, so no token, SSH key or `.npmrc` is needed — `npm
install` and `bun install` reach it the same way they reach any public
dependency.

The package needs no build step: it is plain ESM with hand-written types and no
dependencies, so installing straight from git costs you no toolchain.

## Releasing

The source of truth is `packages/app-sdk` in the Cortex monorepo, where it sits
in the same commit as the host method table it mirrors
(`lib/appstore/host-bridge/capabilities.ts`) — they cannot drift apart while
they ship together.

npm's git URL grammar accepts only `#<commit-ish>` and `#semver:<range>` — there
is no subdirectory form — so the package is split out to its own repository
before it can be installed from git. Pointing a dependency at a monorepo
subdirectory does not fail loudly; npm installs the repository ROOT under the
dependency's name, and the breakage only surfaces at import time.

```sh
scripts/release-app-sdk.sh https://github.com/appfactory123/cortex-app-sdk.git
```

That script refuses to release a version tag that already exists, a dirty
working tree, or a LICENSE still carrying its placeholder, and runs
`verify:appstore-sdk-package` before anything leaves the machine.
