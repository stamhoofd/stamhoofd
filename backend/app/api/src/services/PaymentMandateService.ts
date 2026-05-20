import type { User } from '@stamhoofd/models';
import { Organization } from '@stamhoofd/models';
import { Platform } from '@stamhoofd/models';
import { PaymentMandateStatus  } from '@stamhoofd/structures/PaymentMandate.js';
import type {PaymentMandate} from '@stamhoofd/structures/PaymentMandate.js';
import { MollieService } from './MollieService.js';
import { SimpleError } from '@simonbackx/simple-errors';
import { Context } from '../helpers/Context.js';
import { PaymentProvider } from '@stamhoofd/structures';

export class PaymentMandateService {
    static async getMandates({ sellingOrganization, user, payingOrganization }: {
        sellingOrganization: Organization,

        /**
         * Mandates for B2B payments
         */
        payingOrganization: Organization | null, 

        /**
         * Not yet supported, but in the future you'll be able to save mandates for a certain user.
         * Only for B2C payments
         */
        user: User | null,
    }): Promise<PaymentMandate[]> {
        if (!payingOrganization) {
            // Not yet supportedd
            return [];
        }

        const mollieService = await MollieService.create({sellingOrganization});
        if (!mollieService) {
            return [];
        }

        if (sellingOrganization.id !== (await Platform.getShared()).membershipOrganizationId) {
            // Not yet supported
            return [];
        }

        return await mollieService.getMandates({payingOrganization, user});
    }

    static async deleteMandate({ mandateId, sellingOrganization, user, payingOrganization }: {
        mandateId: string, 

        sellingOrganization: Organization,

        /**
         * Mandates for B2B payments
         */
        payingOrganization: Organization | null, 

        /**
         * Not yet supported, but in the future you'll be able to save mandates for a certain user.
         * Only for B2C payments
         */
        user: User | null,
    }) {
        const mandates = await PaymentMandateService.getMandates({
            sellingOrganization,
            user,
            payingOrganization
        });
        const {grouped} = this.groupByMandate(mandates);
        const match = mandates.find(m => m.id === mandateId);

        if (!match) {
            // Not allowed or does not exist
            throw new SimpleError({
                code: 'not_allowed',
                message: 'Mandate not found',
                human: $t('%1Q1')
            })
        }

        if (match.isDefault) {
            if (!Context.optionalAuth?.hasPlatformFullAccess()) {
                throw new SimpleError({
                    code: 'not_allowed',
                    message: 'You cannot delete the default mandate',
                    human: $t('%1Qu')
                })
            }
        }

        if (grouped.size <= 1) {
            if (!Context.optionalAuth?.hasPlatformFullAccess()) {
                throw new SimpleError({
                    code: 'not_allowed',
                    message: 'You cannot delete the last mandate',
                    human: $t('%1Q7')
                })
            }
        }

        // Delete all that have the same card linked to it
        const deleteId = match.identifier;
        for (const mandate of mandates) {
            if (mandate.identifier === deleteId) {
                // delete (todo)
                if (mandate.provider === PaymentProvider.Mollie) {
                    const mollieService = await MollieService.create({sellingOrganization});
                    if (!mollieService) {
                        return [];
                    }

                    try {
                        await mollieService.deleteMandate({
                            mandateId: mandate.id,
                            payingOrganization,
                            user
                        })
                    } catch (e) {
                        console.error('Failed to delete Mollie mandate', mandateId, e)
                    }
                }
            }
        }
    }

    static async setDefaultMandate({ mandateId, sellingOrganization, payingUserId, payingOrganizationId }: {
        mandateId: string, 

        sellingOrganization: Organization,

        /**
         * Mandates for B2B payments
         */
        payingOrganizationId: Organization | string | null, 

        /**
         * Not yet supported, but in the future you'll be able to save mandates for a certain user.
         * Only for B2C payments
         */
        payingUserId: string | null,
    }) {
        try {
            if (!payingOrganizationId) {
                // Not supported yet
                return;
            }

            if (sellingOrganization.id !== (await Platform.getShared()).membershipOrganizationId) {
                // Not yet supported
                return [];
            }
        
            // Set as default
            if (payingOrganizationId) {
                const payingOrganization = typeof payingOrganizationId === 'string' ? await Organization.getByID(payingOrganizationId) : payingOrganizationId;
                if (payingOrganization) {
                    console.log('Saving ' + mandateId + ' as default mandate for organization ' + payingOrganization.id + ' ' + payingOrganization.name)
                    payingOrganization.serverMeta.mollieMandateId = mandateId
                    await payingOrganization.save()
                }
            }
        } catch (e) {
            console.error('Failed to save default mandate for mandate ' + mandateId + ' in organization ' + (typeof payingOrganizationId === 'string' ? payingOrganizationId : payingOrganizationId?.id), {cause: e})

            throw new SimpleError({
                code: 'failed',
                message: 'Failed to update default mandate',
                human: $t('%1S4')
            })
        }
    }

    /**
     * The same mandates should be bundled and only the most recent active one should be returned
     */
    static groupByMandate(base: PaymentMandate[]) {
        base.sort((a, b) => {
            if (a.status === PaymentMandateStatus.Valid && b.status !== PaymentMandateStatus.Valid ) return -1;
            if (a.status !== PaymentMandateStatus.Valid && b.status === PaymentMandateStatus.Valid ) return 1;
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
                existing.push(mandate)
                continue; // Skip duplicates
            }

            found.set(mandate.identifier || '', [mandate]);
            cleaned.push(mandate);
        }

        // Restort as isDefault might have changed
        cleaned.sort((a, b) => {
            if (a.status === PaymentMandateStatus.Valid && b.status !== PaymentMandateStatus.Valid ) return -1;
            if (a.status !== PaymentMandateStatus.Valid && b.status === PaymentMandateStatus.Valid ) return 1;
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        return {
            mandates: cleaned.filter(b => b.status === PaymentMandateStatus.Valid  || b.isDefault),
            grouped: found
        }
    }
}
