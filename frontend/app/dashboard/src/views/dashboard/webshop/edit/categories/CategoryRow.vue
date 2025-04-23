<template>
    <STListItem v-long-press="(e: TouchEvent | MouseEvent) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editCategory()" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ category.name || 'Naamloos' }}
        </h2>

        <p v-if="!category.productIds.length" class="style-description">
            {{ $t('Leeg') }}
        </p>
        <p v-else-if="category.productIds.length === 1" class="style-description">
            {{ $t('Eén artikel') }}
        </p>
        <p v-else class="style-description">
            {{ category.productIds.length }} {{ $t('artikels') }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, STListItem } from '@stamhoofd/components';
import { Category, PrivateWebshop } from '@stamhoofd/structures';

import EditCategoryView from './EditCategoryView.vue';

const props = defineProps<{ category: Category; webshop: PrivateWebshop }>();
const present = usePresent();
const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<PrivateWebshop>): void; (e: 'move-up'): void; (e: 'move-down'): void; (e: 'delete'): void }>();

function editCategory() {
    present(new ComponentWithProperties(EditCategoryView, {
        category: props.category,
        webshop: props.webshop,
        isNew: false,
        saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // This same patch could also patch products ;)
            emits('patch', patch);

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        } }).setDisplayStyle('popup')).catch(console.error);
}

function moveUp() {
    emits('move-up');
}

function moveDown() {
    emits('move-down');
}

async function onDelete(keepArticles = false) {
    if (!(await CenteredMessage.confirm(keepArticles ? 'Deze categorie verwijderen en alle artikels erin behouden?' : 'Deze categorie en artikels verwijderen?', 'Verwijderen'))) {
        return;
    }
    const p = PrivateWebshop.patch({ id: props.webshop.id });
    p.categories.addDelete(props.category.id);

    if (!keepArticles) {
        for (const id of props.category.productIds) {
            p.products.addDelete(id);
        }
    }

    emits('patch', p);
}

function showContextMenu(event: TouchEvent | MouseEvent | undefined) {
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
            ...(props.webshop.categories.length === 1
                ? [
                        new ContextMenuItem({
                            name: 'Verwijder en behoud artikels',
                            action: () => {
                                onDelete(true).catch(console.error);
                                return true;
                            },
                        }),
                    ]
                : []),
            new ContextMenuItem({
                name: 'Verwijderen',
                icon: 'trash',
                action: () => {
                    onDelete(false).catch(console.error);
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}
</script>
