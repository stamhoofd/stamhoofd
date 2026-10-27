# Getting started

[Development do’s and don’ts](development-guidelines.md)
[Playwright tests](../tests/playwright/README.md)

## Installation

Please check our [README.md](https://github.com/stamhoofd/stamhoofd)

[Testing on iOS](testing/ios.md)

## Stack

- Node.js + TypeScript backend. We use our own routing engine as a replacement for Express.js or something similar. This library is documented in [this](../packages/node/endpoints/docs/endpoints.md) guide
- [Vue.js](https://vuejs.org/) (TS) + [Vite](https://vite.dev/) frontend
- [Capacitor](https://capacitorjs.com/) for the mobile app
- We use a number of custom-built libraries, mostly for frontend work or for sharing code between the frontend and backend. They’re all documented here. It might take a bit to get used to them, but once you do, you’ll see how much easier and more reusable they make our code.

## Encoding & decoding


> One of the most important concepts in our code base. Start here.

[Encoding & decoding (structures)](../packages/common/encoding/README.md#encoding--decoding-structures)

[Writing AutoEncoder classes](../packages/common/encoding/docs/autoencoder.md)

[Patching data](../packages/common/encoding/docs/patching.md)

[Versioning data](../packages/common/encoding/docs/versioning.md)

## Frontend guides


[Views and navigation (Vue App Navigation)](../packages/browser/navigation/docs/getting-started.md)

[View building blocks (inline components and classes)](frontend/building-blocks.md)

[View API’s](frontend/view-apis.md)

[Patching inside views](frontend/patching.md)

[Sending (authenticated) requests in the frontend](../packages/common/networking/docs/requests.md)

[Storing data locally in the browser/app](frontend/local-storage.md)

[Frontend service ownership](frontend/services.md)

## Backend guides


[Writing endpoints](../packages/node/endpoints/docs/endpoints.md)

[Storing data in the database](../packages/node/database/docs/models.md)

## Common patterns

---

These are guides on how we generally do certain things in the Stamhoofd code base.

[UI: Edit views](patterns/edit-views.md)

[Checkout flows in Stamhoofd](patterns/checkout-flows.md)

## Introductions

---

[Introduction to the webshop checkout flow](patterns/webshop-checkout.md)
