import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { registerCron } from '@stamhoofd/crons';
import type { Invoice } from '@stamhoofd/models';
import { Organization, Payment, sendEmailTemplate } from '@stamhoofd/models';
import { EmailTemplateType, InvoiceStruct, PaymentStatus, Replacement } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { InvoiceService } from '../services/InvoiceService.js';
import { useSavedIterator } from './helpers/useSavedIterator.js';
import { isOutside } from './helpers/isOutside.js';

registerCron('invoices', invoices);

const { iterate, isHoursAgo } = useSavedIterator(() => {
    return Organization.select();
}, { limit: 10, maxQueries: 5 });

const bootAt = new Date();

async function invoices() {
    // Do not run within 30 minutes after boot to avoid creating multiple email models for emails that failed to send
    if (bootAt.getTime() > new Date().getTime() - 1000 * 60 * 30 && STAMHOOFD.environment !== 'development') {
        return;
    }

    if (isOutside('03:00', '10:00')) {
        return;
    }

    if (!isHoursAgo(12)) {
        return;
    }

    // Get the next x organization to send e-mails for
    for await (const organization of iterate()) {
        if (!organization.meta.invoicesEnabled) {
            continue;
        }

        // Create all invoices for this organization
        await createInvoicesFor(organization);
    }
}

async function createInvoicesFor(organization: Organization) {
    const seller = organization.meta.companies[0];
    if (!seller) {
        return;
    }

    // Belgian rules: allowed to invoice up to the 15th day of the next month. We extend it with one month to fix mistakes.
    const today = Formatter.luxon();
    const startDate = today.day <= 15 ? today.minus({ month: 2 }).startOf('month') : today.minus({ month: 1 }).startOf('month');

    // Don't invoice below 1 euro - unless we reached the timeout date for invoices (end of month + 15 days - 3 days margin)
    const invoiceLimit = STAMHOOFD.environment === 'development' ? 0 : 1_0000;
    function getPaymentTimeoutDate(p: Payment) {
        return Formatter.luxon(p.paidAt ?? p.createdAt).plus({ month: 1 }).set({ day: 15 - 3 }).startOf('day').toJSDate();
    }

    console.log('Fetching all payments between ' + Formatter.dateTime(startDate.toJSDate()) + ' and now for ' + organization.name);

    const payments = await Payment.select()
        .where('organizationId', organization.id)
        .where('status', PaymentStatus.Succeeded)
        .where('paidAt', '>=', startDate.toJSDate())
        .where('invoiceId', null)
        .where('customer', '!=', null)
        .where('payingOrganizationId', '!=', null)
        .where('price', '!=', 0)
        .limit(1_000)
        .orderBy('payingOrganizationId')
        .fetch();

    console.log('Invoicing ' + payments.length + ' payments');

    // Group by VATNumber, company number or company name
    const groups = new Map<string, Payment[]>();
    for (const payment of payments) {
        const blob = {
            // Grouping by payingOrganizationId avoid privacy issues and data leaks
            payingOrganizationId: payment.payingOrganizationId ?? null,
            vatNumber: payment.customer?.company?.VATNumber,
            companyNumber: payment.customer?.company?.companyNumber,
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
    let skipped = 0;

    for (const [_, payments] of groups) {
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

            if (invoice.totalWithVAT >= 0 && invoice.totalWithVAT < invoiceLimit) {
                const first = new Date(Math.min(...payments.map(p => getPaymentTimeoutDate(p).getTime())));
                if (first > new Date()) {
                    console.log('Delaying invoicing ' + customer + ' at ' + organization.id + ' until ' + Formatter.dateIso(first));
                    skipped += 1;
                    continue;
                } else {
                    console.log('Invoiced low priced invoice, because of date ' + Formatter.dateIso(first) + ' being in the past');
                }
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

    console.log('Created ' + invoices.length + ' invoices with ' + errors.length + ' errors and skipped ' + skipped);

    if (errors.length) {
        await sendEmailTemplate(organization, {
            template: {
                type: EmailTemplateType.InvoiceGenerationErrors,
            },
            recipients: await organization.getAdminRecipients(),
            type: 'transactional',
            fromStamhoofd: true,
            defaultReplacements: [
                Replacement.create({
                    token: 'errors',
                    html: '<ul><li>' + errors.join('</li><li>') + '</li></ul>' + (skipped > 0 ? '<p>' + Formatter.escapeHtml(skipped === 1 ? $t('%1U4') : $t('%1Sp', { count: skipped })) + '</p>' : ''),
                }),
            ],
        });
    }
}
