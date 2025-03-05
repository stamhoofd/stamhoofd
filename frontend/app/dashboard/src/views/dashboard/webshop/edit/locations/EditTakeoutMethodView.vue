<template>
    <SaveView :title="locationTitleName" :disabled="!hasChanges" @save="save">
        <h1 v-if="isNew">
            {{ locationTitleName }} {{ $t('9523b774-a33e-40f8-900d-923f4aaa71db') }}
        </h1>
        <h1 v-else>
            {{ locationTitleName }} {{ $t('67c5998c-da2a-4c23-b089-86cc90f011e0') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`64e33410-9d9e-4a76-844c-be42b94e134b`)">
                    <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`77c758e8-d3cc-4893-a792-b96d74f04048`)"></STInputBox>

                <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
                    <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`71db27dd-c5bc-4a4b-8ff6-16ba6a67de21`)"/>
                </STInputBox>
            </div>
            <div>
                <AddressInput v-model="address" :validator="errors.validator" :required="true" :title="$t(`e6dc987c-457b-4253-9eef-db9ccdb774f1`)"/>
            </div>
        </div>

        <EditTimeSlotsSection v-if="isTakeout" :webshop="webshop" :time-slots="patchedTakeoutMethod.timeSlots" @patch="patchTimeSlots" :title="$t(`d254d685-ef46-4104-a88a-600066e8fe0a`)">
            <p>{{ $t('42a10e3a-f03a-49b9-bc68-b3f69cc5e764') }}</p>
        </EditTimeSlotsSection>
        <EditTimeSlotsSection v-else :webshop="webshop" :time-slots="patchedTakeoutMethod.timeSlots" @patch="patchTimeSlots" :title="$t(`5ccb0242-e879-424f-a3b9-b6e63d9d304a`)">
            <p>{{ $t('21893786-1c17-42b4-b773-757282826b28') }}</p>
        </EditTimeSlotsSection>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}
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
import { AddressInput, CenteredMessage, SaveView, STErrorsDefault, STInputBox, useErrors, usePatch } from '@stamhoofd/components';
import { CheckoutMethodType, PrivateWebshop, WebshopMetaData, WebshopOnSiteMethod, WebshopTakeoutMethod, WebshopTimeSlots } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditTimeSlotsSection from './EditTimeSlotsSection.vue';

const props = defineProps<{
    takeoutMethod: WebshopTakeoutMethod | WebshopOnSiteMethod;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;
}>();

const { patch: patchTakeoutMethod, patched: patchedTakeoutMethod, addPatch, hasChanges } = usePatch(props.takeoutMethod);

const errors = useErrors();
const pop = usePop();

const isTakeout = computed(() => props.takeoutMethod.type === CheckoutMethodType.Takeout);
const locationTitleName = computed(() => isTakeout.value ? 'Afhaallocatie' : 'Ter plaatse consumeren');
const name = computed({
    get: () => patchedTakeoutMethod.value.name,
    set: name => addPatch({ name }),
});
const address = computed({
    get: () => patchedTakeoutMethod.value.address,
    set: address => addPatch({ address }),
});
const description = computed({
    get: () => patchedTakeoutMethod.value.description,
    set: description => addPatch({ description }),
});

function patchTimeSlots(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
    addPatch({ timeSlots: patch });
}

async function save() {
    if (!await errors.validator.validate()) {
        return;
    }
    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addPatch(patchTakeoutMethod.value);
    p.meta = meta;
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze locatie wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p = PrivateWebshop.patch({});
    const meta = WebshopMetaData.patch({});
    meta.checkoutMethods.addDelete(props.takeoutMethod.id);
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
