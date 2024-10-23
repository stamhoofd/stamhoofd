<template>
    <STList v-model="draggableOptions" :draggable="true">
        <template #item="{item: option}">
            <OptionRow :option-menu="optionMenu" :option="option" @patch="addPatch" @move-up="moveOptionUp(option)" @move-down="moveOptionDown(option)" />
        </template>
    </STList>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { STList, useDraggableArray } from '@stamhoofd/components';
import { Option, OptionMenu } from '@stamhoofd/structures';

import OptionRow from './OptionRow.vue';

const props = defineProps<{
    optionMenu: OptionMenu;
}>();

const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<OptionMenu>): void }>();

function moveOptionUp(option: Option) {
    const index = props.optionMenu.options.findIndex(c => option.id === c.id);
    if (index === -1 || index === 0) {
        return;
    }

    const moveTo = index - 2;
    const p = OptionMenu.patch({});
    p.options.addMove(option.id, props.optionMenu.options[moveTo]?.id ?? null);
    addPatch(p);
}

function moveOptionDown(option: Option) {
    const index = props.optionMenu.options.findIndex(c => option.id === c.id);
    if (index === -1 || index >= props.optionMenu.options.length - 1) {
        return;
    }

    const moveTo = index + 1;
    const p = OptionMenu.patch({});
    p.options.addMove(option.id, props.optionMenu.options[moveTo].id);
    addPatch(p);
}

function addPatch(patch: AutoEncoderPatchType<OptionMenu>) {
    emits('patch', patch);
}

const draggableOptions = useDraggableArray(() => props.optionMenu.options, (patch) => {
    const optionMenuPatch = OptionMenu.patch({
        options: patch,
    });

    addPatch(optionMenuPatch);
});
</script>
