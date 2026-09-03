import type { User } from '@stamhoofd/models';
import { BlockedPaymentMandate, Organization, PaymentMandateChargebacks } from '@stamhoofd/models';
import { Platform } from '@stamhoofd/models';
import { PaymentMandateStatus } from '@stamhoofd/structures/PaymentMandate.js';
import type { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { MollieService } from './MollieService.js';
import { SimpleError } from '@simonbackx/simple-errors';
import { Context } from '../helpers/Context.js';
import { PaymentProvider } from '@stamhoofd/structures';

export class PaymentMandateService {
    static async getMandates({ sellingOrganization, user, payingOrganization }: {
        sellingOrganization: Organization;

        /**
         * Mandates for B2B payments
         */
        payingOrganization: Organization | null;

        /**
         * Not yet supported, but in the future you'll be able to save mandates for a certain user.
         * Only for B2C payments
         */
        user: User | null;
    }): Promise<PaymentMandate[]> {
        if (!payingOrganization) {
            // Not yet supportedd
            return [];
        }

        const mollieService = await MollieService.create({ sellingOrganization });
        if (!mollieService) {
            return [];
        }

        if (sellingOrganization.id !== (await Platform.getShared()).membershipOrganizationId) {
            // Not yet supported
            return [];
        }

        const mandates = await mollieService.getMandates({ payingOrganization, user });
        this.applyBlockedMandates(mandates, payingOrganization);
        return mandates;
    }

    /**
     * A block applies to every mandate for the same card or bank account (also ones created after the block),
     * so re-adding the same card does not make it usable again.
     */
    static applyBlockedMandates(mandates: PaymentMandate[], payingOrganization: Organization) {
        const blockedIdentifiers = new Map<string, Date>();

        for (const blocked of payingOrganization.serverMeta.blockedMandates) {
            if (blocked.identifier) {
                const existing = blockedIdentifiers.get(blocked.identifier);
                if (!existing || existing > blocked.blockedAt) {
                    blockedIdentifiers.set(blocked.identifier, blocked.blockedAt);
                }
            }
        }

        for (const mandate of mandates) {
            const blocked = payingOrganization.serverMeta.blockedMandates.find(b => b.id === mandate.id);
            if (blocked) {
                mandate.blockedAt = blocked.blockedAt;

                // Blocks stored without identifier
                if (mandate.identifier) {
                    const existing = blockedIdentifiers.get(mandate.identifier);
                    if (!existing || existing > blocked.blockedAt) {
                        blockedIdentifiers.set(mandate.identifier, blocked.blockedAt);
                    }
                }
            }
        }

        for (const mandate of mandates) {
            if (!mandate.blockedAt && mandate.identifier) {
                mandate.blockedAt = blockedIdentifiers.get(mandate.identifier) ?? null;
            }
        }
    }

    /**
     * Block a mandate on our side only (it stays valid at the provider), so it can no longer be used for
     * new payments. Other mandates for the same card or bank account are blocked too.
     */
    static async blockMandate({ mandateId, sellingOrganization, payingOrganizationId, paymentId }: {
        mandateId: string;
        sellingOrganization: Organization;
        payingOrganizationId: string;
        paymentId: string | null;
    }) {
        const payingOrganization = await Organization.getByID(payingOrganizationId, true);

        const mandates = await PaymentMandateService.getMandates({
            sellingOrganization,
            user: null,
            payingOrganization,
        });
        const match = mandates.find(m => m.id === mandateId);
        const identifier = match?.identifier ?? null;
        const ids = new Set([mandateId]);

        if (identifier) {
            for (const mandate of mandates) {
                if (mandate.identifier === identifier) {
                    ids.add(mandate.id);
                }
            }
        }

        let changed = false;
        for (const id of ids) {
            if (payingOrganization.serverMeta.blockedMandates.find(b => b.id === id)) {
                continue;
            }
            console.log('Blocking mandate ' + id + ' for organization ' + payingOrganization.id + ' ' + payingOrganization.name);
            payingOrganization.serverMeta.blockedMandates.push(BlockedPaymentMandate.create({ id, identifier, paymentId }));
            changed = true;
        }

        if (payingOrganization.serverMeta.mollieMandateId && ids.has(payingOrganization.serverMeta.mollieMandateId)) {
            // Move the default to the first usable mandate
            this.applyBlockedMandates(mandates, payingOrganization);
            const replacement = this.groupByMandate(mandates).mandates.find(m => !m.isBlocked);
            if (replacement) {
                console.log('Changing default mandate to ' + replacement.id + ' for organization ' + payingOrganization.id);
                payingOrganization.serverMeta.mollieMandateId = replacement.id;
                changed = true;
            }
        }

        if (changed) {
            await payingOrganization.save();
        }
    }

    /**
     * Keep the most recent chargebacks per mandate (last 12 months, at most 5)
     */
    static async registerChargeback({ mandateId, sellingOrganization, payingOrganizationId, date }: {
        mandateId: string;
        sellingOrganization: Organization;
        payingOrganizationId: string;
        date: Date;
    }) {
        const payingOrganization = await Organization.getByID(payingOrganizationId, true);
        let entry = payingOrganization.serverMeta.mandateChargebacks.find(c => c.id === mandateId);

        if (!entry) {
            const mandates = await PaymentMandateService.getMandates({
                sellingOrganization,
                user: null,
                payingOrganization,
            });
            entry = PaymentMandateChargebacks.create({
                id: mandateId,
                identifier: mandates.find(m => m.id === mandateId)?.identifier ?? null,
            });
            payingOrganization.serverMeta.mandateChargebacks.push(entry);
        }

        entry.add(date);
        await payingOrganization.save();
    }

    /**
     * Lift the block of a mandate and of all mandates for the same card or bank account. Used when the
     * card or account is validated again with a new payment, or when a seller unblocks it manually.
     */
    static async unblockMandate({ mandateId, sellingOrganization, payingOrganizationId }: {
        mandateId: string;
        sellingOrganization: Organization;
        payingOrganizationId: string;
    }) {
        const payingOrganization = await Organization.getByID(payingOrganizationId, true);
        if (payingOrganization.serverMeta.blockedMandates.length === 0) {
            return;
        }

        const mandates = await PaymentMandateService.getMandates({
            sellingOrganization,
            user: null,
            payingOrganization,
        });
        const match = mandates.find(m => m.id === mandateId);
        const identifier = match?.identifier ?? payingOrganization.serverMeta.blockedMandates.find(b => b.id === mandateId)?.identifier ?? null;
        const ids = new Set([mandateId]);

        if (identifier) {
            for (const mandate of mandates) {
                if (mandate.identifier === identifier) {
                    ids.add(mandate.id);
                }
            }
        }

        const remaining = payingOrganization.serverMeta.blockedMandates.filter(b => !ids.has(b.id) && !(identifier && b.identifier === identifier));
        if (remaining.length === payingOrganization.serverMeta.blockedMandates.length) {
            return;
        }

        console.log('Unblocking mandate ' + mandateId + ' for organization ' + payingOrganization.id + ' ' + payingOrganization.name);
        payingOrganization.serverMeta.blockedMandates = remaining;
        await payingOrganization.save();
    }

    static async deleteMandate({ mandateId, sellingOrganization, user, payingOrganization }: {
        mandateId: string;

        sellingOrganization: Organization;

        /**
         * Mandates for B2B payments
         */
        payingOrganization: Organization | null;

        /**
         * Not yet supported, but in the future you'll be able to save mandates for a certain user.
         * Only for B2C payments
         */
        user: User | null;
    }) {
        const mandates = await PaymentMandateService.getMandates({
            sellingOrganization,
            user,
            payingOrganization,
        });
        const { grouped } = this.groupByMandate(mandates);
        const match = mandates.find(m => m.id === mandateId);

        if (!match) {
            // Not allowed or does not exist
            throw new SimpleError({
                code: 'not_allowed',
                message: 'Mandate not found',
                human: $t('%1Q1'),
            });
        }

        if (match.isDefault) {
            if (!Context.optionalAuth?.hasPlatformFullAccess()) {
                throw new SimpleError({
                    code: 'not_allowed',
                    message: 'You cannot delete the default mandate',
                    human: $t('%1Qu'),
                });
            }
        }

        const usableGroups = [...grouped.values()].filter(group => group.some(m => m.status === PaymentMandateStatus.Valid && !m.isBlocked));
        if (!match.isBlocked && usableGroups.length <= 1) {
            if (!Context.optionalAuth?.hasPlatformFullAccess()) {
                throw new SimpleError({
                    code: 'not_allowed',
                    message: 'You cannot delete the last usable mandate',
                    human: $t('Je kan de laatste bruikbare betaalmethode niet verwijderen. Voeg eerst een nieuwe betaalmethode toe.'),
                });
            }
        }

        // Delete all that have the same card linked to it
        const deleteId = match.identifier;
        for (const mandate of mandates) {
            if (mandate.identifier === deleteId) {
                // delete (todo)
                if (mandate.provider === PaymentProvider.Mollie) {
                    const mollieService = await MollieService.create({ sellingOrganization });
                    if (!mollieService) {
                        return [];
                    }

                    try {
                        await mollieService.deleteMandate({
                            mandateId: mandate.id,
                            payingOrganization,
                            user,
                        });
                    } catch (e) {
                        console.error('Failed to delete Mollie mandate', mandateId, e);
                    }
                }
            }
        }
    }

    static async setDefaultMandate({ mandateId, sellingOrganizationId, payingUserId, payingOrganizationId }: {
        mandateId: string;

        sellingOrganizationId: string;

        /**
         * Mandates for B2B payments
         */
        payingOrganizationId: Organization | string | null;

        /**
         * Not yet supported, but in the future you'll be able to save mandates for a certain user.
         * Only for B2C payments
         */
        payingUserId: string | null;
    }) {
        try {
            if (!payingOrganizationId) {
                // Not supported yet
                return;
            }

            if (sellingOrganizationId !== (await Platform.getShared()).membershipOrganizationId) {
                // Not yet supported
                return [];
            }

            // Set as default
            if (payingOrganizationId) {
                const payingOrganization = typeof payingOrganizationId === 'string' ? await Organization.getByID(payingOrganizationId) : payingOrganizationId;
                if (payingOrganization) {
                    console.log('Saving ' + mandateId + ' as default mandate for organization ' + payingOrganization.id + ' ' + payingOrganization.name);
                    payingOrganization.serverMeta.mollieMandateId = mandateId;
                    await payingOrganization.save();
                }
            }
        } catch (e) {
            console.error('Failed to save default mandate for mandate ' + mandateId + ' in organization ' + (typeof payingOrganizationId === 'string' ? payingOrganizationId : payingOrganizationId?.id), { cause: e });

            throw new SimpleError({
                code: 'failed',
                message: 'Failed to update default mandate',
                human: $t('%1S4'),
            });
        }
    }

    /**
     * The same mandates should be bundled and only the most recent active one should be returned
     */
    static groupByMandate(base: PaymentMandate[]) {
        base.sort((a, b) => {
            if (a.status === PaymentMandateStatus.Valid && b.status !== PaymentMandateStatus.Valid) return -1;
            if (a.status !== PaymentMandateStatus.Valid && b.status === PaymentMandateStatus.Valid) return 1;
            if (!a.isBlocked && b.isBlocked) return -1;
            if (a.isBlocked && !b.isBlocked) return 1;
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
        const found = new Map<string, PaymentMandate[]>();

        const cleaned: PaymentMandate[] = [];

        for (const mandate of base) {
            const existing = found.get(mandate.identifier || '');

            if (existing) {
                if (mandate.isDefault) {
                    // Make sure first is also marked as default
                    existing[0].isDefault = true;
                }
                existing.push(mandate);
                continue; // Skip duplicates
            }

            found.set(mandate.identifier || '', [mandate]);
            cleaned.push(mandate);
        }

        // Restort as isDefault might have changed
        cleaned.sort((a, b) => {
            if (a.status === PaymentMandateStatus.Valid && b.status !== PaymentMandateStatus.Valid) return -1;
            if (a.status !== PaymentMandateStatus.Valid && b.status === PaymentMandateStatus.Valid) return 1;
            if (!a.isBlocked && b.isBlocked) return -1;
            if (a.isBlocked && !b.isBlocked) return 1;
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });

        return {
            mandates: cleaned.filter(b => b.status === PaymentMandateStatus.Valid || b.isDefault),
            grouped: found,
        };
    }
}
