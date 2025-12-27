import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { MemberDetails } from '@stamhoofd/structures';
import { UitpasService } from '../services/uitpas/UitpasService.js';

export async function updateMemberDetailsUitpasNumber(details: MemberDetails | AutoEncoderPatchType<MemberDetails>) {
    if (details.uitpasNumber) {
        const result = await UitpasService.checkUitpasNumber(details.uitpasNumber);
        details.socialTariffCheckedWithApiAt = new Date();

        if (result.socialTariff.endDate) {
            try {
                details.socialTariffEndDate = new Date(result.socialTariff.endDate);
            }
            catch (e) {
                console.error(e);
                console.error('endDate: ', result.socialTariff.endDate);

                // prevent unreadable error message if invalid end date
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'Invalid social tariff end date',
                    human: $t('De einddatum van jouw kansentarief is ongeldig. Neem contact op met ons om het probleem te verhelpen.'),
                });
            }
        }
    }
}
