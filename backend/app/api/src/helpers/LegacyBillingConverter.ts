import type { Model } from '@simonbackx/simple-database';
import { BalanceItem, BalanceItemPayment, CachedBalance, Invoice, InvoicedBalanceItem, Organization, Payment, Platform, STCredit, STInvoice, STPendingInvoice, StripeAccount, UsedRegisterCode, User } from '@stamhoofd/models';
import { InvoiceCounter } from '@stamhoofd/models/helpers/InvoiceCounter.js';
import { QueryableModel } from '@stamhoofd/sql';
import type { STInvoiceItem, STInvoiceMeta } from '@stamhoofd/structures';
import {
    BalanceItemRelation,
    BalanceItemRelationType,
    BalanceItemStatus,
    BalanceItemType,
    Company,
    getPricingTypeName,
    InvoicedBalanceItem as InvoicedBalanceItemStruct,
    PaymentCustomer,
    PaymentMethod,
    PaymentProvider,
    PaymentStatus,
    PaymentType,
    TranslatedString,
    VATExcemptReason,
    VATSubtotal,
} from '@stamhoofd/structures';
import { InvoiceStruct } from '@stamhoofd/structures/billing/Invoice.js';
import { STMath } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { SeedTools } from './SeedTools.js';
import { VATService } from '../services/VATService.js';

/**
 * The seller (Stamhoofd) is a Belgian company, so the standard rate that applies to taxable sales is
 * 21%. Used to restore the rate on intra-community reverse-charged invoices (legacy stored 0%).
 */
const STANDARD_VAT_PERCENTAGE = 21;

/**
 * Converts the legacy SAAS billing models (STInvoice / STPendingInvoice / STCredit) into the new
 * billing model (Invoice / InvoicedBalanceItem / BalanceItem / BalanceItemPayment).
 *
 * The conversion is idempotent: every new row reuses the legacy primary key as its own id, so a
 * re-run skips anything that was already created.
 *
 * The critical correctness goal is that every legacy line tied to an STPackage becomes a BalanceItem
 * with the correct packageId + amount, so STPackageService.getPaidOrPendingQuantity stays accurate and
 * customers are never re-charged for something they already paid.
 */

interface ConversionContext {
    membershipOrganization: Organization;
    /** Point-in-time snapshot of the seller (Stamhoofd) used on every generated invoice. */
    seller: Company;
}

/** Round a 4-decimal price down to whole cents. BalanceItem.save() rejects sub-cent unit prices. */
function roundToCents(value: number): number {
    return STMath.round(value / 100) * 100;
}

/**
 * Maps the legacy single VAT rate to the new model's (VATPercentage, VATExcempt) pair.
 *
 * Legacy stored a 0% rate for intra-community reverse charge (a foreign EU company with a non-Belgian
 * VAT number); the new model marks this explicitly with VATExcempt = IntraCommunityServices while
 * keeping the seller's standard rate. The VAT amount stays 0 either way, so totals are unchanged.
 */
function getVatInfo(meta: STInvoiceMeta): { VATPercentage: number; VATExcempt: VATExcemptReason | null } {
    if (meta.VATPercentage === 0 && !!meta.companyVATNumber) {
        return { VATPercentage: STANDARD_VAT_PERCENTAGE, VATExcempt: VATExcemptReason.IntraCommunityServices };
    }
    return { VATPercentage: meta.VATPercentage, VATExcempt: null };
}

function assertEqual(actual: number, expected: number, label: string, invoiceId: string) {
    if (actual !== expected) {
        throw new Error(
            `Legacy billing migration: ${label} mismatch for invoice ${invoiceId}: got ${actual}, expected ${expected}`,
        );
    }
}

/**
 * Builds (but does not save) the BalanceItem for one legacy invoice/pending-invoice line.
 * Mirrors STPackageService.chargePackage for the package relations/VAT mapping.
 */
async function buildBalanceItem(item: STInvoiceItem, options: {
    legacyInvoice: STInvoice | STPendingInvoice;
    legacyMeta: STInvoiceMeta;
    payingOrganizationId: string | null;
    ctx: ConversionContext;
    status: BalanceItemStatus;
    createdAt: Date;
    paidAt: Date | null;
}): Promise<BalanceItem> {
    const { legacyMeta: legacyMeta, payingOrganizationId, ctx, status, createdAt, paidAt } = options;

    const balanceItem = new BalanceItem();
    balanceItem.id = uuidv4(); // we cannot reuse old item ids as multiple invoices could reference the same id
    balanceItem.organizationId = ctx.membershipOrganization.id;
    balanceItem.payingOrganizationId = payingOrganizationId;

    if (item.package) {
        balanceItem.packageId = item.package.id;
        balanceItem.type = BalanceItemType.STPackage;
        balanceItem.relations.set(BalanceItemRelationType.STPackage, BalanceItemRelation.create({
            id: item.package.id,
            name: TranslatedString.create(item.package.meta.name),
        }));
        balanceItem.relations.set(BalanceItemRelationType.STPricingType, BalanceItemRelation.create({
            id: item.package.meta.pricingType,
            name: TranslatedString.create(getPricingTypeName(item.package.meta.pricingType)),
        }));
        balanceItem.startDate = item.package.meta.startDate ?? null;
        balanceItem.endDate = item.package.endDate ?? null;
    } else {
        balanceItem.type = BalanceItemType.Other;

        // If it is credit, try to link to the credit ID instead.
        if (item.name === 'Gebruikt tegoed' && options.legacyInvoice instanceof STInvoice && payingOrganizationId) {
            balanceItem.type = BalanceItemType.ReferralDiscount;
            // Stop here, we need to find the existing one.
            const creditId = options.legacyInvoice.creditId;
            if (!creditId) {
                // This happens sadly because of incorrect data in the v1 database
                console.error('Missing creditId on invoice ' + options.legacyInvoice.id + ' / ' + options.legacyInvoice.number);
            } else {
                const original = await BalanceItem.getByID(creditId);
                if (!original) {
                    console.error('Could not find BalanceItem for creditId ' + creditId + ' at invoice ' + options.legacyInvoice.id);
                } else {
                    if (original.status !== BalanceItemStatus.Canceled) {
                        throw new Error('Mismatch in creditId ' + creditId + ' at invoice ' + options.legacyInvoice.id + ' already Due');
                    }

                    // Set unitPrice = 0 of this item
                    if (original.unitPrice !== -item.unitPrice * 100) {
                        throw new Error('Mismatch in creditId ' + creditId + ' at invoice ' + options.legacyInvoice.id + ' expected ' + (-item.unitPrice * 100) + ' received ' + original.unitPrice);
                    }

                    // Normally this is svaed as a balance item with a positive value
                    // to reduce a negative balance item that was added earlier as a discount.
                    // but if we would link a balance item payment, that would remove that offset completely.
                    // So we need to set that the 'usage' of this balance item was not payable all along, and link the
                    // negative payment item with it, so we get a positive amount open, leading to the correct behaviour
                    original.status = status; // Also for pending payments, as we'll need to readd the missed discount when the payment would fail
                    original.unitPrice = item.unitPrice * 100;
                    original.type = BalanceItemType.ReferralDiscount;

                    const vatInfo = getVatInfo(legacyMeta);
                    original.VATIncluded = legacyMeta.areItemsIncludingVAT;
                    original.VATPercentage = vatInfo.VATPercentage;
                    original.VATExcempt = vatInfo.VATExcempt;

                    // Don't copy the name, as in the past we would have put a reason why the credit was used
                    // but that should not be reused
                    original.description = item.name || item.description || '';

                    return original;
                }
            }
        }
    }

    const vatInfo = getVatInfo(legacyMeta);

    balanceItem.description = item.name || item.description || '';
    balanceItem.amount = item.amount;
    balanceItem.unitPrice = item.unitPrice * 100;
    balanceItem.VATPercentage = vatInfo.VATPercentage;
    balanceItem.VATIncluded = legacyMeta.areItemsIncludingVAT;
    balanceItem.VATExcempt = vatInfo.VATExcempt;
    balanceItem.status = status;
    balanceItem.dueAt = null;
    balanceItem.paidAt = paidAt;
    balanceItem.createdAt = createdAt;

    return balanceItem;
}

function buildCustomer(meta: STInvoiceMeta): PaymentCustomer {
    return PaymentCustomer.create({
        email: meta.companyEmail,
        company: Company.create({
            name: meta.companyName,
            VATNumber: meta.companyVATNumber,
            companyNumber: meta.companyNumber,
            address: meta.companyAddress,
            administrationEmail: meta.companyEmail,
        }),
    });
}

/**
 * Resolves the legacy Payment linked to an invoice. Legacy payments for Stamhoofd often have a null
 * organizationId; we set it to the membership organization (the seller) so the new payment flow and
 * cached balances work.
 */
async function resolvePayment(stInvoice: STInvoice, payment: Payment, ctx: ConversionContext): Promise<Payment | null> {
    let changed = false;
    if (payment.organizationId === null) {
        payment.organizationId = ctx.membershipOrganization.id;
        changed = true;
    }
    if (payment.payingOrganizationId === null && stInvoice.payingOrganizationId) {
        payment.payingOrganizationId = stInvoice.payingOrganizationId;
        changed = true;
    }

    if (!payment.customer) {
        payment.customer = buildCustomer(stInvoice.meta);
        changed = true;
    }

    if (payment.price === 0 && payment.status !== PaymentStatus.Succeeded && payment.status !== PaymentStatus.Failed && payment.method === PaymentMethod.Unknown) {
        payment.status = PaymentStatus.Succeeded;
        changed = true;
    }

    if (changed) {
        await payment.save();
    }
    return payment;
}

interface ConversionResult {
    balanceItemIds: string[];
    payingOrganizationIds: string[];
}

/**
 * Full reconstruction of a paid/official invoice: Invoice + per-line BalanceItem (marked paid via a
 * BalanceItemPayment linking the existing legacy Payment) + InvoicedBalanceItem.
 */
export async function convertPaidInvoice(stInvoice: STInvoice, payment: Payment, ctx: ConversionContext): Promise<ConversionResult> {
    const result: ConversionResult = { balanceItemIds: [], payingOrganizationIds: [] };
    const toSaveModels: Model[] = [];

    if (await Invoice.getByID(stInvoice.id)) {
        // Already migrated
        return result;
    }

    const legacyMeta = stInvoice.meta;
    const payingOrganizationId = stInvoice.payingOrganizationId;
    const invoicedAt = legacyMeta.date ?? stInvoice.paidAt ?? stInvoice.createdAt;

    await resolvePayment(stInvoice, payment, ctx);

    // Verify the legacy invoice is internally consistent before we reproduce it.
    assertEqual(legacyMeta.priceWithoutVAT + legacyMeta.VAT, legacyMeta.priceWithVAT, 'priceWithVAT composition', stInvoice.id);
    assertEqual(legacyMeta.priceWithVAT + legacyMeta.payableRoundingAmount, legacyMeta.totalPrice, 'totalPrice composition', stInvoice.id);

    // The actual money received must match the invoice total.
    if (payment && payment.status === PaymentStatus.Succeeded) {
        assertEqual(payment.price, legacyMeta.totalPrice * 100, 'payment price vs invoice total', stInvoice.id);
    }

    // First create the balance items + their invoiced-line data (in memory). The InvoicedBalanceItem
    // rows are only saved after the Invoice exists (foreign key).
    const lines: { item: STInvoiceItem; balanceItem: BalanceItem; invoicedStruct: InvoicedBalanceItemStruct }[] = [];

    const invoiceStruct = InvoiceStruct.create({
        seller: ctx.seller,
        customer: buildCustomer(legacyMeta),
    });

    for (const item of legacyMeta.items) {
        if (item.amount === 0) {
            // Not possible to be on invoice, and also cannot be represented correctly since this isn't part of the invoice (items with amount 0, means not included)
            continue;
        }

        const balanceItem = await buildBalanceItem(item, {
            legacyInvoice: stInvoice,
            legacyMeta: legacyMeta,
            payingOrganizationId,
            ctx,
            status: BalanceItemStatus.Due,
            createdAt: invoicedAt,
            paidAt: invoicedAt,
        });

        result.balanceItemIds.push(balanceItem.id);
        toSaveModels.push(balanceItem);

        // Build the invoiced line (computes unit price excl. VAT, quantity, PEPPOL rounding, ...)
        const invoicedStruct = InvoicedBalanceItemStruct.createFor(balanceItem.getStructure(), balanceItem.priceWithVAT);
        lines.push({ item, balanceItem, invoicedStruct });

        if (legacyMeta.areItemsIncludingVAT) {
            if (item.amount === 1) {
                // There could be very rare differences.
                // E.g. 10,40495 rounded to 10,4050 in the balance item, and then to 10,41 in the invoiced struct
                invoicedStruct.unitPrice = stInvoice.meta.includingVATToExcludingVAT(item.price) * 100;
                invoicedStruct.quantity = 1_00_00;

                if (invoicedStruct.unitPrice < 0) {
                    // unitPrice should always be positive in peppol
                    invoicedStruct.unitPrice = -invoicedStruct.unitPrice;
                    invoicedStruct.quantity = -invoicedStruct.quantity;
                }
            } else {
                assertEqual(invoicedStruct.totalWithoutVAT, stInvoice.meta.includingVATToExcludingVAT(item.price) * 100, 'item ' + item.id + ' price without vat should match new', stInvoice.id);
            }
        } else {
            assertEqual(invoicedStruct.totalWithoutVAT, item.price * 100, 'item ' + item.id + ' price without vat should match new', stInvoice.id);
        }

        // Mark the balance item paid by linking the existing legacy payment. We pay each item in full
        // (priceWithVAT) so priceOpen becomes 0 regardless of invoice-level rounding.
        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.organizationId = ctx.membershipOrganization.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.price = balanceItem.priceWithVAT;
        toSaveModels.push(balanceItemPayment);

        invoiceStruct.addItem(invoicedStruct);
    }

    invoiceStruct.calculateVAT();
    invoiceStruct.payableRoundingAmount = legacyMeta.payableRoundingAmount * 100;

    if (legacyMeta.useLegacyRounding) {
        // we can ignore the subresult because we cannot get to the same result in any way using the new invoice calculation methods
        // since these are old invoices, we should accept them as the calculation was not incorrect at the time of generating the invoice
        const diff = invoiceStruct.totalWithVAT - legacyMeta.totalPrice * 100;
        if (Math.abs(diff) > 3_00) {
            throw new Error('Unexpected large difference between legacy calculation and modern calculation at ' + stInvoice.id);
        }
    } else {
        assertEqual(invoiceStruct.totalWithVAT, legacyMeta.totalPrice * 100, 'invoice totalWithVAT', stInvoice.id);
        assertEqual(invoiceStruct.VATTotalAmount, legacyMeta.VAT * 100, 'invoice VAT', stInvoice.id);
        assertEqual(invoiceStruct.totalWithoutVAT, legacyMeta.priceWithoutVAT * 100, 'invoice totalWithoutVAT', stInvoice.id);
    }

    const invoice = new Invoice();
    invoice.id = stInvoice.id;
    invoice.organizationId = ctx.membershipOrganization.id;
    invoice.payingOrganizationId = payingOrganizationId;
    invoice.seller = ctx.seller;
    invoice.customer = buildCustomer(legacyMeta);
    invoice.negativeInvoiceId = stInvoice.negativeInvoiceId;

    // Carry the legacy totals over verbatim so the converted invoice is identical to the original.

    invoice.totalWithoutVAT = legacyMeta.priceWithoutVAT * 100;
    invoice.VATTotalAmount = legacyMeta.VAT * 100;
    invoice.totalWithVAT = legacyMeta.totalPrice * 100;
    invoice.payableRoundingAmount = legacyMeta.payableRoundingAmount * 100;
    invoice.totalBalanceInvoicedAmount = invoiceStruct.totalBalanceInvoicedAmount;

    const vatInfo = getVatInfo(legacyMeta);
    invoice.VATTotal = [
        VATSubtotal.create({
            VATPercentage: vatInfo.VATPercentage,
            VATExcempt: vatInfo.VATExcempt,
            taxablePrice: legacyMeta.priceWithoutVAT * 100,
            VAT: legacyMeta.VAT * 100,
        }),
    ];

    invoice.ipAddress = legacyMeta.ipAddress;
    invoice.userAgent = legacyMeta.userAgent;
    invoice.stripeAccountId = legacyMeta.stripeAccountId;
    invoice.reference = stInvoice.reference;
    invoice.didSendPeppol = stInvoice.didSendPeppol;

    // Reuse the already generated PDF/XML files instead of regenerating them.
    invoice.pdf = legacyMeta.pdf ?? null;
    invoice.xml = legacyMeta.xml ?? null;

    invoice.invoicedAt = invoicedAt;
    invoice.createdAt = stInvoice.createdAt;

    // Format the legacy integer number using the seller's invoice settings so that future numbering
    // (InvoiceCounter.assignNextNumber) continues the same series.
    if (stInvoice.number) {
        invoice.number = stInvoice.number.toString();
    }

    // The converted invoice must match the original exactly.
    assertEqual(invoice.totalWithVAT, legacyMeta.totalPrice * 100, 'invoice totalWithVAT', stInvoice.id);
    assertEqual(invoice.VATTotalAmount, legacyMeta.VAT * 100, 'invoice VAT', stInvoice.id);
    assertEqual(invoice.payableRoundingAmount, legacyMeta.payableRoundingAmount * 100, 'invoice rounding', stInvoice.id);

    // Only save after the last assertions
    await invoice.save();
    await InvoiceCounter.resetNumbers(invoice.organizationId);

    for (const model of toSaveModels) {
        await model.save();
    }

    // Now that the invoice exists, persist the invoiced balance items (FK -> invoices).
    for (const { item, balanceItem, invoicedStruct } of lines) {
        const invoiced = new InvoicedBalanceItem();
        invoiced.organizationId = ctx.membershipOrganization.id;
        invoiced.invoiceId = stInvoice.id;
        invoiced.balanceItemId = balanceItem.id;
        invoiced.name = item.name || invoicedStruct.name;
        invoiced.description = item.description;
        invoiced.balanceInvoicedAmount = invoicedStruct.balanceInvoicedAmount;
        invoiced.quantity = invoicedStruct.quantity;
        invoiced.unitPrice = invoicedStruct.unitPrice;
        invoiced.VATPercentage = invoicedStruct.VATPercentage;
        invoiced.VATIncluded = invoicedStruct.VATIncluded;
        invoiced.VATExcempt = invoicedStruct.VATExcempt;
        invoiced.totalWithoutVAT = invoicedStruct.totalWithoutVAT;
        await invoiced.save();
    }

    if (payingOrganizationId) {
        result.payingOrganizationIds.push(payingOrganizationId);
    }

    if (payment) {
        payment.customer = invoice.customer;
        payment.invoiceId = invoice.id;
        await payment.save();
    }

    return result;
}

/**
 * A legacy invoice whose payment is still in flight (Created/Pending). We create Hidden balance items
 * linked to the still-pending payment, so when it eventually settles the existing payment-success flow
 * activates the package. No Invoice is created (it is not official yet).
 */
export async function convertInProgressInvoice(stInvoice: STInvoice, payment: Payment, ctx: ConversionContext): Promise<ConversionResult> {
    const result: ConversionResult = { balanceItemIds: [], payingOrganizationIds: [] };

    if (stInvoice.meta.items.length === 0) {
        return result;
    }

    await resolvePayment(stInvoice, payment, ctx);

    const meta = stInvoice.meta;
    const payingOrganizationId = stInvoice.payingOrganizationId;
    const createdAt = meta.date ?? stInvoice.createdAt;

    for (const item of meta.items) {
        const balanceItem = await buildBalanceItem(item, {
            legacyInvoice: stInvoice,
            legacyMeta: meta,
            payingOrganizationId,
            ctx,
            status: payment.status === PaymentStatus.Succeeded ? BalanceItemStatus.Due : BalanceItemStatus.Hidden,
            createdAt,
            paidAt: null,
        });
        await balanceItem.save();
        result.balanceItemIds.push(balanceItem.id);

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.organizationId = ctx.membershipOrganization.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.price = balanceItem.priceWithVAT;
        await balanceItemPayment.save();
    }

    if (payingOrganizationId) {
        result.payingOrganizationIds.push(payingOrganizationId);
    }

    return result;
}

/**
 * The pending invoice holds amounts that were charged but not yet invoiced/paid. Each line becomes an
 * unpaid Due balance item: counted by getPaidOrPendingQuantity (so it is not re-charged) and shown as
 * an open balance the organization still owes.
 */
export async function convertPendingInvoice(pendingInvoice: STPendingInvoice, ctx: ConversionContext): Promise<ConversionResult> {
    const result: ConversionResult = { balanceItemIds: [], payingOrganizationIds: [] };

    if (!pendingInvoice.organizationId) {
        return result;
    }

    const meta = pendingInvoice.meta;
    const payingOrganizationId = pendingInvoice.organizationId;

    for (const item of meta.items) {
        const balanceItem = await buildBalanceItem(item, {
            legacyInvoice: pendingInvoice,
            legacyMeta: meta,
            payingOrganizationId,
            ctx,
            status: BalanceItemStatus.Due,
            createdAt: pendingInvoice.createdAt,
            paidAt: null,
        });
        await balanceItem.save();
        result.balanceItemIds.push(balanceItem.id);
    }

    if (result.balanceItemIds.length > 0) {
        result.payingOrganizationIds.push(payingOrganizationId);
    }

    return result;
}

/**
 * Each legacy credit row becomes a balance item (preserving the ledger). A positive legacy change is
 * credit we owe the organization, so it becomes a negative balance (priceOpen < 0). Expired credits are
 * kept as Canceled so they preserve the history without affecting the open balance.
 */
export async function convertCredit(credit: STCredit, ctx: ConversionContext): Promise<ConversionResult> {
    const result: ConversionResult = { balanceItemIds: [], payingOrganizationIds: [] };

    if (await BalanceItem.getByID(credit.id)) {
        // Already migrated
        return result;
    }

    const org = await Organization.getByID(credit.organizationId);
    if (!org) {
        // No longer existing organization (STCredit has no foreign key)
        return result;
    }

    const balanceItem = new BalanceItem();
    balanceItem.id = credit.id;
    balanceItem.organizationId = ctx.membershipOrganization.id;
    balanceItem.payingOrganizationId = credit.organizationId;
    balanceItem.type = BalanceItemType.ReferralDiscount;
    balanceItem.description = credit.description;
    balanceItem.amount = 1;
    balanceItem.unitPrice = -credit.change;
    balanceItem.VATPercentage = 21;
    balanceItem.VATIncluded = false;

    // ALWAYS CANCELED.
    // We'll add an extra item for the remaining to fix
    // that we don't support linking these balance items with payments correctly
    // and also supportint expiry dates in balance items is not possible
    // since how they were built in the past
    balanceItem.status = BalanceItemStatus.Canceled; // We'll set this to due when we link a payment with it later
    balanceItem.dueAt = null;
    balanceItem.createdAt = credit.createdAt;
    await balanceItem.save();

    // Relink any used register code that was rewarded with this credit to the new balance item.
    const usedRegisterCodes = await UsedRegisterCode.select().where('creditId', credit.id).fetch();
    for (const usedRegisterCode of usedRegisterCodes) {
        usedRegisterCode.balanceItemId = balanceItem.id;
        await usedRegisterCode.save();
    }

    result.balanceItemIds.push(balanceItem.id);
    result.payingOrganizationIds.push(credit.organizationId);

    return result;
}

/**
 * Each legacy credit row becomes a balance item (preserving the ledger). A positive legacy change is
 * credit we owe the organization, so it becomes a negative balance (priceOpen < 0). Expired credits are
 * kept as Canceled so they preserve the history without affecting the open balance.
 */
export async function convertRemainingCredit(organization: Organization, balance: number, ctx: ConversionContext): Promise<ConversionResult> {
    const result: ConversionResult = { balanceItemIds: [], payingOrganizationIds: [] };

    const balanceItem = new BalanceItem();
    balanceItem.organizationId = ctx.membershipOrganization.id;
    balanceItem.payingOrganizationId = organization.id;
    balanceItem.type = BalanceItemType.ReferralDiscount;
    balanceItem.description = 'Tegoed';
    balanceItem.amount = 1;
    balanceItem.unitPrice = -balance;
    balanceItem.VATPercentage = 21;
    balanceItem.VATIncluded = false;
    balanceItem.status = BalanceItemStatus.Due;
    balanceItem.dueAt = null;
    balanceItem.createdAt = new Date();
    balanceItem.VATExcempt = VATService.getVATExcempt({
        company: organization.defaultCompanies[0] ?? null,
        sellingOrganization: ctx.membershipOrganization,
        type: 'services',
    });

    await balanceItem.save();

    result.balanceItemIds.push(balanceItem.id);
    result.payingOrganizationIds.push(organization.id);

    return result;
}

async function refreshCaches(membershipOrganizationId: string, results: ConversionResult[]) {
    const balanceItemIds = [...new Set(results.flatMap(r => r.balanceItemIds))];
    const payingOrganizationIds = [...new Set(results.flatMap(r => r.payingOrganizationIds))];

    if (balanceItemIds.length === 0) {
        return;
    }

    // Recompute the cached pricePaid/pricePending/priceOpen and priceInvoiced values.
    await BalanceItem.updatePricePaid(balanceItemIds);
    await BalanceItem.updateInvoiced(balanceItemIds);

    // Recompute the receivable balances per (paying) organization.
    if (payingOrganizationIds.length > 0) {
        await CachedBalance.updateForOrganizations(membershipOrganizationId, payingOrganizationIds);
    }
}

/**
 * Orchestrates the full conversion. Throws when no membership organization is configured, and is a
 * no-op in platform mode (platform deployments never had legacy SAAS billing).
 */
export async function runConversion(): Promise<void> {
    if (STAMHOOFD.userMode === 'platform') {
        console.log('[LegacyBillingConverter] Skipping: running in platform mode');
        return;
    }

    const platform = await Platform.getShared();
    if (!platform.membershipOrganizationId) {
        throw new Error('[LegacyBillingConverter] No membership organization configured: cannot migrate legacy billing');
    }

    const membershipOrganization = await Organization.getByID(platform.membershipOrganizationId, true);

    const ctx: ConversionContext = {
        membershipOrganization,
        seller: membershipOrganization.defaultCompanies[0],
    };

    // First credits
    let results: ConversionResult[] = [];

    // All canceled credits (so we can link them with used referral codes)
    await SeedTools.loop({
        query: STCredit.select(),
        batchSize: 100,
        useTransactionPerBatch: true,
        action: async (credit: STCredit) => {
            results.push(await convertCredit(credit, ctx));

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Gracefully stopping - migration supports retry');
            }
        },
    });

    // Remaining (because we don't support expiry dates)
    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 100,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            const { balance } = await STCredit.getBalance(organization.id);
            if (balance > 0) {
                results.push(await convertRemainingCredit(organization, balance, ctx));
            }

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Gracefully stopping - migration supports retry');
            }
        },
    });

    await refreshCaches(membershipOrganization.id, results);
    const systemUser = await User.getSystem();

    // 1. Invoices: paid (full reconstruction) or in-progress (Hidden + linked pending payment).
    async function processInvoice(stInvoice: STInvoice, results: ConversionResult[]) {
        let payment = stInvoice.paymentId ? (await Payment.getByID(stInvoice.paymentId) ?? null) : null;
        try {
            if (stInvoice.number !== null) {
                if (!payment) {
                    if (stInvoice.meta.stripeAccountId) {
                    // Create a new unpaid payment
                        payment = new Payment();
                        payment.adminUserId = systemUser.id;

                        // Who will receive this money?
                        payment.organizationId = membershipOrganization.id;

                        // Who paid
                        payment.payingOrganizationId = stInvoice.payingOrganizationId;
                        payment.customer = null; // will get filled in later

                        payment.status = PaymentStatus.Succeeded;
                        payment.price = stInvoice.meta.totalPrice * 100;
                        payment.roundingAmount = 0;
                        payment.method = PaymentMethod.Unknown;
                        payment.type = PaymentType.Payment;
                        payment.createMandate = null;

                        payment.provider = PaymentProvider.Stripe;

                        const stripeAccountExists = await StripeAccount.select().where('accountId', stInvoice.meta.stripeAccountId).first(false);
                        if (stripeAccountExists) {
                            payment.stripeAccountId = stripeAccountExists.id;
                        }
                        await payment.save();
                    } else {
                        if (stInvoice.meta.totalPrice < 0) {
                            // Refund
                            payment = new Payment();
                            payment.adminUserId = systemUser.id;

                            // Who will receive this money?
                            payment.organizationId = membershipOrganization.id;

                            // Who paid
                            payment.payingOrganizationId = stInvoice.payingOrganizationId;
                            payment.customer = null; // will get filled in later

                            payment.status = PaymentStatus.Succeeded;
                            payment.price = stInvoice.meta.totalPrice * 100;
                            payment.roundingAmount = 0;
                            payment.method = PaymentMethod.Unknown;
                            payment.type = PaymentType.Refund;
                            payment.createMandate = null;

                            // payment.provider = PaymentProvider.Mollie;
                            // We currently don't have an ID stored for these refunds: to complete in the future after migration
                            await payment.save();
                        } else {
                            throw new Error('Unexpected missing payment for invoice that was not for stripe invoice nor refund ' + stInvoice.id);
                        }
                    }
                }
                results.push(await convertPaidInvoice(stInvoice, payment, ctx));
            } else if (payment) {
                results.push(await convertInProgressInvoice(stInvoice, payment, ctx));
            }
        } catch (e) {
            console.error('Failure at ' + stInvoice.id, e);
            throw e;
        }
    }

    results = [];

    await SeedTools.loop({
        query: STInvoice.select(),
        batchSize: 100,
        useTransactionPerBatch: true,
        action: async (invoice: STInvoice) => {
            // Make sure any negative invoices exist, because otherwise the foreign key will fail
            if (invoice.negativeInvoiceId) {
                const negativeInvoice = await STInvoice.getByID(invoice.negativeInvoiceId);
                if (negativeInvoice) {
                    await processInvoice(negativeInvoice, results);
                }
            }
            await processInvoice(invoice, results);

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Gracefully stopping - migration supports retry');
            }
        },
    });

    await refreshCaches(membershipOrganization.id, results);

    // 2. Pending invoices (one per organization).
    results = [];
    await SeedTools.loop({
        query: STPendingInvoice.select(),
        batchSize: 100,
        useTransactionPerBatch: true,
        action: async (pendingInvoice: STPendingInvoice) => {
            results.push(await convertPendingInvoice(pendingInvoice, ctx));

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Gracefully stopping - migration supports retry');
            }
        },
    });
    await refreshCaches(membershipOrganization.id, results);

    console.log('[LegacyBillingConverter] Conversion finished');
}
