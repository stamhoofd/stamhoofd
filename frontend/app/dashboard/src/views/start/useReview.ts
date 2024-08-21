import { Decoder } from "@simonbackx/simple-encoding";
import { Toast, useContext, useOrganization } from "@stamhoofd/components";
import { useOrganizationManager, useRequestOwner } from "@stamhoofd/networking";
import {
    OrganizationRegistrationPeriod,
    SetupStepType,
} from "@stamhoofd/structures";
import { readonly } from "vue";

export function useReview() {
    const organizationManager = useOrganizationManager();
    const organization$ = useOrganization();
    const context = useContext();
    const owner = useRequestOwner();

    const markReviewed = async (type: SetupStepType): Promise<boolean> => await updateReviewedAt({type, isReviewed: true});

    const updateReviewedAt = async (body: {
        type: SetupStepType;
        isReviewed: boolean;
    }): Promise<boolean> => {
        const periodId = organization$.value?.period.id;
        if (!periodId) {
            return false;
        }

        try {
            const updatedPeriod =
                await context.value.authenticatedServer.request({
                    method: "POST",
                    path: `/organization/registration-period/${periodId}/setup-steps/review`,
                    body,
                    shouldRetry: false,
                    owner,
                    decoder:
                        OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>,
                });

            organizationManager.value.updatePeriods([updatedPeriod.data]);
        } catch (error) {
            // todo: translate
            new Toast(
                "Het voltooien van deze stap is mislukt.",
                "error red"
            ).show();
            return false;
        }

        return true;
    };

    return {
        markReviewed: readonly(markReviewed),
        updateReviewedAt: readonly(updateReviewedAt)
    }
}
