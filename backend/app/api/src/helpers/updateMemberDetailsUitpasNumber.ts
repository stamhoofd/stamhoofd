import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { isSimpleError, SimpleError } from '@simonbackx/simple-errors';
import { Member } from '@stamhoofd/models';
import { MemberDetails, ReviewTimes, UitpasSocialTariff, UitpasSocialTariffStatus } from '@stamhoofd/structures';
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

    const result = await UitpasService.checkUitpasNumber(details.uitpasNumberDetails.uitpasNumber);

    // never thrown an error if a succesful response was received
    if (result.response) {
        const socialTariff = uitpasApiResponseToSocialTariff(result.response);

        details.uitpasNumberDetails.socialTariff = socialTariff;
        return true;
    }

    if (result.error) {
        throw result.error;
    }

    // should never happen
    return false;
}

/**
 * Updates the social tariff if an uitpas number is set.
 * Removes uitpas number reviewed on error.
 * @param details
 * @returns whether the social tariff was updated
 */
export async function updateMemberDetailsUitpasNumberForPatch(memberId: string, details: MemberDetails, previousUitpasNumber: string | null): Promise<boolean> {
    if (!details.uitpasNumberDetails) {
        return false;
    }

    const wasActive = details.uitpasNumberDetails.socialTariff.isActive;

    let isUpdated = false;

    try {
        isUpdated = await updateMemberDetailsUitpasNumber(details);
    }
    catch (error: any) {
        const isUitpasEqual = previousUitpasNumber !== null && previousUitpasNumber === details.uitpasNumberDetails.uitpasNumber;

        if (isSimpleError(error)) {
            if (error.code === 'unknown_uitpas_number') {
                if (isUitpasEqual) {
                    // set the status of the social tariff to unknown if the uitpas number did not change and the number is unknown
                    const member = await Member.getByID(memberId);
                    if (member && member.details.uitpasNumberDetails) {
                        member.details.uitpasNumberDetails.socialTariff = UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.Unknown,
                        });

                        await member.save();
                    }
                }

                // always throw an error if the number is unknown by the uitpas api
                throw error;
            }
        }

        // do not throw if the number did not change
        if (isUitpasEqual) {
            console.error(`Catched error while updating social tariff for member (uitpas number did not change) ${memberId}:`, error.message);
            return false;
        }

        throw error;
    }

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

export function didUitpasReviewChange(reviewTimesPatch: ReviewTimes | AutoEncoderPatchType<ReviewTimes> | undefined, originalReviewTimes: ReviewTimes): boolean {
    const newReview = reviewTimesPatch?.times.find(t => t.name === 'uitpasNumber');
    if (!newReview) {
        return false;
    }

    const lastReviewTime = originalReviewTimes.getLastReview('uitpasNumber');
    if (!lastReviewTime) {
        return true;
    }

    return newReview.reviewedAt.getTime() !== lastReviewTime.getTime();
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
