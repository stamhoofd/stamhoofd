# Exception privacy gate

Exception transport is **off by default**. `@common/errors` exposes an explicit,
process- or page-local exception sink. No app installs a sink, and an OTLP
endpoint, DSN or log forwarding setting cannot enable exception export.

The sink receives a boundary, a bounded JavaScript error type and the original
`Error` for local stack parsing. Expected `SimpleError` and `SimpleErrors`,
non-errors, and unsupported boundaries are dropped. The original exception and
its context must never be serialized directly for upload.
Transport failure is dropped without a raw fallback or retry spool. Fatal
handlers still exit immediately; asynchronous delivery on exit is not guaranteed.

| Boundary               | Local evidence                                                                                                                                                                           | Limit                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend                | Compiled API, renderer, backup, redirecter and statistics-syncer startup failures; HTTP exception before response conversion; existing fatal rejection handlers use the same projection. | No interception of OS crashes, migrations or arbitrary caught exceptions.                                                                                             |
| Browser                | The installed Vue error handler projects a mounted-component failure; the test inspects the complete message received by a local transport.                                              | Window-level errors, unrelated console output and third-party scripts are not captured.                                                                               |
| Capacitor WebView      | The same Vue boundary tested with the iOS and Android wrapper's platform selections.                                                                                                     | Browser harness, not an on-device test.                                                                                                                               |
| Native iOS and Android | No native crash SDK or upload path configured in the app's own `AppDelegate` or `MainActivity`.                                                                                          | Native crashes are **not** validated by a WebView test. Keep native export disabled pending device tests of the actual final payload, queued reports and attachments. |

For local checks use `stam test errors`, `stam test components vueExceptionHandler`,
and, after building the five backend apps, `STAM_BACKEND_EXCEPTION_SMOKE=1 stam test api exception-privacy`.
No credentials or remote destination are needed.

Before DEV-32 enables any transport, verify effective retention for the intended
Better Stack **Errors application**, including defaults, overrides, archives and
deletion, against the provisional **30-day** target. This is unverified.
Test the chosen SDK/transport's final request, including transport headers,
implicit enrichment (IP, device, environment), additional envelope items and
failure paths. Verify that only the projected event is transmitted. Validate deployment-controlled brand, environment and release,
private source maps and allowlisted build-artifact coordinates before claiming
symbolication. Verify native and WebView separately, and confirm no other
telemetry is enabled.
