<template>
    <STListItem :selectable="true" class="right-stack" @click="editField()">
        <h2 class="style-title-list">
            {{ field.name || 'Naamloos' }}
        </h2>

        <template #right>
            <button type="button" class="button icon arrow-up gray" @click.stop="moveUp" />
            <button type="button" class="button icon arrow-down gray" @click.stop="moveDown" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { STListItem } from '@stamhoofd/components';
import { WebshopField } from '@stamhoofd/structures';

import EditWebshopFieldView from './EditWebshopFieldView.vue';

const props = defineProps<{
    field: WebshopField;
}>();

const present = usePresent();
const emits = defineEmits<{
    (e: 'patch', patch: PatchableArrayAutoEncoder<WebshopField>): void;
    (e: 'move-up'): void;
    (e: 'move-down'): void;
}>();

function editField() {
    present(new ComponentWithProperties(EditWebshopFieldView, { field: props.field, isNew: false, saveHandler: (patch: PatchableArrayAutoEncoder<WebshopField>) => {
        emits('patch', patch);

        // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
    } }).setDisplayStyle('sheet')).catch(console.error);
}

function moveUp() {
    emits('move-up');
}

function moveDown() {
    emits('move-down');
}
</script>
