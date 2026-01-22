import { SimpleError } from '@simonbackx/simple-errors';
import { MemberDetails, UitpasSocialTariff, UitpasSocialTariffStatus } from '@stamhoofd/structures';
import { UitpasService } from '../services/uitpas/UitpasService.js';
import { UitpasNumberSuccessfulResponse } from '../services/uitpas/checkUitpasNumbers.js';

/**
 * Updates the social tariff if an uitpas number is set.
 * @param details
 * @returns whether the social tariff was updated
 */
export async function updateMemberDetailsUitpasNumber(details: MemberDetails): Promise<boolean> {
    if (!details.uitpasNumberDetails) {
        return false;
    }

    if (!details.uitpasNumberDetails.socialTariff.shouldUpdate) {
        return false;
    }

    const result = await UitpasService.checkUitpasNumber(details.uitpasNumberDetails.uitpasNumber);
    const response: UitpasNumberSuccessfulResponse | undefined = result.response;

    if (response) {
        const socialTariff = uitpasApiResponseToSocialTariff(response);

        details.uitpasNumberDetails.socialTariff = socialTariff;
        return true;
    }
    else if (result.error) {
        // only throw if active or unknown
        if (details.uitpasNumberDetails.socialTariff.isUpdateRequired(details.requiresFinancialSupport)) {
            throw result.error;
        }
    }

    return false;
}

/**
 * Updates the social tariff if an uitpas number is set.
 * Removes uitpas number reviewed on error.
 * @param details
 * @returns whether the social tariff was updated
 */
export async function updateMemberDetailsUitpasNumberForPatch(details: MemberDetails, previousUitpasNumber: string | null): Promise<boolean> {
    if (!details.uitpasNumberDetails) {
        return false;
    }

    const wasActive = details.uitpasNumberDetails.socialTariff.isActive;
    const isUpdated = await updateMemberDetailsUitpasNumber(details);

    // force a review if the social tariff changed from active to not active (and the number did not change)
    if (isUpdated
        // is uitpas equal
        && previousUitpasNumber !== null && previousUitpasNumber === details.uitpasNumberDetails.uitpasNumber
        // did change from active to not active
        && wasActive && !details.uitpasNumberDetails.socialTariff.isActive) {
        // force a review
        details.reviewTimes.removeReview('uitpasNumber');
    }

    return isUpdated;
}

export function uitpasApiResponseToSocialTariff(response: UitpasNumberSuccessfulResponse): UitpasSocialTariff {
    let endDate: Date | null = null;

    if (response.socialTariff.endDate) {
        try {
            endDate = new Date(response.socialTariff.endDate);
        }
        catch (e) {
            console.error(e);
            console.error('endDate: ', response.socialTariff.endDate);

            // prevent unreadable error message if invalid end date
            throw new SimpleError({
                code: 'invalid_data',
                message: 'Invalid social tariff end date',
                human: $t('De einddatum van jouw kansentarief is ongeldig. Neem contact op met ons om het probleem te verhelpen.'),
            });
        }
    }

    const status = uitpasSocialTariffStatusToEnum(response.socialTariff.status);

    return UitpasSocialTariff.create({
        status,
        endDate,
        updatedAt: new Date(),
    });
}

/**
 * Prevent bad input from uitpas api
 * @param status
 * @returns
 */
function uitpasSocialTariffStatusToEnum(status: 'ACTIVE' | 'EXPIRED' | 'NONE'): UitpasSocialTariffStatus {
    switch (status) {
        case 'ACTIVE':
            return UitpasSocialTariffStatus.Active;
        case 'EXPIRED':
            return UitpasSocialTariffStatus.Expired;
        case 'NONE':
            return UitpasSocialTariffStatus.None;
        default:
            return UitpasSocialTariffStatus.Unknown;
    }
}
