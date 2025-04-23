<template>
    <SaveView :disabled="!hasChanges" :title="$t(`4662441a-09eb-4344-8f94-3c53035b81c1`)" @save="save">
        <h1 v-if="isNew">
            {{ $t('fe3e7e2f-0fd3-440a-a904-5fa99943371b') }}
        </h1>
        <h1 v-else>
            {{ $t('092e12ff-7c47-490a-908f-59a7eb28eaa0') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`cab8babf-3193-4087-8498-123cd6551134`)">
            <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t('0d4b25fe-6a3d-480b-86e8-e21c664a15ee')" autocomplete="off">
        </STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`8e80e892-591c-4f45-85f2-450348e969d6`)" />
        </STInputBox>
        <EditDeliveryRegionsSection :delivery-method="patchedDeliveryMethod" @patch="addPatch" />

        <EditTimeSlotsSection :webshop="webshop" :time-slots="patchedDeliveryMethod.timeSlots" :title="$t(`1a3a8678-28e3-4f6a-b968-c4a8844d79ff`)" @patch="patchTimeSlots">
            <p>{{ $t('e4f5a933-4bdf-4f2b-818a-db14e6be6ce0') }}</p>
        </EditTimeSlotsSection>

        <hr><h2>{{ $t('482bd766-39fa-4340-91b4-ae22a23d5fa5') }}</h2>
        <CheckoutMethodPriceBox :checkout-method-price="patchedDeliveryMethod.price" :error-box="errors.errorBox" @patch="patchPrice" />

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('a79aa774-00b4-46b6-8b99-b1ab1d8bf24e') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, SaveView, STErrorsDefault, STInputBox, useErrors, usePatch } from '@stamhoofd/components';
import { CheckoutMethodPrice, PrivateWebshop, WebshopDeliveryMethod, WebshopMetaData, WebshopTimeSlots } from '@stamhoofd/structures';

import { computed } from 'vue';
import CheckoutMethodPriceBox from './CheckoutMethodPriceBox.vue';
import EditDeliveryRegionsSection from './EditDeliveryRegionsSection.vue';
import EditTimeSlotsSection from './EditTimeSlotsSection.vue';

const props = defineProps<{
    webshop: PrivateWebshop;
    isNew: boolean;
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;
    deliveryMethod: WebshopDeliveryMethod;
}>();

const errors = useErrors();
const pop = usePop();

const { patch: patchDeliveryMethod, patched: patchedDeliveryMethod, addPatch, hasChanges } = usePatch(props.deliveryMethod);

const name = computed({
    get: () => patchedDeliveryMethod.value.name,
    set: (name: string) => {
        addPatch({ name });
    },
});

const description = computed({
    get: () => patchedDeliveryMethod.value.description,
    set: (description: string) => {
        addPatch({ description });
    },
});

function patchTimeSlots(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
    addPatch(WebshopDeliveryMethod.patch({ timeSlots: patch }));
}

function patchPrice(patch: AutoEncoderPatchType<CheckoutMethodPrice>) {
    addPatch(WebshopDeliveryMethod.patch({ price: patch }));
}

async function save() {
    if (!await errors.validator.validate()) {
        return;
    }
    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addPatch(patchDeliveryMethod.value);
    p.meta = meta;
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze leveringsoptie wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addDelete(props.deliveryMethod.id);
    p.meta = meta;
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script>
