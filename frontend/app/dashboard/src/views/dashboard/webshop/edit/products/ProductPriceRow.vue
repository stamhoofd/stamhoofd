<template>
    <STListItem v-long-press="(e: MouseEvent) => showContextMenu(e)" :selectable="true" class="right-description right-stack" @click="editPrice()" @contextmenu.prevent="showContextMenu">
        <h3 class="style-title-list">
            {{ productPrice.name || 'Naamloos' }}
        </h3>
        <p v-if="productPrice.hidden" class="style-description-small">
            {{ $t('6276d07c-bd0d-4117-b46c-e3f7b0dbb1e5') }}
        </p>
        <p v-if="productPrice.isSoldOut" class="style-description-small">
            {{ $t('44ba544c-3db6-4f35-b7d1-b63fdcadd9ab') }}
        </p>
        <p v-else-if="productPrice.stock" class="style-description-small">
            {{ $t('dceceb1c-6d55-4a93-bf8f-85ba041786f4', {stock: pluralText(productPrice.remainingStock ?? 0, $t('86e03c52-25db-45f7-a129-5f165b289324'), $t('7d5de81e-9ae9-4ec6-86e1-844ca6a75fb1'))}) }}
        </p>

        <template #right>
            <span><template v-if="productPrice.discountPrice">
                      {{ formatPrice(productPrice.discountPrice) }} /
                  </template>
                {{ formatPrice(productPrice.price) }}</span>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem, STListItem } from '@stamhoofd/components';
import { Product, ProductPrice } from '@stamhoofd/structures';

import EditProductPriceView from './EditProductPriceView.vue';
import { useDeleteProductPrice } from '../hooks/useDeleteProductPrice';

const props = defineProps<{ productPrice: ProductPrice; product: Product }>();
const { deleteProductPrice } = useDeleteProductPrice();

const emits = defineEmits<{ (e: 'patch', patch: AutoEncoderPatchType<Product>): void; (e: 'move-up'): void; (e: 'move-down'): void }>();

const present = usePresent();

function editPrice() {
    present(new ComponentWithProperties(EditProductPriceView, { product: props.product, productPrice: props.productPrice, isNew: false, saveHandler: (patch: AutoEncoderPatchType<Product>) => {
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

async function doDelete() {
    const p = await deleteProductPrice(props.product, props.productPrice);
    if (!p) {
        return;
    }
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
