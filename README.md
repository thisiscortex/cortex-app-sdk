# @cortex/app-sdk

The in-tree version is **0.4.0**. Its process-only AG-UI entrypoint requires
Cortex App API **1.4** and the manifest permission `llm:invoke`:

```js
import { connectAgUi } from '@cortex/app-sdk/ag-ui';

const cortex = connectAgUi();
if (!cortex) throw new Error('Start this app through Cortex.');
const abortController = new AbortController();
const result = await cortex.run({
  threadId: 'research-thread',
  runId: crypto.randomUUID(),
  messages: [{ role: 'user', content: 'Summarize the supplied research.' }],
  tools: [],
}, { signal: abortController.signal, onEvent: event => console.log(event.type) });
```

`provider()` reads the effective Cortex selection without invoking an LLM.
`run()` observes authenticated AG-UI SSE and returns text, app-tool calls,
selection and events. The app executes its own offered tools and validates
their arguments. Host/provider credentials never enter a renderer.
The current isolated app-inference adapters support Claude, Codex and Grok;
other Cortex provider selections return an explicit unsupported error.
Cancellation and host revocation abort provider work. This API never falls
back to a separate provider API key.

Use a published exact SDK tag for distribution. Before 0.3.0 is published,
the Vibe-Trading wrapper ships a byte-recorded MIT source snapshot rather
than referring to a nonexistent tag. Existing 0.2.0 installation examples
below remain valid for the earlier namespaces.

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

## Shared models (App API 1.9)

Declare each model in `cortex-app.json` and request `models:ensure` before
calling `host.models.ensure('declaration-id')`. Cortex accepts only that
declaration id, verifies/downloads the pinned bytes into the machine-wide
store once, and records this app as a consumer. `host.models.status(id)` is
read-only. An app must not pass a repository, URL, revision, hash or output
path at call time.

`models:ollama` unlocks `host.ollama.lease()` and
`host.ollama.release(leaseId)`. A lease returns the shared native and
OpenAI-compatible loopback URLs; leases are scoped to the app that acquired
them. A process may also use the stack environment pointers
`CORTEX_MODELS_HF_HUB_CACHE`, `CORTEX_MODELS_GGUF_DIR`,
`CORTEX_MODELS_GGML_DIR`, and `CORTEX_OLLAMA_BASE_URL`.

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

## Mandatory app approvals (host API 1.5)

`host.approvals.request({requestId, tool, arguments, expiresAt})` uses the existing
process-only RPC method and requires the manifest permission
`approvals:request`. API 1.5 binds it to a Cortex native dialog. The host stamps
the app identity. A positive result echoes the request ID, tool, arguments and
expiry with `approved:true`; compare all fields to a prepared immutable action
and consume it once. Denial, expiry or unavailable desktop never grants access.
Full/remembered session permissions do not bypass this dialog.

The generic SDK method uses its configured timeout and has no per-call
AbortSignal option. A client implementing cancellable approval RPC must follow
the SDK's `unix:`/`npipe:` endpoint framing, retain the private token header,
bound its response, and destroy the socket on Stop. It must not discover another
host or expose an approval-response endpoint to the renderer/model.
