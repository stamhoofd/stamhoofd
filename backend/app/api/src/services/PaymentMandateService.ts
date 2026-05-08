import type { Organization, User } from '@stamhoofd/models';
import { Platform } from '@stamhoofd/models';
import type { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { MollieService } from './MollieService.js';

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
}
