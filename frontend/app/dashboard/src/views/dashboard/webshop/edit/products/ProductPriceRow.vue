<template>
    <STListItem v-long-press="(e: MouseEvent) => showContextMenu(e)" :selectable="true" class="right-description right-stack" @click="editPrice()" @contextmenu.prevent="showContextMenu">
        <h3 class="style-title-list">
            {{ productPrice.name || 'Naamloos' }}
        </h3>
        <p v-if="productPrice.hidden" class="style-description-small">
            {{ $t('4fe2a3a7-c314-4566-a47a-4221c79f790d') }}
        </p>
        <p v-if="productPrice.isSoldOut" class="style-description-small">
            {{ $t('4c249834-df40-4c1f-9c79-c56864100c36') }}
        </p>
        <p v-else-if="productPrice.stock" class="style-description-small">
            {{ $t('6878be1d-f7ca-4c4c-b6fa-de59c8028cd7') }} {{ pluralText(productPrice.remainingStock ?? 0, 'stuk', 'stuks') }} {{ $t('79828b21-b66f-4e18-bb1e-bb46ee12a8af') }}
        </p>

        <template #right>
            <span><template v-if="productPrice.discountPrice">
                      {{ formatPrice(productPrice.discountPrice) }} /
                  </template>
                {{ formatPrice(productPrice.price) }}</span>
            <span class="button icon drag gray" @click.stop @contextmenu.stop/>
            <span class="icon arrow-right-small gray"/>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, STListItem } from '@stamhoofd/components';
import { Product, ProductPrice } from '@stamhoofd/structures';

import EditProductPriceView from './EditProductPriceView.vue';

const props = defineProps<{ productPrice: ProductPrice; product: Product }>();

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
    if (!(await CenteredMessage.confirm('Deze prijs verwijderen?', 'Verwijderen'))) {
        return;
    }
    const p = Product.patch({ id: props.product.id });
    p.prices.addDelete(props.productPrice.id);
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
