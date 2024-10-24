<template>
    <STListItem v-long-press="(e: MouseEvent) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editProduct()" @contextmenu.prevent="showContextMenu">
        <template #left>
            <img v-if="imageSrc" :src="imageSrc" :width="imageResolution.width" :height="imageResolution.height" class="product-row-image">
        </template>

        <h2 class="style-title-list">
            {{ product.name }}
        </h2>
        <p v-if="product.isEnabledTextLong" class="style-description">
            {{ product.isEnabledTextLong }}
        </p>
        <p v-if="product.stockText" class="style-description">
            {{ product.stockText }}
        </p>
        <p>
            <span class="style-tag">
                {{ formatPrice(price) }}
            </span>
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
import { Category, PrivateWebshop, Product } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { computed } from 'vue';
import EditProductView from './EditProductView.vue';

const props = withDefaults(defineProps<{
    product: Product;
    category?: Category | null;
    webshop: PrivateWebshop;
}>(), {
    category: null,
});

const present = usePresent();
const imageSrc = computed(() => imageResolution.value?.file?.getPublicPath());
const imageResolution = computed(() => props.product.images[0]?.getResolutionForSize(80, 80));

const emits = defineEmits<{
    (e: 'patch', patch: AutoEncoderPatchType<PrivateWebshop>): void;
    (e: 'move-up'): void;
    (e: 'move-down'): void;
}>();

function editProduct() {
    present(new ComponentWithProperties(EditProductView, { product: props.product, webshop: props.webshop, isNew: false, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
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

function duplicate() {
    const duplicatedProduct = props.product.clone();
    duplicatedProduct.clearStock();
    duplicatedProduct.id = uuidv4();

    // while name is in use
    // Remove and get number at end of duplicated product, default to 1
    let counter = 0;
    while (props.webshop.products.find(p => p.name === duplicatedProduct.name) && counter < 100) {
        const endNumber = parseInt(duplicatedProduct.name.match(/\d+$/)?.[0] ?? '1');
        duplicatedProduct.name = duplicatedProduct.name.replace(/\d+$/, '') + (endNumber + 1);
        counter++;
    }

    const webshopPatch = PrivateWebshop.patch({
        id: props.webshop.id,
    });
    webshopPatch.products.addPut(duplicatedProduct, props.product.id);

    if (props.category) {
        const categoryPatch = Category.patch({
            id: props.category.id,
        });
        categoryPatch.productIds.addPut(duplicatedProduct.id, props.product.id);
        webshopPatch.categories.addPatch(categoryPatch);
    }
    emits('patch', webshopPatch);
}

async function doDelete() {
    if (!(await CenteredMessage.confirm('Dit artikel verwijderen?', 'Verwijderen'))) {
        return;
    }
    const webshopPatch = PrivateWebshop.patch({
        id: props.webshop.id,
    });
    webshopPatch.products.addDelete(props.product.id);

    if (props.category) {
        const categoryPatch = Category.patch({
            id: props.category.id,
        });
        categoryPatch.productIds.addDelete(props.product.id);
        webshopPatch.categories.addPatch(categoryPatch);
    }
    emits('patch', webshopPatch);
}

const price = computed(() => props.product.prices[0].price);

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
                name: 'Dupliceren',
                icon: 'copy',
                action: () => {
                    duplicate();
                    return true;
                },
            }),
            ...(props.category && props.webshop.categories.length >= 2
                ? [
                        new ContextMenuItem({
                            name: 'Verplaatsen naar',
                            childMenu: new ContextMenu([
                                props.webshop.categories.flatMap((c) => {
                                    if (!props.category || c.id === props.category.id) {
                                        return [];
                                    }
                                    return [new ContextMenuItem({
                                        name: c.name,
                                        action: () => {
                                            const categoryPatch = Category.patch({
                                                id: c.id,
                                            });
                                            categoryPatch.productIds.addPut(props.product.id);

                                            const categoryPatch2 = Category.patch({
                                                id: props.category!.id,
                                            });
                                            categoryPatch2.productIds.addDelete(props.product.id);

                                            const webshopPatch = PrivateWebshop.patch({
                                                id: props.webshop.id,
                                            });
                                            webshopPatch.categories.addPatch(categoryPatch);
                                            webshopPatch.categories.addPatch(categoryPatch2);
                                            emits('patch', webshopPatch);
                                            return true;
                                        },
                                    })];
                                }),
                            ]),
                        }),
                    ]
                : []),
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.product-row-image {
    max-width: 80px;
    height: auto;
    margin: -5px 0;
    border-radius: $border-radius;

    @media (max-width: 550px) {
        max-width: 50px;
    }
}
</style>
