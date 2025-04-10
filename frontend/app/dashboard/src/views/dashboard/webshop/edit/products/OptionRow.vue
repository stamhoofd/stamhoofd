<template>
    <STListItem v-long-press="(e: MouseEvent) => showContextMenu(e)" :selectable="true" class="right-description right-stack" @click="editOption()" @contextmenu.prevent="showContextMenu">
        <template #left>
            <Radio v-if="!optionMenu.multipleChoice" v-model="isFirst" :value="true" :disabled="true" />
            <Checkbox v-else :disabled="true" />
        </template>

        <h3 class="style-title-list">
            {{ option.name || 'Naamloos' }}
        </h3>
        <p v-if="option.isSoldOut" class="style-description-small">
            {{ $t('Uitverkocht') }}
        </p>
        <p v-else-if="option.stock" class="style-description-small">
            {{ $t('Nog {stock} beschikbaar', {stock: pluralText(option.remainingStock ?? 0, $t('stuk'), $t('stuks'))}) }}
        </p>

        <template #right>
            <span>{{ formatPriceChange(option.price) }}</span>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, ContextMenu, ContextMenuItem, Radio, STListItem } from '@stamhoofd/components';
import { Option, OptionMenu } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditOptionView from './EditOptionView.vue';

const props = defineProps<{
    optionMenu: OptionMenu;
    option: Option;
}>();

const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<OptionMenu>): void; (e: 'move-up'): void; (e: 'move-down'): void }>();
const present = usePresent();

const isFirst = computed(() => props.optionMenu.options[0].id === props.option.id);

function editOption() {
    present(new ComponentWithProperties(EditOptionView, { option: props.option, optionMenu: props.optionMenu, isNew: false, saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
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

async function doDelete() {
    if (!(await CenteredMessage.confirm('Deze keuze verwijderen?', 'Verwijderen'))) {
        return;
    }
    const p = OptionMenu.patch({ id: props.optionMenu.id });
    p.options.addDelete(props.option.id);
    emits('patch', p);
}

function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Verplaats omhoog',
                icon: 'arrow-up',
                action: () => {
                    moveUp();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Verplaats omlaag',
                icon: 'arrow-down',
                action: () => {
                    moveDown();
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: 'Verwijderen',
                icon: 'trash',
                disabled: props.optionMenu.options.length <= 1,
                action: () => {
                    doDelete().catch(console.error);
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}
</script>
