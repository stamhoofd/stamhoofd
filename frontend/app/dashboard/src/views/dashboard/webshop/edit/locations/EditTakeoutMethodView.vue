<template>
    <SaveView :title="locationTitleName" :disabled="!hasChanges" @save="save">
        <h1 v-if="isNew">
            {{ locationTitleName }} {{ $t('%14c') }}
        </h1>
        <h1 v-else>
            {{ locationTitleName }} {{ $t('%Rw') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%T2`)">
                    <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%T3`)">
                </STInputBox>

                <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`%6o`)">
                    <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`%T4`)" />
                </STInputBox>
            </div>
            <div>
                <AddressInput v-model="address" :validator="errors.validator" :required="true" :title="$t(`%Cn`)" />
            </div>
        </div>

        <EditTimeSlotsSection v-if="isTakeout" :webshop="webshop" :time-slots="patchedTakeoutMethod.timeSlots" :title="$t(`%T5`)" @patch="patchTimeSlots">
            <p>{{ $t('%T0') }}</p>
        </EditTimeSlotsSection>
        <EditTimeSlotsSection v-else :webshop="webshop" :time-slots="patchedTakeoutMethod.timeSlots" :title="$t(`%T6`)" @patch="patchTimeSlots">
            <p>{{ $t('%T1') }}</p>
        </EditTimeSlotsSection>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%CJ') }}
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
import AddressInput from '@stamhoofd/components/inputs/AddressInput.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
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
