# Webshop checkout

> Work in progress: this is an introduction, not a complete checkout specification.

## Frontend and backend responsibilities

The webshop keeps its cart in memory and persists the checkout locally. Most cart editing and pricing therefore does not need a server request, keeping request volume low during busy ticket sales. [CheckoutManager](../../frontend/app/webshop/src/classes/CheckoutManager.ts) stores a version-boxed `Checkout` in browser `localStorage`, keyed by webshop ID, and falls back to an empty checkout if loading fails.

Shared [Cart](../../shared/structures/src/webshops/Cart.ts), [CartItem](../../shared/structures/src/webshops/CartItem.ts), and [Checkout](../../shared/structures/src/webshops/Checkout.ts) structures implement validation and price calculation for both frontend and backend. Client-side validation improves feedback; it does not authorize an order or reserve inventory.

[PlaceOrderEndpoint](../../backend/app/api/src/endpoints/organization/webshops/PlaceOrderEndpoint.ts) loads the current webshop, refreshes discount codes from the database, validates the checkout, recalculates it, and performs server-side UiTPAS validation before creating the order. Cart-item validation refreshes products, prices, and options from the current webshop. Do not trust client-supplied product objects or calculated amounts.

The earlier design described comparing the client total with the server total and asking the client to reload on a price mismatch. The current webshop endpoint instead uses the checkout's recalculated `totalPrice`; it does not perform that explicit total comparison. Do not assume that behavior from the registration checkout applies here.

## Stock and concurrency

Stock is still part of the publicly readable webshop products, prices, and options: `stock` is the limit (`null` means unlimited), while `usedStock` tracks usage. [CartStockHelper](../../shared/structures/src/webshops/CartStockHelper.ts) combines those limits with cart quantities, reservations, and seats. `Checkout` separately validates time-slot limits. This snapshot can become stale between viewing the cart and placing an order.

The backend runs loading, validation, and stock reservation in the same `webshop-stock/<webshopId>` queue. [Order.updateStock](../../backend/shared/models/src/models/Order.ts) documents this requirement; order stock transitions use the same queue. This serializes competing webshop writes at the application level; it is not a database transaction. The order reserves stock before payment setup. Failure/expiration handling releases reservations through the order lifecycle.

**Future design, not implemented here:** moving stock out of embedded webshop product data into a separate property, similar to registration stock, remains an improvement proposal. Do not describe it as the current storage format.

## Code map

- Buyer app: [frontend/app/webshop](../../frontend/app/webshop).
- Checkout steps and views: [views/checkout](../../frontend/app/webshop/src/views/checkout), with Vue Composition API `<script setup>` components and [CheckoutStepsManager](../../frontend/app/webshop/src/views/checkout/CheckoutStepsManager.ts).
- Settings and order management: dashboard [views/dashboard/webshop](../../frontend/app/dashboard/src/views/dashboard/webshop).
- Order validation/reservation and payment setup: [PlaceOrderEndpoint](../../backend/app/api/src/endpoints/organization/webshops/PlaceOrderEndpoint.ts).
- Stock updates: [Order](../../backend/shared/models/src/models/Order.ts).

Older webshop code may still use legacy patterns, but the checkout views are no longer predominantly Vue class components. Match the current component being edited rather than copying an old class/mixin example.
