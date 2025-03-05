<template>
    <SaveView :title="isNew ? $t(`Tijdvak toevoegen`) : $t(`Tijdvak bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('9709061c-eb1b-42f9-a619-84d5ba389995') }}
        </h1>
        <h1 v-else>
            {{ $t('d0c1fc89-69d7-45b8-84aa-e4f4ff59b58b') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox error-fields="date" :error-box="errors.errorBox" :title="$t(`8220c98a-c396-48a7-9575-7e341df69429`)">
            <DateSelection v-model="date"/>
        </STInputBox>

        <TimeMinutesInput v-model="startTime" :validator="errors.validator" :title="$t(`06a111b2-b9db-41fb-a17a-8ede3012b8e1`)"/>
        <TimeMinutesInput v-model="endTime" :validator="errors.validator" :title="$t(`e1e3f121-d608-4a82-a733-028b819d6231`)"/>

        <STInputBox error-fields="maxOrders" :error-box="errors.errorBox" :title="$t(`a461cb73-2f68-469a-989e-01e90fe51612`)">
            <NumberInput v-model="maxOrders" :required="false" :placeholder="$t(`6af330b5-52c8-471e-ab8a-6527122ef083`)"/>
        </STInputBox>
        <p v-if="remainingOrders !== null && remainingOrders !== maxOrders" class="style-description">
            {{ $t('6878be1d-f7ca-4c4c-b6fa-de59c8028cd7') }} {{ remainingOrders }} {{ $t('62df25e9-0647-4121-96ce-810cea786bdc') }}
        </p>

        <STInputBox error-fields="maxPersons" :error-box="errors.errorBox" :title="$t(`d7b2e3c7-4ecf-4e95-9e24-2ba8dc250b1e`)">
            <NumberInput v-model="maxPersons" :required="false" :placeholder="$t(`6af330b5-52c8-471e-ab8a-6527122ef083`)"/>
        </STInputBox>
        <p v-if="remainingPersons !== null && remainingPersons !== maxPersons" class="style-description">
            {{ $t('6878be1d-f7ca-4c4c-b6fa-de59c8028cd7') }} {{ remainingPersons }} {{ $t('39b29abc-8650-43b4-a3e8-06813e71b28d') }}
        </p>

        <div v-if="!isNew" class="container">
            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, NumberInput, SaveView, STErrorsDefault, STInputBox, TimeMinutesInput, useErrors, usePatch } from '@stamhoofd/components';
import { PrivateWebshop, ProductType, WebshopTimeSlot, WebshopTimeSlots } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    timeSlot: WebshopTimeSlot;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: AutoEncoderPatchType<WebshopTimeSlots>) => void;
}>();

const errors = useErrors();
const pop = usePop();

const { patch: patchTimeSlot, patched: patchedTimeSlot, addPatch, hasChanges } = usePatch(props.timeSlot);

const date = computed({
    get: () => patchedTimeSlot.value.date,
    set: (date: Date) => addPatch({ date }),
});

const startTime = computed({
    get: () => patchedTimeSlot.value.startTime,
    set: (startTime: number) => addPatch({ startTime }),
});

const endTime = computed({
    get: () => patchedTimeSlot.value.endTime,
    set: (endTime: number) => addPatch({ endTime }),
});

const remainingOrders = computed(() => patchTimeSlot.value.remainingOrders);

const maxOrders = computed({
    get: () => patchedTimeSlot.value.maxOrders,
    set: (maxOrders: number | null) => addPatch({ maxOrders }),
});

const remainingPersons = computed(() => patchTimeSlot.value.remainingPersons);

const maxPersons = computed({
    get: () => patchedTimeSlot.value.maxPersons,
    set: (maxPersons: number | null) => addPatch({ maxPersons }),
});

async function save() {
    if (!await errors.validator.validate()) {
        return;
    }

    try {
        if (patchedTimeSlot.value.maxPersons !== null && !props.webshop.products.find(p => p.type === ProductType.Person)) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'maxPersons',
                message: "Je hebt geen enkel artikel in jouw webshop met type 'Personen'. Het maximum aantal voor personen werkt dan niet. Voeg eerst een product toe aan je webshop met type 'Personen'.",
            });
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        return;
    }
    const p = WebshopTimeSlots.patch({});
    p.timeSlots.addPatch(patchTimeSlot.value);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je dit tijdvak wilt verwijderen?', 'Verwijderen')) {
        return;
    }
    const p = WebshopTimeSlots.patch({});
    p.timeSlots.addDelete(props.timeSlot.id);
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
