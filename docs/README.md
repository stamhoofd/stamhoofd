# Documentation image

Build from the repository root without a DevOps checkout or cloud credentials:

```sh
pnpm stam docs image build v1.2.3
docker run --rm -p 8080:8080 docs:v1.2.3
```

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
