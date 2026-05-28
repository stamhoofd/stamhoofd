import { registerCron } from '@stamhoofd/crons';
import { BalanceItem, Organization, Payment, Platform } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import type { PaymentProvider } from '@stamhoofd/structures';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, getPaymentProviderName, PaymentMethod, PaymentStatus, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { BalanceItemService } from '../services/BalanceItemService.js';
import { PaymentService } from '../services/PaymentService.js';
import { VATService } from '../services/VATService.js';

// Charge manual service fees every night
registerCron('transfer-fees', chargeTransferFees);

async function chargeTransferFees() {
    if (STAMHOOFD.environment !== 'development' && (new Date().getHours() > 5 || new Date().getHours() < 2)) {
        return;
    }
    const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
    if (!membershipOrganizationId) {
        return;
    }

    const membershipOrganization = await Organization.getByID(membershipOrganizationId, true);

    // Succeeded payments
    const payments = await Payment.select()
        .where('status', PaymentStatus.Succeeded)
        .where('transferFeeManual', '>', 0)
        .where('transferFeeManualCharged', 0)
        .where('createdAt', '<', STAMHOOFD.environment !== 'development' ? new Date() : Formatter.dateIso(new Date(Date.now() + 1000 * 60 * 60 * 24)))
        .limit(200)
        .orderBy('createdAt', 'ASC')
        .fetch();

    // Pending payments older than 14 days with method = Transfer or PointOfSale
    const pendingPayments = await Payment.select()
        .where('status', [PaymentStatus.Pending, PaymentStatus.Created])
        .where('method', [PaymentMethod.Transfer, PaymentMethod.PointOfSale, PaymentMethod.Unknown])
        .where('transferFeeManual', '>', 0)
        .where('transferFeeManualCharged', 0)
        .where('createdAt', '<', Formatter.dateIso(new Date(Date.now() - 1000 * 60 * 60 * 24 * 14)))
        .limit(200)
        .orderBy('createdAt', 'ASC')
        .fetch();

    const allPayments = [...payments, ...pendingPayments];

    console.log('Found ' + allPayments.length + ' payments to charge service fees for');

    const mappedToOrganizationId = new Map<string, Payment[]>();
    for (const payment of allPayments) {
        if (!payment.organizationId) {
            console.warn('Payment without organizationId, skipping', payment.id);
            continue;
        }
        if (!mappedToOrganizationId.has(payment.organizationId)) {
            mappedToOrganizationId.set(payment.organizationId, []);
        }
        mappedToOrganizationId.get(payment.organizationId)!.push(payment);
    }

    for (const [organizationId, payments] of mappedToOrganizationId.entries()) {
        const organization = await Organization.getByID(organizationId);
        if (!organization) {
            console.warn('Organization not found for ID', organizationId);
            continue;
        }

        // Group payments by Formatter.dateNumber(p.createdAt)
        const groupedPayments: Map<string, Payment[]> = new Map();
        for (const payment of payments) {
            const date = Formatter.dateNumber(payment.createdAt);
            if (!groupedPayments.has(date)) {
                groupedPayments.set(date, []);
            }
            groupedPayments.get(date)!.push(payment);
        }

        for (const [_, payments] of groupedPayments) {
            const totalFees = payments.reduce((sum, payment) => sum + payment.transferFeeManual - payment.transferFeeManualCharged, 0);
            const groupedByDate = new Map<string, Payment[]>();

            for (const p of payments) {
                const date = Formatter.dateNumber(p.createdAt);
                const existing = groupedByDate.get(date);
                if (existing) {
                    existing.push(p);
                } else {
                    groupedByDate.set(date, [p]);
                }
            }

            for (const [day, payments] of groupedByDate) {
                const groupedByProvider = new Map<PaymentProvider | null, Payment[]>();

                for (const p of payments) {
                    const provider = p.provider;
                    const existing = groupedByProvider.get(provider);
                    if (existing) {
                        existing.push(p);
                    } else {
                        groupedByProvider.set(provider, [p]);
                    }
                }

                for (const [provider, payments] of groupedByProvider) {
                    const date = new Date(Math.min(...payments.map(p => p.createdAt.getTime())));
                    const startOfDay = Formatter.luxon(date).startOf('day').toJSDate();
                    const endOfDay = Formatter.luxon(date).endOf('day').toJSDate();

                    // Ms don't work when querying MySQL, they get lost
                    startOfDay.setMilliseconds(0);
                    endOfDay.setMilliseconds(0);

                    const item = new BalanceItem();
                    item.type = BalanceItemType.TransferFee;
                    item.description = $t('Transactiekosten op {date}', { date: day });

                    if (provider) {
                        item.relations.set(BalanceItemRelationType.PaymentProvider, BalanceItemRelation.create({
                            id: provider,
                            name: TranslatedString.create(getPaymentProviderName(provider)),
                        }));
                    }

                    item.payingOrganizationId = organization.id;
                    item.organizationId = membershipOrganizationId;
                    item.VATPercentage = 21;
                    item.VATExcempt = VATService.getVATExcempt({
                        company: organization.defaultCompanies[0] ?? null,
                        sellingOrganization: membershipOrganization,
                        type: 'services',
                    });
                    item.VATIncluded = false;
                    item.quantity = 1;
                    item.unitPrice = totalFees;
                    item.createdAt = new Date();
                    item.status = BalanceItemStatus.Due;
                    item.startDate = startOfDay;
                    item.endDate = endOfDay;

                    // Check if we find an existing one
                    const existingAll = await BalanceItem.select()
                        .where('type', BalanceItemType.TransferFee)
                        .where('organizationId', membershipOrganizationId)
                        .where('VATPercentage', item.VATPercentage)
                        .where('VATIncluded', item.VATIncluded)
                        .where('VATExcempt', item.VATExcempt)
                        .where('payingOrganizationId', organization.id)
                        .where('status', BalanceItemStatus.Due)
                        .where('startDate', startOfDay)
                        .where('endDate', endOfDay)
                        .fetch();
                    const existing = provider ? existingAll.find(e => e.relations.get(BalanceItemRelationType.PaymentProvider)?.id === provider) : existingAll.find(e => !e.relations.has(BalanceItemRelationType.PaymentProvider));

                    if (existing) {
                        existing.unitPrice += totalFees;
                        await existing.save();
                        BalanceItemService.scheduleUpdate(existing);
                    } else {
                        await item.save();
                        BalanceItemService.scheduleUpdate(item);
                    }

                    const { changedRows } = await Payment.update()
                        .where('id', payments.map(p => p.id))
                        .set('transferFeeManualCharged', SQL.column('transferFeeManual'))
                        .update();
                    if (changedRows !== payments.length) {
                        console.error('Unexpected change in transferFeeManualCharged. Expected ' + payments.length + ', updated only ' + changedRows);
                    }
                }
            }
        }
    }
}
