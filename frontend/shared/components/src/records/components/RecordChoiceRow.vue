<template>
    <STListItem v-long-press="(e: any) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editChoice()" @contextmenu.prevent="showContextMenu">
        <h3 class="style-title-list">
            {{ choice.name }}
        </h3>
        <p v-if="choice.description" class="style-description-small">
            {{ choice.description }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import STListItem from '#layout/STListItem.vue';
import type { RecordChoice, RecordSettings } from '@stamhoofd/structures';
import { computed } from 'vue';



const props = defineProps<{
    choice: RecordChoice;
    parentRecord: RecordSettings;
}>();
const emit = defineEmits<{
    patch: [patch: PatchableArrayAutoEncoder<RecordChoice>];
}>();
const present = usePresent();
const choices = computed(() => props.parentRecord.choices);

async function editChoice() {
    await present(AsyncComponent(() => import('../EditRecordChoiceView.vue'), {
        choice: props.choice,
        parentRecord: props.parentRecord,
        isNew: false,
        saveHandler: addPatch,
    }).setDisplayStyle('popup'));
}

function addPatch(patch: PatchableArrayAutoEncoder<RecordChoice>) {
    emit('patch', patch);
}

function moveUp() {
    const index = choices.value.findIndex(c => c.id === props.choice.id);
    if (index === -1 || index === 0) {
        return;
    }

    const moveTo = index - 2;
    const patch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray();
    patch.addMove(props.choice.id, choices.value[moveTo]?.id ?? null);
    addPatch(patch);
}

function moveDown() {
    const index = choices.value.findIndex(c => c.id === props.choice.id);
    if (index === -1 || index >= choices.value.length - 1) {
        return;
    }

    const moveTo = index + 1;
    const patch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray();
    patch.addMove(props.choice.id, choices.value[moveTo]?.id ?? null);
    addPatch(patch);
}

function showContextMenu(event: TouchEvent | MouseEvent) {
    const menu = new ContextMenu([[
        new ContextMenuItem({
            name: $t(`%11f`),
            icon: 'arrow-up',
            action: () => {
                moveUp();
                return true;
            },
        }),
        new ContextMenuItem({
            name: $t(`%11g`),
            icon: 'arrow-down',
            action: () => {
                moveDown();
                return true;
            },
        }),
    ]]);
    menu.show({ clickEvent: event }).catch(console.error);
}
</script>
