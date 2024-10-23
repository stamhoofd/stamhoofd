<template>
    <div>
        <STList>
            <WebshopFieldRow v-for="field in fields" :key="field.id" :field="field" @patch="addPatch" @move-up="moveFieldUp(field)" @move-down="moveFieldDown(field)" />
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { STList } from '@stamhoofd/components';
import { WebshopField } from '@stamhoofd/structures';

import WebshopFieldRow from './WebshopFieldRow.vue';

const props = defineProps<{
    fields: WebshopField[];
}>();

const emits = defineEmits<{ (e: 'patch', patch: PatchableArrayAutoEncoder<WebshopField>): void }>();

function moveFieldUp(field: WebshopField) {
    const index = props.fields.findIndex(c => field.id === c.id);
    if (index === -1 || index === 0) {
        return;
    }

    const moveTo = index - 2;
    const p: PatchableArrayAutoEncoder<WebshopField> = new PatchableArray();
    p.addMove(field.id, props.fields[moveTo]?.id ?? null);
    addPatch(p);
}

function moveFieldDown(field: WebshopField) {
    const index = props.fields.findIndex(c => field.id === c.id);
    if (index === -1 || index >= props.fields.length - 1) {
        return;
    }

    const moveTo = index + 1;
    const p: PatchableArrayAutoEncoder<WebshopField> = new PatchableArray();
    p.addMove(field.id, props.fields[moveTo].id);
    addPatch(p);
}

function addPatch(patch: PatchableArrayAutoEncoder<WebshopField>) {
    emits('patch', patch);
}
</script>
