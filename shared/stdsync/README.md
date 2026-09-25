# @stamhoofd/stdsync

Keep a changing status or table at the bottom of terminal output while logs written to stdout or stderr appear above it. `StdSync` temporarily intercepts writes to both streams, clears and redraws the live block around complete log lines, and accounts for wrapped terminal rows. Live rendering requires a TTY on stdout.

Without the library, callers must move the cursor, erase and redraw the status around every log, account for wrapped lines, and handle writes made directly to stdout and stderr. With `StdSync`, call `setLive` as the status changes; regular writes appear above it. Call `done()` to keep the final status visible or `clearLive()` to remove it.

See the animated example in [`examples/`](./examples/). Run it in a terminal with: `pnpm --dir shared/stdsync run example`. For redirected/non-TTY output, `setLive` does nothing and regular writes pass through unchanged.
