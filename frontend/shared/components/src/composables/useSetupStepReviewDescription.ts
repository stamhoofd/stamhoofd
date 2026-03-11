import { SetupStepReview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export function useSetupStepReviewDescription(): { getDescription: (review: SetupStepReview | null, short?: boolean, textIfNotReviewed?: string) => string } {
    function getDescription(review: SetupStepReview | null, short = false, textIfNotReviewed = $t('%6a')): string {
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
