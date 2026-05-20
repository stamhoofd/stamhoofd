<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !hasReviewChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p>{{ $t('%Oe') }} <a class="inline-link" :href="$domains.getDocs('betaalmethodes-voor-inschrijvingen-instellen')" target="_blank">{{ $t('%OH') }}</a>.</p>

        <div v-if="isReview" class="container">
            <ReviewCheckbox :data="review.reviewCheckboxData.value" />
            <hr>
        </div>

        <STErrorsDefault :error-box="errors.errorBox" />

        <EditPaymentMethodsBox
            type="registration" 
            :config="organization.meta.registrationPaymentConfiguration" 
            :private-config="organization.privateMeta?.registrationPaymentConfiguration ?? PrivatePaymentConfiguration.create({})" 
            :validator="errors.validator" 
            @patch:config="addPatch({meta: OrganizationMetaData.patch({registrationPaymentConfiguration: $event})})" 
            @patch:private-config="addPatch({privateMeta: OrganizationPrivateMetaData.patch({registrationPaymentConfiguration: $event})})" 
        />
    </SaveView>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { usePatch } from '@stamhoofd/components/hooks/usePatch';
import { useSetupStepTranslations } from '@stamhoofd/components/hooks/useSetupStepTranslations.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { usePatchOrganization } from '@stamhoofd/components/organizations/usePatchOrganization';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import ReviewCheckbox from '@stamhoofd/components/ReviewCheckbox.vue';
import { useReview } from '@stamhoofd/components/useReview.ts';
import { OrganizationMetaData, OrganizationPrivateMetaData, PrivatePaymentConfiguration, SetupStepType } from '@stamhoofd/structures';
import { ref } from 'vue';
import EditPaymentMethodsBox from '../../../components/EditPaymentMethodsBox.vue';

const props = withDefaults(defineProps<{
    isReview?: boolean
}>(), {
    isReview: false,
});

const errors = useErrors()
const saving = ref(false);
const setupTranslations = useSetupStepTranslations();
const review = useReview(SetupStepType.Payment);
const hasReviewChanges = review.hasChanges;
const patchOrganization = usePatchOrganization()
const dismiss = useDismiss()

const title = props.isReview ? setupTranslations.getReviewTitle(SetupStepType.Payment) : $t('%41');
const original = useRequiredOrganization()
const {patched: organization, patch, addPatch, hasChanges, reset} = usePatch(original)

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;

    try {
        const valid = await errors.validator.validate();

        if (!valid) {
            return;
        }

        if (hasChanges.value) {
            await patchOrganization(patch.value);
            reset()
        }

        if (hasReviewChanges.value) {
            await review.save();
        }

        new Toast($t('%HA'), 'success green').show();
        await dismiss({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        saving.value = false;
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
