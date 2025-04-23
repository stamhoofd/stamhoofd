<template>
    <SaveView :title="isNew ? $t(`Tijdvak toevoegen`) : $t(`Tijdvak bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('4fab2bfd-3731-4574-9165-584165f00352') }}
        </h1>
        <h1 v-else>
            {{ $t('beb8d8e8-9ea2-4976-82b8-ca7956cc57cc') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="date" :error-box="errors.errorBox" :title="$t(`40aabd99-0331-4267-9b6a-a87c06b3f7fe`)">
            <DateSelection v-model="date" />
        </STInputBox>

        <TimeMinutesInput v-model="startTime" :validator="errors.validator" :title="$t(`01b5d104-748c-4801-a369-4eab05809fcf`)" />
        <TimeMinutesInput v-model="endTime" :validator="errors.validator" :title="$t(`91310731-bddd-4ad3-b5fb-182237699f20`)" />

        <STInputBox error-fields="maxOrders" :error-box="errors.errorBox" :title="$t(`fcb7332b-ae0e-4262-9220-bd38e44a42a9`)">
            <NumberInput v-model="maxOrders" :required="false" :placeholder="$t(`3433bd78-f07f-4661-ba9e-28b76c468d58`)" />
        </STInputBox>
        <p v-if="remainingOrders !== null && remainingOrders !== maxOrders" class="style-description">
            {{ $t('40758899-6ad8-46ea-a196-4b03ccd80751', {orders: remainingOrders === 0 ? '0' : remainingOrders?.toString() ?? ''}) }}
        </p>

        <STInputBox error-fields="maxPersons" :error-box="errors.errorBox" :title="$t(`7b1a3b35-1f6b-4cb7-8675-35302454a3b9`)">
            <NumberInput v-model="maxPersons" :required="false" :placeholder="$t(`3433bd78-f07f-4661-ba9e-28b76c468d58`)" />
        </STInputBox>
        <p v-if="remainingPersons !== null && remainingPersons !== maxPersons" class="style-description">
            {{ $t('101cfdc7-4cb2-4c71-a25f-9b5af9933624', {persons: remainingPersons === 0 ? '0' : remainingPersons?.toString() ?? ''}) }}
        </p>

        <div v-if="!isNew" class="container">
            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
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
