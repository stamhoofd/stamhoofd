<template>
    <SaveView :title="locationTitleName" :disabled="!hasChanges" @save="save">
        <h1 v-if="isNew">
            {{ locationTitleName }} {{ $t('toevoegen') }}
        </h1>
        <h1 v-else>
            {{ locationTitleName }} {{ $t('bewerken') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`Locatienaam`)">
                    <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`bv. kantine`)">
                </STInputBox>

                <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`Beschrijving`)">
                    <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`Hier kan je eventeel afhaalinstructies kwijt (optioneel)`)" />
                </STInputBox>
            </div>
            <div>
                <AddressInput v-model="address" :validator="errors.validator" :required="true" :title="$t(`Adres`)" />
            </div>
        </div>

        <EditTimeSlotsSection v-if="isTakeout" :webshop="webshop" :time-slots="patchedTakeoutMethod.timeSlots" :title="$t(`Datum en tijd + keuze uit afhaalintervallen`)" @patch="patchTimeSlots">
            <p>{{ $t('Je kan tijdsintervallen toevoegen waartussen men de bestelling kan afhalen. Als je er geen toevoegt, dan moet er geen keuze gemaakt worden (bv. als je het elke week kan afhalen na activiteiten). Als je afhalen organiseert op één tijdstip, dan raden we je aan om hier één tijdstip toe te voegen (dan moet er nog steeds geen keuze gemaakt worden, maar dan kunnen we dit tijdstip duidelijk communiceren in de bestelbevestiging).') }}</p>
        </EditTimeSlotsSection>
        <EditTimeSlotsSection v-else :webshop="webshop" :time-slots="patchedTakeoutMethod.timeSlots" :title="$t(`Datum en tijd + keuze uit shiften`)" @patch="patchTimeSlots">
            <p>{{ $t('Je kan tijdsintervallen toevoegen waartussen men de bestelling ter plaatse kan consumeren. Als je er geen toevoegt, dan moet er geen keuze gemaakt worden (afgeraden). Als je jouw evenement organiseert op één tijdstip, dan raden we je aan om hier één tijdstip toe te voegen (dan moet er nog steeds geen keuze gemaakt worden, maar dan kunnen we dit tijdstip duidelijk communiceren in de bestelbevestiging).') }}</p>
        </EditTimeSlotsSection>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('Verwijderen') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('Verwijderen') }}</span>
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
