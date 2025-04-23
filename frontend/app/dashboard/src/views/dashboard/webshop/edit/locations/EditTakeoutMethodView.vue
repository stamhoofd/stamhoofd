<template>
    <SaveView :title="locationTitleName" :disabled="!hasChanges" @save="save">
        <h1 v-if="isNew">
            {{ locationTitleName }} {{ $t('06da1310-e17c-475e-bcd3-bb47844c24c1') }}
        </h1>
        <h1 v-else>
            {{ locationTitleName }} {{ $t('ee3bc635-c294-4134-9155-7a74f47dec4f') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`3c6084da-ce6f-4d03-b213-42def4eabbb7`)">
                    <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`3bb5eb55-784a-41ea-8bc1-b487c6421b51`)">
                </STInputBox>

                <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
                    <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`bb9c4b26-8f77-4334-a6bd-6649c2fe7a1c`)" />
                </STInputBox>
            </div>
            <div>
                <AddressInput v-model="address" :validator="errors.validator" :required="true" :title="$t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`)" />
            </div>
        </div>

        <EditTimeSlotsSection v-if="isTakeout" :webshop="webshop" :time-slots="patchedTakeoutMethod.timeSlots" :title="$t(`a30e2714-0bef-4714-8d4b-2c4aa296df1b`)" @patch="patchTimeSlots">
            <p>{{ $t('74d4c806-8c5b-4f12-8629-48d372b5518c') }}</p>
        </EditTimeSlotsSection>
        <EditTimeSlotsSection v-else :webshop="webshop" :time-slots="patchedTakeoutMethod.timeSlots" :title="$t(`ce84698c-f538-462b-8d43-99feff25680f`)" @patch="patchTimeSlots">
            <p>{{ $t('46944c50-6c15-4547-90d4-bba60421b471') }}</p>
        </EditTimeSlotsSection>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}
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
