# Frontend services

The networking package is being split without changing storage formats, authentication behavior, locale precedence, or review timing. Consumers import services from their owners; presentation and transport dependencies are configured explicitly at startup.

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

Application services may use sessions, networking, storage, platform capabilities and localization. Those lower layers must not import application services or components, apart from the explicitly retained networking hooks described below. Concrete presentation callbacks are installed by application bootstrap before requests or authentication flows start.

Import `Toast`, `ToastButton`, and `ToastListener` from `@stamhoofd/frontend-notifications/Toast` in both Vue components and standalone frontend TypeScript. The existing API and listener state are unchanged; `ToastBox` and `ToastView` remain component-owned renderers. Call `show()` explicitly and retain the toast for progress updates or manual dismissal. Toasts are not dismissed on caller unmount. Legacy `components/overlays/Toast` exports and `components/errors/isModuleImportError` are deprecated compatibility aliases; update their imports to the notifications package when touching a caller. Run notification tests with `stam test notifications`.

Session preparation continues to initialize the interface locale during this migration. Making activation explicit, changing locale policy, and fixing concurrency behavior are separate changes.

All consumers must import the canonical implementation of `Storage`, `AppManager`, `SessionManager` and `NetworkManager`; copying singleton implementations would break native overrides and shared state.

Import storage from `@stamhoofd/frontend-storage/Storage`. Its roles are replaceable adapters, not separate key namespaces. Browser defaults use localStorage; `secure` does not imply browser encryption. Native bootstrap must install replacements before restoring sessions.

Import `AppManager` and its capability types from `@stamhoofd/frontend-platform/AppManager`. Native bootstrap replaces callbacks on the same singleton. Review eligibility belongs to `@stamhoofd/frontend-application/markReviewMoment`; the native callback receives eligibility, not a session, and retains review timing and counters. Run platform tests with `stam test platform`.

Import `SessionContext`, `ContextPermissions`, `ManagedToken`, `QueueHandler`, and `loadPlatform` from `@stamhoofd/frontend-session`. Interactive authentication uses the shared toast service for notifications and `configureSessionPresentation` for confirmations instead of component imports. The frontend startup adapter installs confirmations without changing authentication or storage behavior. Run session tests with `stam test session`.

Import `LoginHelper`, `MFAManager`, `SessionManager`, `ThemeManager`, `MemberManager`, `OrganizationManager`, and `EventBus` from `@stamhoofd/frontend-application`. Application services use the shared toast service for error notifications. Application presentation callbacks supply primary-color updates; frontend startup installs the concrete implementation. All event-bus consumers use the same application-owned singleton. Run application tests with `stam test application`.

`NetworkManager` uses the shared toast service for retry notifications and receives headers and update handling through `configureNetworking`. `VueGlobalHelper.setup` installs the concrete adapter in `@stamhoofd/components/context/configureFrontendServices` before mounting; browser test setup installs the same adapter. Other hosts must configure networking before their first request. Headers read current locale and native metadata on every attempt, including retries.

`@stamhoofd/frontend-application/SessionLocalization` owns session language preferences, impersonation policy, and organization-country subscriptions. `I18nController` receives preferences and fallbacks without importing sessions or networking. Use `loadSessionLocale(null, options)` when resetting application locale so the previous session subscription is removed.

The Vue hooks remain in `@stamhoofd/networking/hooks/` pending a separate ownership review. They still import component context and, in two cases, application services. These edges keep package-level cycles in place; this stack does not claim an acyclic package graph.

`stamhoofd/frontend-service-boundaries` enforces service-layer imports, re-exports, lazy imports, and type imports, including Vue scripts. Its legacy exceptions name specific hook files and permitted layers; new hooks receive no exception. Manifest tests allow only service dependencies plus the existing networking hook dependencies. Concrete integration coverage lives in components.
