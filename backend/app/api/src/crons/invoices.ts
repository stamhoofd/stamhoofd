import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { registerTenantCron } from './helpers/registerTenantCron.js';
import type { Invoice } from '@stamhoofd/models';
import { Organization, Payment } from '@stamhoofd/models';
import { sendEmailTemplate } from '../helpers/EmailBuilder.js';
import { EmailTemplateType, InvoiceStruct, PaymentStatus, Replacement } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { InvoiceService } from '../services/InvoiceService.js';
import { WebmasterReport } from '../helpers/WebmasterReport.js';
import { useSavedIterator } from './helpers/useSavedIterator.js';
import { OrganizationAdminService } from '../services/OrganizationAdminService.js';

registerTenantCron('invoices', invoices);

const iterator = useSavedIterator(() => {
    return Organization.select();
}, { limit: 10, maxQueries: 5 });

const bootAt = new Date();

async function invoices() {
    if (STAMHOOFD.environment !== 'development') {
        // Do not run within 5 hours after boot
        if (bootAt.getTime() > new Date().getTime() - 1000 * 60 * 60 * 5) {
            return;
        }

        // Once a month, from the 10th on: the payments of the previous month are invoiced
        const today = Formatter.luxon();
        if (today.day < 10 || Formatter.luxon(iterator.lastFullRun).hasSame(today, 'month')) {
            return;
        }
    }

    // A problem in one invoice usually repeats in every invoice of this run: one email for all of
    // them
    await WebmasterReport.group('Aanmaken facturen', async () => {
        for await (const organization of iterator.iterate()) {
            if (!organization.meta.invoicesEnabled) {
                continue;
            }

            await createInvoicesFor(organization);
        }
    });
}

export async function createInvoicesFor(organization: Organization) {
    const seller = organization.meta.companies[0];
    if (!seller) {
        return;
    }

    // Payments of the current month wait for next month's run
    const endDate = Formatter.luxon().startOf('month').toJSDate();

    console.log('Fetching all payments before ' + Formatter.dateTime(endDate) + ' for ' + organization.name);

    const payments = await Payment.select()
        .where('organizationId', organization.id)
        .where('status', PaymentStatus.Succeeded)
        .where('paidAt', '<', endDate)
        .where('invoiceId', null)
        .where('customer', '!=', null)
        .where('payingOrganizationId', '!=', null)
        .where('price', '!=', 0)
        .limit(5_000)
        .orderBy('payingOrganizationId')
        .fetch();

    console.log('Invoicing ' + payments.length + ' payments');

    // Group by VATNumber, company number or company name
    const groups = new Map<string, Payment[]>();
    for (const payment of payments) {
        const blob = {
            // Grouping by payingOrganizationId avoid privacy issues and data leaks
            payingOrganizationId: payment.payingOrganizationId ?? null,
            vatNumber: Formatter.slugVATNumber(payment.customer?.company?.VATNumber ?? payment.customer?.company?.companyNumber ?? ''),
            // Name and adress is ignored, because subject to changes
        };
        const id = JSON.stringify(blob);
        const existing = groups.get(id);
        if (existing) {
            existing.push(payment);
        } else {
            groups.set(id, [payment]);
        }
    }

    console.log('Invoicing ' + groups.size + ' customers');

    const errors: string[] = [];
    const invoices: Invoice[] = [];

    for (const payments of groups.values()) {
        // Group from last to newest (so we use the last customer details if the address changed during the month)
        payments.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
        const customer = payments[0].customer!.dynamicName;
        try {
            const generalStructs = await AuthenticatedStructures.paymentsGeneral(payments, false);

            const invoice = InvoiceStruct.create({
                seller,
                customer: payments[0].customer!,
                payments: generalStructs,
            });
            invoice.buildFromPayments();

            // Payments that cancel each other out completely are booked with a receipt: nothing was sold
            if (invoice.totalWithVAT === 0 && invoice.items.length === 0) {
                invoice.isReceipt = true;
            } else if (invoice.totalWithVAT === 0) {
                // Goods did move (e.g. a swap), which needs a zero invoice: not supported yet
                console.log('Skipping zero total with items for ' + customer + ' at ' + organization.id);
                continue;
            }

            const model = await InvoiceService.createFrom(organization, invoice);
            invoices.push(model);
        } catch (e) {
            console.error(payments.map(p => p.id), e);

            const prefix = customer + ' (' + payments.map(p => '<a href="' + Formatter.escapeHtml('https://' + organization.getDashboardHost() + '/boekhouding/betalingen/' + p.id) + '">' + Formatter.escapeHtml($t('%14a') + ' ' + p.id.substring(0, 8)) + '</a>').join(', ') + '): ';

            if (isSimpleError(e) || isSimpleErrors(e)) {
                errors.push(prefix + Formatter.escapeHtml(e.getHuman()));
            } else {
                errors.push(prefix + Formatter.escapeHtml($t('%1ED')));
            }
        }
    }

    console.log('Created ' + invoices.length + ' invoices with ' + errors.length + ' errors');

    if (errors.length) {
        await sendEmailTemplate(organization, {
            template: {
                type: EmailTemplateType.InvoiceGenerationErrors,
            },
            recipients: await OrganizationAdminService.getAdminRecipients(organization),
            type: 'transactional',
            fromStamhoofd: true,
            defaultReplacements: [
                Replacement.create({
                    token: 'errors',
                    html: '<ul><li>' + errors.join('</li><li>') + '</li></ul>',
                }),
            ],
        });
    }
}
