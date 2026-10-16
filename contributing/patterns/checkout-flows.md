# Checkout flows

> Work in progress. Checkout endpoints share domain concepts but are not one standardized pipeline. The ordered workflow below preserves the intended direction; consult the implementation for the flow you change.

## 1. Create balance items for new purchases

A balance item represents what is owed, separately from the payment that settles it. If a failed or canceled checkout must not leave a new purchase outstanding, initially use `BalanceItemStatus.Hidden`. Hidden items are excluded from the visible due balance; they do not mean that no accounting record exists.

Current examples are [PlaceOrderEndpoint](../../backend/app/api/src/endpoints/organization/webshops/PlaceOrderEndpoint.ts) and [RegisterMembersEndpoint](../../backend/app/api/src/endpoints/global/registration/RegisterMembersEndpoint.ts). [BalanceItemService.markDue/markPaid](../../backend/app/api/src/services/BalanceItemService.ts) handles the transition out of hidden status and the associated order/registration lifecycle.

## 2. Include existing outstanding balances when supported

Registration checkout can pay old balances alongside new registrations, such as a previously purchased T-shirt. It loads the selected balance models and maps each item to the amount to allocate. The current shared payment input is a `Map<BalanceItem, number>`, not the draft's `toPay` array.

[PaymentService.calculateTotalPrice](../../backend/app/api/src/services/PaymentService.ts) checks that items belong to the selling organization and that positive/negative allocations stay within the allowed open/due amounts. The final total cannot be negative. Do not simply sum unvalidated client selections.

## 3. Prepare invoice calculations where needed

**Design direction:** for B2B flows, calculate a virtual invoice before payment so that VAT and invoice-level rounding agree with any official invoice requested later. This is not a general legal-rule implementation in this guide, nor a promise that every checkout already does so.

Current building blocks are [PaymentService.createProForma](../../backend/app/api/src/services/PaymentService.ts), which builds a structure from a fictitious payment, and [Invoice.buildFromPayments](../../shared/structures/src/billing/Invoice.ts). `createProForma` can return no invoice when VAT information is missing. The draft `Invoice.createFor(...)` example is not an implemented API.

## 4. Create and allocate the payment

The intended invoice-first workflow sets the payment total from the virtual invoice; otherwise the allocations must be summed and rounded explicitly. Current registration checkout delegates to [PaymentService.createPayment](../../backend/app/api/src/services/PaymentService.ts); webshop checkout still performs its own orchestration.

Amounts use integer units of **€0.0001** (`€1 = 10_000`); whole cents are multiples of `100`. Keep intermediate precision for VAT calculations. `PaymentService.roundPayment` stores the correction in `payment.roundingAmount` so that the allocated balance total plus that correction equals `payment.price`. Repeated calls do not apply the correction again. `validateTotalPrice` accepts either the unrounded allocation total or its correctly rounded total.

For example, €12.1234 is `121_234` units, and €12.12 is `121_200`: the correction is `-34` units. **Earlier proposal:** record that difference as a separate balance item of type `Rounding`. The current implementation uses `Payment.roundingAmount` instead; do not copy the draft's nonexistent `BalanceItemType.Rounding` or its malformed summation example. [PaymentBreakdownBuilder](../../shared/structures/src/breakdown/PaymentBreakdownBuilder.ts) exposes rounding separately for financial reporting.

Invoice rounding has two distinct concepts, already documented beside [Invoice](../../shared/structures/src/billing/Invoice.ts): `payableRoundingAmount` corrects the payable invoice total, and `balanceRoundingAmount` explains its difference from the amounts invoiced against balances. Do not interchange them with payment rounding.

## 5. Create an official invoice when appropriate

**Design direction:** normally issue an official invoice after successful payment, avoiding a credit note for a checkout that never succeeds. An explicitly requested bank-transfer invoice may need to be issued before payment. Issuing it is an accounting action, not just a preview.

The draft `Invoice.from(virtualInvoice)` / `invoice.officialize()` methods are not current APIs. [InvoiceService.createFrom](../../backend/app/api/src/services/InvoiceService.ts) validates the invoice structure and balances, creates `InvoicedBalanceItem` records, links supplied payments via `invoiceId`, assigns an invoice number, updates invoiced caches, generates PDF/XML, and forwards the invoice for PEPPOL delivery or emails it as applicable. Receipts have separate behavior: no XML, PEPPOL, or invoice email.

**Not current behavior:** the earlier standardization proposal would replace existing payment allocations with a single new balance item of type `Invoice`. Current invoice creation retains the original balances and records their invoiced amounts separately. Do not assume that invoicing swaps their `BalanceItemPayment` allocations.

The source workflow stops at invoice issuance; later refunds, chargebacks, and credit notes are not specified by this WIP guide.
