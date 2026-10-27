<template>
    <SaveView :title="product.name" :disabled="!hasChanges" :save-text="$t('Klaar')" @save="save">
        <template #buttons>
            <button v-if="customerSettingsBox?.canAdd" class="button text only-icon-smartphone" type="button" data-testid="customer-settings-add-button" @click="customerSettingsBox?.showAddMenu($event)">
                <span class="icon add" />
                <span>{{ $t('%SN') }}</span>
            </button>
        </template>

        <h1>{{ product.name }}</h1>
        <p class="style-description-block">
            {{ $t('Kies welke gegevens je van elke deelnemer wil verzamelen.') }}
        </p>

        <CustomerSettingsBox ref="customerSettingsBox" :customer-settings="patched.resolvedCustomerSettings" :fixed-fields="['name']" :record-editor-settings="recordEditorSettings" :saved-record-ids="savedRecordIds" @patch="patchCustomerSettings" />
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@common/encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { Product } from '@stamhoofd/structures';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { useTemplateRef } from 'vue';
import CustomerSettingsBox from '../CustomerSettingsBox.vue';
import { createParticipantRecordEditorSettings, getParticipantSettingsPatch } from './participantSettings';

/**
 * Edits the participant details of one product, without opening the full product editor
 */
const props = defineProps<{
    product: Product;
    saveHandler: (patch: AutoEncoderPatchType<Product>) => void;
    /**
     * Ids of questions that are already saved: their type can no longer change because answers may exist
     */
    savedRecordIds: Set<string>;
}>();

const pop = usePop();
const { patched, patch, addPatch, hasChanges } = usePatch(props.product);
const customerSettingsBox = useTemplateRef('customerSettingsBox');

const recordEditorSettings = createParticipantRecordEditorSettings(props.product);

function patchCustomerSettings(settingsPatch: AutoEncoderPatchType<CustomerSettings>) {
    addPatch(getParticipantSettingsPatch(patched.value, settingsPatch));
}

async function save() {
    props.saveHandler(patch.value);
    await pop({ force: true });
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
}

defineExpose({
    shouldNavigateAway,
});
</script>
