<template>
    <SaveView :disabled="!hasChanges" :title="$t(`%Su`)" @save="save">
        <h1 v-if="isNew">
            {{ $t('%QI') }}
        </h1>
        <h1 v-else>
            {{ $t('%Sr') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%Sv`)">
            <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t('%2w')" autocomplete="off">
        </STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`%6o`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`%Sw`)" />
        </STInputBox>
        <EditDeliveryRegionsSection :delivery-method="patchedDeliveryMethod" @patch="addPatch" />

        <EditTimeSlotsSection :webshop="webshop" :time-slots="patchedDeliveryMethod.timeSlots" :title="$t(`%Sx`)" @patch="patchTimeSlots">
            <p>{{ $t('%Ss') }}</p>
        </EditTimeSlotsSection>

        <hr><h2>{{ $t('%Sn') }}</h2>
        <CheckoutMethodPriceBox :checkout-method-price="patchedDeliveryMethod.price" :error-box="errors.errorBox" @patch="patchPrice" />

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%St') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
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
