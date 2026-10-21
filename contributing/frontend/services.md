# Frontend services

The networking package is being split without changing storage formats, authentication behavior, locale precedence, or review timing. Consumer APIs remain stable; imports move to the owning package.

| Owner | Responsibilities |
| --- | --- |
| `@stamhoofd/networking` | Transport configuration, middleware, retries and connectivity |
| `@stamhoofd/frontend-storage` | Storage contracts and browser adapters; native bootstrap replaces adapters |
| `@stamhoofd/frontend-platform` | Platform metadata and native capability contracts |
| `@stamhoofd/frontend-session` | Session state, authentication middleware, tokens, permissions and platform loading |
| `@stamhoofd/frontend-application` | Session preparation and login orchestration, locale/theme coordination, review policy and domain managers |
| `@stamhoofd/frontend-i18n` | Translation loading and locale handling |
| `@stamhoofd/frontend-notifications` | Reactive toast handles, factories, error formatting and delivery |
| `@stamhoofd/components` | Concrete presentation and Vue lifecycle hooks |

Application services may use sessions, networking, storage, platform capabilities and localization. Those lower layers must not import application services or components. Concrete presentation callbacks are installed by application bootstrap before requests or authentication flows start.

Import `Toast`, `ToastButton`, and `ToastListener` from `@stamhoofd/frontend-notifications/Toast` in both Vue components and standalone frontend TypeScript. The existing API and listener state are unchanged; `ToastBox` and `ToastView` remain component-owned renderers. Call `show()` explicitly and retain the toast for progress updates or manual dismissal. Toasts are not dismissed on caller unmount. Legacy `components/overlays/Toast` exports and `components/errors/isModuleImportError` are deprecated compatibility aliases; update their imports to the notifications package when touching a caller. Run notification tests with `stam test notifications`.

Session preparation continues to initialize the interface locale during this migration. Making activation explicit, changing locale policy, and fixing concurrency behavior are separate changes.

All consumers must import the canonical implementation of `Storage`, `AppManager`, `SessionManager` and `NetworkManager`; copying singleton implementations would break native overrides and shared state.

Import storage from `@stamhoofd/frontend-storage/Storage`. Its roles are replaceable adapters, not separate key namespaces. Browser defaults use localStorage; `secure` does not imply browser encryption. Native bootstrap must install replacements before restoring sessions.

Import `AppManager` and its capability types from `@stamhoofd/frontend-platform/AppManager`. Native bootstrap continues to replace callbacks on the same singleton. This extraction preserves the existing APIs and temporarily retains its session type dependency; dependency boundaries are separate work. Run its tests with `stam test platform`.

Import `SessionContext`, `ContextPermissions`, `ManagedToken`, `QueueHandler`, and `loadPlatform` from `@stamhoofd/frontend-session`. This whole-file extraction preserves their existing APIs, including concrete presentation dependencies. Run their tests with `stam test session`; separating presentation callbacks is later work.

Import `LoginHelper`, `MFAManager`, `SessionManager`, `ThemeManager`, `MemberManager`, `OrganizationManager`, and `EventBus` from `@stamhoofd/frontend-application`. These files retain their existing APIs, locale coordination, and presentation dependencies. All event-bus consumers use the same application-owned singleton. Run application tests with `stam test application`.
