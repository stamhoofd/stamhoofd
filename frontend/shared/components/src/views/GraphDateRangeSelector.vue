<template>
    <button class="button text" type="button" @click="chooseRange">
        <span>{{ model ? model.name : '—' }}</span>
        <span class="icon arrow-down-small" />
    </button>
</template>

<script lang="ts" setup>

import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { DateOption } from './DateRange';

const props = withDefaults(defineProps<{
    options?: DateOption[] | null;
}>(), {
    options: null,
});

const model = defineModel<DateOption | null>({ default: null });

function chooseRange(event: MouseEvent) {
    if (!props.options) {
        return;
    }
    const contextMenu = new ContextMenu([
        [
            ...props.options.map((option) => {
                return new ContextMenuItem({
                    name: option.name,
                    action: () => {
                        model.value = option;
                        return true;
                    },
                });
            }),
        ],
    ]);
    contextMenu.show({ button: event.currentTarget as HTMLElement, xPlacement: 'left' }).catch(console.error);
}
</script>
