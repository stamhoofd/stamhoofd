import { Decoder } from "@simonbackx/simple-encoding";
import { CenteredMessage, Toast, useContext, useOrganization } from "@stamhoofd/components";
import { useOrganizationManager, useRequestOwner } from "@stamhoofd/networking";
import {
    OrganizationRegistrationPeriod,
    SetupStep,
    SetupStepType,
} from "@stamhoofd/structures";
import { computed, ComputedRef, readonly, Ref, ref } from "vue";

export type ReviewCheckboxData = {
    step: SetupStep | undefined;
    checkboxValue: boolean;
    setValue: (value: boolean) => void;
    type: SetupStepType;
    isDone: boolean;
}

export type UseReview = {
    readonly step: ComputedRef<SetupStep | undefined>;
    readonly save: () => Promise<boolean>;
    readonly forceUpdate: () => Promise<void>;
    readonly $isSaving: Ref<boolean>,
    readonly $hasChanges: ComputedRef<boolean>;
    readonly $overrideIsDone: Ref<boolean | null>;
    readonly $reviewCheckboxData: ComputedRef<ReviewCheckboxData>
}

export function useReview(type: SetupStepType): UseReview {
    const organizationManager = useOrganizationManager();
    const owner = useRequestOwner();
    
    const $organization = useOrganization();
    const $context = useContext();
    const $step = computed(() => $organization.value?.period.setupSteps.get(type));
    let originalCheckboxValue = !!$step.value?.isReviewed;

    const $checkboxValue = ref(originalCheckboxValue);
    const isSaving = ref(false);
    const $hasChanges = computed(() => originalCheckboxValue !== $checkboxValue.value);
    const $overrideIsDone = ref<boolean | null>(null);
    const $isDone = computed(() => $overrideIsDone.value !== null ? $overrideIsDone.value : !!$step.value?.isDone);

    const updateReviewedAt = async (isReviewed: boolean): Promise<boolean> => {
        if(!$hasChanges.value) return true;

        const periodId = $organization.value?.period.id;
        if (!periodId) {
            return false;
        }

        try {
            isSaving.value = true;
            const updatedPeriod =
                await $context.value.authenticatedServer.request({
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
            Toast.fromError(error).show()
            isSaving.value = false;
            return false;
        }

        isSaving.value = false;
        return true;
    };

    const save = async () => {
        if(!$hasChanges.value) return true;

        const isConfirm = $checkboxValue.value ? await CenteredMessage.confirm($t(`91edc253-7664-4d27-bdea-e050a7c0b553`), $t(`168f25d2-74c1-4c18-818a-796e7a8fee41`)) : 
            await CenteredMessage.confirm($t(`203da4cf-6fd5-46d5-8fdb-2695ba34e5d8`), $t(`de05b76e-191f-4c55-900d-5e396c819bc0`));

        if(!isConfirm) return false;

        const isReviewed = $checkboxValue.value;
        const isSuccess = await updateReviewedAt(isReviewed);
        if(isSuccess) {
            originalCheckboxValue = isReviewed;
        }
        return isSuccess;
    }

    const setValue = (value: boolean) => {
        $checkboxValue.value = value
    }

    const forceUpdate = () => organizationManager.value.forceUpdate().catch(console.error);

    const $reviewCheckboxData = computed<ReviewCheckboxData>(() => {
        return {
            step: $step.value,
            checkboxValue: $checkboxValue.value,
            setValue,
            type,
            isDone: $isDone.value
        }
    })

    return {
        step: $step,
        save,
        forceUpdate,
        $isSaving: readonly(isSaving),
        $hasChanges: $hasChanges,
        $overrideIsDone: $overrideIsDone,
        $reviewCheckboxData
    }
}
