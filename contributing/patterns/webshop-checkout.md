# Introduction to the webshop checkout flow

### Basic concept

The webshops are designed so that they don’t require a lot of network requests to the server. this makes sure there isn’t too much strain on our server when there are a lot of people wanting to buy tickets.
- The webshop cart is stored in memory and local storage.
- The webshop cart is validated in the frontend, using data passed by the backend. This validation happens on the Cart/Checkout structures ([Encoding & decoding (structures)](https://github.com/SimonBackx/simple-encoding/blob/master/README.md#encoding--decoding-structures)), so the backend can perform the exact same validation.
- Also the calculation of the prices happen in the frontend. The frontend does pass the calculated price to the backend - the backend does its own calculation and compares if the price is the same. If the price matches, the order can continue (if the cart is valid). Otherwise there might be a price change and the frontend will need to reload its data to recalculate the prices properly.
- The stock of products is also stored in the publicly accessible webshop data structure. The frontend can calculate how many items are still left, and can do the required validations. This is currently the only data that can change often in a webshop. In the future we’ll move the way this is stored to a separate data property, [like we do for registrations.](https://github.com/stamhoofd/stamhoofd/blob/8b333246e8bd36efad53b6e27823afb1825d3096/backend/shared/models/src/models/Registration.ts#L130-L135) This will further improve performance (and increase code reuse).

---

## Important code paths

#### Backend

Placing an order happens in:

`backend/app/api/src/endpoints/organization/webshops/PlaceOrderEndpoint`

#### Frontend

The webshop frontend is a separate frontend app at `frontend/app/webshop`

The settings for a webshop are managed in the dashboard app.

---

## Legacy code

The webshop code still has more legacy code than other places of the code places.

Frontend: still uses Vue class components in most places. This has to be replaced with the Vue composition API (hooks instead of classes and mixins).

---

## Advanced

### Queues (backend)

Because the stock is stored in every webshop’s product, we use Queue’s when we modify a webshop. This makes sure we only modify a webshop once at a time. You can compare it with database transactions, but on the application level.

```typescript
await QueueHandler.schedule('webshop-stock/' + request.params.id, async () => {
		...
});
```
