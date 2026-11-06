# Nuxt server observability

Register `@node/nuxt-observability` as a Nuxt module for the docs Node deployment.
The runtime plugin observes server requests in development and production using
`@node/observability`. Build/reload transitions remain in `@node/dev-tools`.

Nitro 2.13's standard Node entry does not expose its listening server to plugins.
This module supplies an HTTP Node entry that owns the listener, reuses Nitro's
router and graceful shutdown, and calls the same lifecycle API as the backends.
It targets the docs container's HTTP/TLS-at-proxy deployment; it is not a general
replacement for Nitro's HTTPS, cluster, websocket, task, or Unix-socket presets.

Development startup completes only after Nuxt compilation, Nitro compilation, and
the development listener are ready. Request instrumentation runs in Nitro's worker;
the parent process owns development startup. Production owns both in one process.
Prerendering does not initialize runtime telemetry.

Request records contain method, status, duration, and registered route templates.
Unmatched requests use a fixed label. No request headers, cookies, bodies, raw URLs,
or exception payloads are passed to the telemetry library. Failed responses produce
a fixed error record correlated with their request span.

Prepare declarations and runtime output before loading the module. The docs
`prepare:observability` script builds only its small dependency graph, including
on a clean Docker build. Runtime credentials are read by the server SDK, never
from Nuxt public configuration.
