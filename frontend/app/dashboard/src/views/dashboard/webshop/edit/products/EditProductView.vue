<template>
    <SaveView :title="title" :disabled="!hasChanges" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <template #buttons>
            <button v-tooltip="$t('%jH')" class="button icon eye" type="button" data-testid="product-preview-button" @click="showExample" />
        </template>
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <EditProductBox :product="patchedProduct" :webshop="patchedWebshop" :is-new="isNew" :error-box="errors.errorBox" :validator="errors.validator" @patch:product="addProductPatch" @patch:webshop="addWebshopPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@common/encoding';
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { Product } from '@stamhoofd/structures';
import { CartItem, Checkout, PrivateWebshop } from '@stamhoofd/structures';
import { computed } from 'vue';
import EditProductBox from './EditProductBox.vue';
import { getProductTypeName } from './productTypeName';

const props = defineProps<{
    product: Product;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;
}>();

const errors = useErrors();
const present = usePresent();
const pop = usePop();

// The webshop is only patched for its seating plans
const { patch: patchWebshop, patched: patchedWebshop, addPatch: addWebshopPatch, hasChanges: hasWebshopChanges } = usePatch(props.webshop);
const { patch: patchProduct, patched: patchedProduct, addPatch: addProductPatch, hasChanges: hasProductChanges } = usePatch(props.product);

const title = computed(() => {
    const typeName = getProductTypeName(props.product.type);
    if (props.isNew) {
        return typeName + ' ' + $t('%14c');
    }
    return (patchedProduct.value.name || typeName) + ' ' + $t('%Rw');
});

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }
    const p = PrivateWebshop.patch(patchWebshop.value);
    p.products.addPatch(patchProduct.value);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

// Opens the product as a buyer would see it, with the unsaved changes applied
function showExample() {
    const checkout = Checkout.create({});
    const webshop = patchedWebshop.value;
    const cartItem = CartItem.createDefault(patchedProduct.value, checkout.cart, webshop, { admin: false });

    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('@stamhoofd/components/views/CartItemView.vue'), {
                    admin: false,
                    isPreview: true,
                    cartItem,
                    webshop,
                    checkout,
                    saveHandler: (_cartItem: CartItem, _oldItem: CartItem | null, component: { dismiss: (options?: { force?: boolean }) => Promise<unknown> | undefined }) => {
                        component.dismiss({ force: true })?.catch(console.error);
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm({
        title: patchedProduct.value.name ? $t('%Zn2', { name: patchedProduct.value.name }) : $t('Dit artikel verwijderen?'),
        confirmText: $t('%CJ'),
        description: $t('%Zm6'),
        availabilityDelay: 2_000,
    })) {
        return;
    }

    const p = PrivateWebshop.patch({});
    p.products.addDelete(props.product.id);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

const hasChanges = computed(() => hasWebshopChanges.value || hasProductChanges.value);

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
}

defineExpose({ shouldNavigateAway });
</script>
