import { Decoder } from "@simonbackx/simple-encoding";
import { CenteredMessage, Toast, useContext, useOrganization } from "@stamhoofd/components";
import { useOrganizationManager, useRequestOwner } from "@stamhoofd/networking";
import {
    OrganizationRegistrationPeriod,
    SetupStep,
    SetupStepType,
} from "@stamhoofd/structures";
import { computed, ComputedRef, readonly, Ref, ref } from "vue";

export type UseReview = {
    readonly step: ComputedRef<SetupStep | undefined>;
    readonly checkboxValue: Ref<boolean>;
    readonly save: () => Promise<boolean>;
    readonly setValue: (value: boolean) => void;
    readonly type: SetupStepType;
    readonly isSaving: Ref<boolean>,
    readonly hasChanges: ComputedRef<boolean>;
    readonly isDone: ComputedRef<boolean>;
    readonly overrideIsDone: Ref<boolean | null>;
    readonly forceUpdate: () => Promise<void>;
}

export function useReview(type: SetupStepType): UseReview {
    const organizationManager = useOrganizationManager();
    const organization$ = useOrganization();
    const context = useContext();
    const owner = useRequestOwner();
    const step = computed(() => organization$.value?.period.setupSteps.get(type));
    let originalCheckboxValue = !!step.value?.isReviewed;
    const checkboxValue = ref(originalCheckboxValue);
    const isSaving = ref(false);
    const hasChanges = computed(() => originalCheckboxValue !== checkboxValue.value);
    const overrideIsDone = ref<boolean | null>(null);
    const isDone = computed(() => overrideIsDone.value !== null ? overrideIsDone.value : !!step.value?.isDone);

    const updateReviewedAt = async (isReviewed: boolean): Promise<boolean> => {
        if(!hasChanges.value) return true;

        const periodId = organization$.value?.period.id;
        if (!periodId) {
            return false;
        }

        try {
            isSaving.value = true;
            const updatedPeriod =
                await context.value.authenticatedServer.request({
                    method: "POST",
                    path: `/organization/registration-period/${periodId}/setup-steps/review`,
                    body: {type, isReviewed},
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
            isSaving.value = false;
            return false;
        }

        isSaving.value = false;
        return true;
    };

    const save = async () => {
        if(!hasChanges.value) return true;

        const isConfirm = checkboxValue.value ? await CenteredMessage.confirm("Ben je zeker dat je alles goed hebt nagekeken?", "Markeer als nagekeken") : 
            await CenteredMessage.confirm("Ben je zeker dat je deze stap wil markeren als niet nagekeken?", "Ja");

        if(!isConfirm) return false;

        const isReviewed = checkboxValue.value;
        const isSuccess = await updateReviewedAt(isReviewed);
        if(isSuccess) {
            originalCheckboxValue = isReviewed;
        }
        return isSuccess;
    }

    const setValue = (value: boolean) => {
        checkboxValue.value = value
    }

    const forceUpdate = () => organizationManager.value.forceUpdate().catch(console.error);

    return {
        step,
        checkboxValue: readonly(checkboxValue),
        save,
        setValue,
        type,
        isSaving: readonly(isSaving),
        hasChanges,
        isDone,
        overrideIsDone,
        forceUpdate
    }
}
