import { SetupStepReview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function useSetupStepReviewDescription(): { getDescription: (review: SetupStepReview | null, short?: boolean, textIfNotReviewed?: string) => string } {
    function getDescription(review: SetupStepReview | null, short = false, textIfNotReviewed = $t('586cb220-498a-496a-8db5-89a4f10ba3df')): string {
        if (review) {
            const reviewedAtString = Formatter.date(review.date, true);
            const userName = review.userName;

            if (short) {
                // todo: translate
                return `Nagekeken op ${reviewedAtString}`;
            }
            // todo: translate
            return `Gemarkeerd als nagekeken op ${reviewedAtString} door ${userName}`;
        }

        return textIfNotReviewed;
    }

    return {
        getDescription,
    };
}
