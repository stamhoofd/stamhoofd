# Documentation site

## Theme ownership

The Nuxt theme selectively ports the simple documentation design from
[`stamhoofd-documentation-theme`](https://github.com/stamhoofd/stamhoofd-documentation-theme),
revision `7ecd981845f3119691a6353de2da771b249f0857`, compared with
<https://www.stamhoofd.be/docs/> in November 2026. Production uses the small
documentation header and footer, not the marketing navigation variants.

- `app/assets/site-theme.scss` owns reusable typography, `--site-*` color/layout
  tokens, `.site-action`/`.site-button`, header, footer and support styling.
  Nuxt UI's text/background/primary tokens map to these colors; `html.dark`
  follows Nuxt color mode rather than a separate media-query theme.
- `app/components/app/AppHeader.vue` and `AppFooter.vue` override the Docus shell.
  Header search opens the existing `useContentSearch()` dialog, retaining its
  keyboard shortcuts, focus management, Escape and navigation dismissal.
  Mobile uses the live site's two icon actions, without a separate menu.
  App artwork from the existing `st-icons` font retains website-sized 24px boxes;
  text actions use 34px visual rows with expanded 44px hit areas.
- `app/components/site/SiteSupport.vue` exposes `<SiteSupport />` for the support
  CTA on the homepage and articles. Place it outside narrow article containers.
- `app/assets/docs-theme.scss` and documentation page/layout components own
  documentation-specific layout and prose. Keep website-wide styling out of
  that stylesheet so a later website migration can reuse the shell.
- `app/assets/stamhoofd.scss` remains the existing shared callout stylesheet.
  Docus continues to own content search. `app/assets/search-theme.scss` styles
  its popup with shared app surfaces, input styles, modal corners and list spacing
  through Nuxt UI's modal class and data slots. Search icons use the existing app
  SVG artwork through a local Nuxt Icon collection; filtering, section links,
  keyboard navigation and focus management remain owned by Nuxt UI.
- `app/components/global/ProseImg.vue` owns screenshot zoom, composing Nuxt Image
  with Nuxt UI's modal for keyboard access, focus management and dismissal.

The shell retains the current app logo artwork, Clarity City fonts and normal
letter spacing, but uses the website's large support CTA and layout scale.
Color mode defaults to the system, with an explicit System/Light/Dark preference
selector. `app/plugins/stamhoofd-color-mode.ts` applies body classes only for forced
modes, matching the app's Auto behavior without merging conflicting SSR classes.
The footer retains Nuxt's custom color-mode selector and preference handling,
styled with shared app inputs and context-menu typography, colors and corners.
The website's dark palette and blue/purple heading gradient remain website-specific;
dark mode uses lighter gradient colors to preserve contrast against the decoration.
Shared app callouts and input surfaces keep their app tokens.

Only the decorative header SVG was ported from the Ghost template. Logo assets
already existed here. The three Clarity City WOFF2 weights (Medium, SemiBold and
Bold) in `public/fonts/clarity-city` are copied from the equivalent repository
assets in `frontend/shared/assets/fonts/clarity-city/WOFF2`; production also uses
Clarity City, despite naming its font family “Metropolis”. No Ghost JavaScript,
full legacy reset, marketing pages or generated theme build files are included.

UI labels remain plain Dutch for this migration. The standalone Nuxt site does
not integrate the application's `$t` translation helper yet.

Production must set `NUXT_SITE_URL` to the public documentation base URL so
canonical and Open Graph URLs use the deployment address. Local development
does not set a production URL.

## Documentation image

Build from the repository root without a DevOps checkout or cloud credentials:

```sh
pnpm stam docs image build v1.2.3
docker run --rm -p 8080:8080 docs:v1.2.3
```

Image build and publish commands prefer Podman and fall back to Docker when Podman
is not installed. Set `STAMHOOFD_CONTAINER_RUNTIME=podman` or `docker` to select one
explicitly. Use the same runtime to build, run, and publish the image; for Podman,
replace `docker run` above with `podman run`.

To publish without the private checkout, set `STAM_DOCS_REGISTRY` to the destination
host/namespace and run `pnpm stam docs image publish v1.2.3 --no-latest`. Supply both
`STAM_DOCS_REGISTRY_USERNAME` and `STAM_DOCS_REGISTRY_PASSWORD` for invocation-scoped
login: credentials are passed through stdin, authentication files are private and
temporary, and existing Docker/Podman logins are left untouched. Temporary files
are removed on success, failure and handled cancellation (not an uncatchable kill).
Without those variables, authenticate externally with `podman login` or `docker login`
for the selected runtime first. Publication never builds or deploys the image.
Choose `--latest` instead to also point `latest` to this image after the version
push succeeds. Omit both flags to be asked interactively (default No);
noninteractive use requires `--latest` or `--no-latest`. Both pushes share the
same authentication scope. Requesting the `latest` tag itself never pushes it twice.

The optional private provider supports `--environment <name>` when no explicit
registry is set. See the [CLI configuration and credential precedence](../shared/cli/README.md#documentation-images).
For live local environment suggestions, activate
[Bash or Zsh completion](../shared/cli/README.md#shell-completion), then use
`stam docs image publish v1.2.3 --environment <TAB>`.

The image runs Nuxt's Node server, including Nuxt Content search, as an unprivileged
user on port 8080. SQLite content is built into the image; local runtime storage is
ephemeral and contains no authoritative data. The build context excludes DevOps,
environment files, local content databases and generated outputs.

The build command reads the pinned Node version from the root `.nvmrc` and passes
it to both Docker stages. Update `.nvmrc` to update local setup, CI and the docs
image together. For major upgrades, also review the supported `engines.node`
range in the root `package.json`.

Publishing and deployment instructions live in the private checkout's
[docs feature guide](../devops/infra/scaleway/features/docs/README.md#publishing-the-image).

## Staging observability

The docs Node server uses the same lifecycle/OTLP library as the backend apps.
Its Nuxt module instruments startup and HTTP responses in development and production.
The image builds the small observability dependency graph before Nuxt; it still
runs as an unprivileged user on port 8080 with TLS terminated by the deployment proxy.

Configure these variables on the running container, not while building the image:

```sh
OTEL_SERVICE_NAME=stamhoofd-docs
OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=staging,service.version=<image-tag>
OTEL_EXPORTER_OTLP_ENDPOINT=https://<better-stack-ingesting-host>
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20<source-token>
```

The SDK sends HTTP/protobuf to `/v1/traces` and `/v1/logs`. Inject the header through
the deployment secret configuration. No collector is required for this pilot.
Omitting the endpoint disables remote export without changing readiness behavior.
The same variables can be used locally alongside the Stam footer.

The initial export contract includes startup, readiness, graceful shutdown, and
request method/status/duration with registered route templates. It excludes raw
URLs, request content, arbitrary console logs, and exception messages. A server 5xx
produces a fixed failure log correlated with the request trace. Browser telemetry
is not enabled. Source retention is configured in Better Stack, not by this image.

After deployment, verify the service/environment/release in Better Stack, request
a normal page and a missing page, and verify startup and request traces. Confirm
SIGTERM flushes pending telemetry and that a telemetry outage does not stop the
server. Automated protocol/privacy coverage runs with `pnpm stam test observability`.

To check the built image with Podman, run
`STAM_OBSERVABILITY_IMAGE=docs:<tag> pnpm stam test observability image`.
This checks successful and missing pages, runtime authentication headers, payload
privacy, and lifecycle flushing on SIGTERM against a local OTLP receiver.
