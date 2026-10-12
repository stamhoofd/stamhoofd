# Checkout flows in Stamhoofd

> This page is still WIP.

Stamhoofd has a couple checkout flows. These are endpoints that currently follow a certain pattern, but aren’t brought in one line yet. In the future we should improve this to a more standardized approach. For new checkout flows, we should already follow this.

## Steps

---

```typescript
const toPay: {balance: BalanceItem, amount: number}[] = [];
```

#### 1. Creating balance items

First create all balance items for new items that need to be paid (e.g. an order that a user wants to place). If you don’t want these new items to remain ‘open’ in case the payment fails or is canceled, set the status to `Hidden`. Hidden balance items don’t appear in the balance of a user until it has been paid.

#### 2. Link existing balance items if needed

Sometimes it is possible for a user to also pay any outstanding balances at the same time. For example a member might register for a new group and at the same time pay for an outstanding amount (e.g. a T-shirt) in the same payment flow.

#### 3. (B2B only) Create a virtual invoice

Because there are official rounding rules for invoices in Belgium/EU, in some situations (most often B2B) it is best to first convert the balance list to an invoice first so we use the same calculation rules. If the user later requests an official invoice for the payment, there won’t be any rounding errors that need to be corrected in the invoice.

```typescript
const virtualInvoice = Invoice.createFor(items: {balance: BalanceItem, amount: number})
```

#### 4. Create a payment

Set the payment amount to the virtual invoice total amount. If not, rounding needs to happen manually by summing the amount of balances.

The difference between the sum of the balances and the payment total should be added to the payment as a new balance item with type Rounding.

```typescript
const payment = new Payment();
payment.price = virtualInvoice.priceWithVAT;
```

E.g. if the total amount of balances is 12,1234, then the payment could be rounded to 12,12. In that case we need to add a negative balance of 0,0034 to make sure the amount of the payment matches the sum of all individual items.

```typescript
const summedTotal = toPay.reduce((a, b) => a.amount + b, 0);
const correctionBalanceItem = BalanceItem.create({
		unitPrice: payment.price - summedTotal,
		amount: 1,
		type: BalanceItemType.Rounding,
}};
```

These rounding balances will explain the difference between the total sum of the balance items in the system and the sum of the received payments in financial reporting.

#### 5. (Optional) Create the invoice after the payment succeeded

> In some cases, we also want to create an official invoice before the payment has succeeded. For example when paying via Transfer and when requested by the customer. In that case we could convert the virtual invoice to a real invoice. But keep in mind that this transition is permanent and it replaces the balance item payments in the system with payments for a single balance item (type Invoice).

Normally we’ll only create the official invoice after the payment has succeeded to avoid having to create a credit note.

```typescript
const invoice = Invoice.from(virtualInvoice);
await invoice.officialize();
```

What happens when officializing an invoice?
- A number for the invoice is created.
- The invoice is sent via PEPPOL or email.
- A new balance item is created with type Invoice, and linked to the correct user, member or organization.
- If the invoice is linked to existing balance item payments, those balance item payments will swap to be a payment for this newly created invoice instead.
