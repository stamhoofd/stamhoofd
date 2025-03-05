<template>
    <SaveView :disabled="!hasChanges" @save="save" :title="$t(`730bb38e-ee06-482e-806b-9da0ccb27635`)">
        <h1 v-if="isNew">
            {{ $t('095825af-b8fd-4c24-a660-f171610a2805') }}
        </h1>
        <h1 v-else>
            {{ $t('e773a626-5bbe-4868-9317-ff7c9045de80') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`e98c51dc-10e4-48b8-8bd4-e71aa0d687d4`)">
            <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t('0d4b25fe-6a3d-480b-86e8-e21c664a15ee')" autocomplete="off"></STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`fd09cc29-b650-4a0a-a211-b5535f8bb4d4`)"/>
        </STInputBox>
        <EditDeliveryRegionsSection :delivery-method="patchedDeliveryMethod" @patch="addPatch"/>

        <EditTimeSlotsSection :webshop="webshop" :time-slots="patchedDeliveryMethod.timeSlots" @patch="patchTimeSlots" :title="$t(`978602ea-c991-4be8-bf16-c01017515357`)">
            <p>{{ $t('557d8eeb-bd42-4de5-97a7-f792f0cbe56c') }}</p>
        </EditTimeSlotsSection>

        <hr><h2>{{ $t('c9b5231b-4f72-4afd-8be3-54a4b92bc3e4') }}</h2>
        <CheckoutMethodPriceBox :checkout-method-price="patchedDeliveryMethod.price" :error-box="errors.errorBox" @patch="patchPrice"/>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('4d9bfdaf-759c-40b4-8aed-4865f8fdc95e') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
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
