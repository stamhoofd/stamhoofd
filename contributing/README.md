# Getting started

Follow the [root README](../README.md#installation) to install Stamhoofd locally, then read the [development guidelines](development-guidelines.md). Start with encoding and decoding: structures are used throughout the API, database, and frontend.

## Stack and ownership

- Node.js and TypeScript backend, with typed endpoint classes rather than Express.
- Vue 3 and Vite frontend, with app-style stacks/modal navigation provided by `vue-app-navigation`.
- Capacitor for the mobile app.
- Shared structures define versioned data formats used on both sides of the API.

API contracts are documented beside their owning code. Reusable npm-library concepts and workflows live in the library repositories; the guides below describe Stamhoofd's conventions and integrations. The `docs/` application is the Dutch user-help website, not the contributor documentation.

## Encoding and decoding

- [Shared structures overview](structures/README.md)
- [Writing AutoEncoder classes](https://github.com/SimonBackx/simple-encoding/blob/master/docs/autoencoder.md)
- [Patching data](https://github.com/SimonBackx/simple-encoding/blob/master/docs/patching.md) and [patching arrays](https://github.com/SimonBackx/simple-encoding/blob/master/docs/patching-arrays.md)
- [Library versioning](https://github.com/SimonBackx/simple-encoding/blob/master/docs/versioning.md) and [Stamhoofd versioning policy](structures/versioning.md) — read both before changing structures
- [Manual encoding and decoding](https://github.com/SimonBackx/simple-encoding/blob/master/docs/manual-encoding.md) and [Stamhoofd implementations](structures/manual-encoding.md)

## Frontend

- [Views and navigation](frontend/views-and-navigation.md)
- Library [navigation concepts](https://github.com/SimonBackx/vue-app-navigation/blob/main/docs/navigation-concepts.md), [navigation actions](https://github.com/SimonBackx/vue-app-navigation/blob/main/docs/navigation-api.md), and [routes](https://github.com/SimonBackx/vue-app-navigation/blob/main/docs/routes.md)
- [Stamhoofd controllers](frontend/controllers.md) and [library controllers](https://github.com/SimonBackx/vue-app-navigation/blob/main/docs/controllers.md)
- [View building blocks](frontend/building-blocks.md) and [view APIs](frontend/view-apis.md)
- [Translations](frontend/translations.md)
- Authorization: [useAuth](../frontend/shared/components/src/hooks/useAuth.ts) and [ContextPermissions](../frontend/shared/networking/src/ContextPermissions.ts)
- [Patching inside views](frontend/patching.md) (WIP)
- [Authenticated requests](frontend/requests.md) and [library request APIs](https://github.com/SimonBackx/simple-networking/blob/master/docs/requests.md)
- [Local browser/app storage](frontend/local-storage.md)
- [Form validation and errors](frontend/form-validation.md) (TODO)

## Backend

- [Writing endpoints](backend/endpoints.md) and [library endpoint APIs](https://github.com/SimonBackx/simple-endpoints/blob/master/docs/endpoints.md)
- [CRUD endpoints](backend/crud-endpoints.md) (TODO)
- [Database storage and queries](backend/database.md) and [library models](https://github.com/SimonBackx/simple-database/blob/master/docs/models.md)

## Common patterns and introductions

- [UI edit views](patterns/edit-views.md) (TODO)
- [Checkout flows](patterns/checkout-flows.md) (WIP)
- [Webshop checkout introduction](patterns/webshop-checkout.md) (WIP)
- [Testing on iOS](testing/ios.md)

Use [AGENTS.md](../AGENTS.md) for repository rules, build ordering, and validation commands. For undocumented behavior, inspect the owning implementation and ask before guessing.
