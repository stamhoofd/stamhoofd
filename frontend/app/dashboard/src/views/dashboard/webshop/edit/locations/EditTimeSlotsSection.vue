<template>
    <div class="container">
        <hr><h2 class="style-with-button">
            <div>
                {{ title }}
            </div>
            <div>
                <button class="button text" type="button" @click="addTimeSlot">
                    <span class="icon add"/>
                    <span>{{ $t('7eb44f10-ac07-4174-adc0-ae3ffb1e4f6e') }}</span>
                </button>
            </div>
        </h2>
        <slot/>

        <p v-if="timeSlots.timeSlots.length === 0" class="info-box">
            {{ $t('dd257be5-2786-40ac-88cc-c0faf569be95') }}
        </p>
        <p v-if="timeSlots.timeSlots.length === 1" class="info-box">
            {{ $t('862426f7-eb7d-47e3-a8f7-3dca3d5f084d') }}
        </p>

        <STList>
            <STListItem v-for="timeSlot in sortedSlots" :key="timeSlot.id" :selectable="true" class="right-stack" @click="editTimeSlot(timeSlot)">
                <h3 class="style-title-list">
                    {{ formatDate(timeSlot.date) }}
                </h3>
                <p class="style-description-small">
                    {{ formatMinutes(timeSlot.startTime) }}
                    - {{ formatMinutes(timeSlot.endTime) }}
                </p>

                <template #right>
                    <span v-if="timeSlot.maxOrders" class="style-tag">{{ timeSlot.usedOrders }} / {{ timeSlot.maxOrders }}</span>
                    <span v-if="timeSlot.maxPersons" class="style-tag">{{ timeSlot.usedPersons }} / {{ timeSlot.maxPersons }}p</span>
                    <span class="icon arrow-right-small gray"/>
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { STList, STListItem } from '@stamhoofd/components';
import { PrivateWebshop, WebshopTimeSlot, WebshopTimeSlots } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditTimeSlotView from './EditTimeSlotView.vue';

const props = defineProps<{
    title: string;
    timeSlots: WebshopTimeSlots;
    webshop: PrivateWebshop;
}>();

const present = usePresent();

const emits = defineEmits<{
    (e: 'patch', patch: AutoEncoderPatchType<WebshopTimeSlots>): void;
}>();

function addPatch(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
    emits('patch', patch);
}

const sortedSlots = computed(() => props.timeSlots.timeSlots.slice().sort(WebshopTimeSlot.sort));

function addTimeSlot() {
    const timeSlot = WebshopTimeSlot.create({
        date: new Date(),
    });
    const p = WebshopTimeSlots.patch({});
    p.timeSlots.addPut(timeSlot);

    present(new ComponentWithProperties(EditTimeSlotView, { timeSlots: props.timeSlots.patch(p), isNew: true, webshop: props.webshop, timeSlot, saveHandler: (patch: AutoEncoderPatchType<WebshopTimeSlots>) => {
        // Merge both patches
        addPatch(p.patch(patch));

        // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
    } }).setDisplayStyle('sheet')).catch(console.error);
}

function editTimeSlot(timeSlot: WebshopTimeSlot) {
    present(new ComponentWithProperties(EditTimeSlotView, { timeSlots: props.timeSlots, isNew: false, webshop: props.webshop, timeSlot, saveHandler: (patch: AutoEncoderPatchType<WebshopTimeSlots>) => {
        addPatch(patch);

        // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
    } }).setDisplayStyle('sheet')).catch(console.error);
}
</script>
