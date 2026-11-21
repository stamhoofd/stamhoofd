<template>
    <div class="st-view">
        <STNavigationBar v-if="!popup" :title="title" />

        <main>
            <h1 v-if="!popup">
                {{ title }}
            </h1>
            <p v-if="!popup && description" class="style-description">
                {{ description }}
            </p>

            <STList>
                <RadioListItem v-for="item of items" :key="String(item.value)" :model-value="modelValue" :value="item.value" :label="item.name" @update:model-value="select(item.value)">
                    <p v-for="line of item.description ?? []" :key="line" class="style-description-small">
                        {{ line }}
                    </p>
                </RadioListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup generic="T">
import { usePop, usePopup } from '@browser/navigation';
import RadioListItem from './RadioListItem.vue';

/**
 * Single-choice list meant for a positionable sheet or popup. Selecting an item calls onSelect and closes the sheet.
 */
const props = defineProps<{
    title: string;
    /**
     * Shown under the title, so only when the sheet is not presented as a popup.
     */
    description?: string;
    items: { name: string; value: T; description?: string[] }[];
    modelValue: T;
    onSelect: (value: T) => void;
}>();

const popup = usePopup();
const pop = usePop();

async function select(value: T) {
    props.onSelect(value);
    await pop();
}
</script>
