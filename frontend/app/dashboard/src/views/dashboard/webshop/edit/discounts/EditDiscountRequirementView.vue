<template>
    <SaveView :title="isNew ? $t(`%u4`) : $t(`%S8`)" :disabled="!hasChanges && !isNew" class="product-edit-view" @save="save">
        <h1 v-if="isNew">
            {{ $t('%u4') }}
        </h1>
        <h1 v-else>
            {{ $t('%S8') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <ProductsSelectorBox :product-selector="productSelector" :webshop="webshop" :validator="errors.validator" @patch="patchProductSelector" />

        <STInputBox error-fields="amount" :error-box="errors.errorBox" class="max" :title="$t(`%M4`)">
            <DeprecatedNumberInput v-model="amount" :min="1" :stepper="true" />
        </STInputBox>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%S9') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import DeprecatedNumberInput from '@stamhoofd/components/inputs/DeprecatedNumberInput.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { PrivateWebshop, ProductsSelector } from '@stamhoofd/structures';
import { DiscountRequirement } from '@stamhoofd/structures';

import { computed } from 'vue';
import ProductsSelectorBox from './ProductsSelectorBox.vue';

const props = defineProps<{
    discountRequirement: DiscountRequirement;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountRequirement>) => void;
}>();
const errors = useErrors();
const pop = usePop();

const { patch: patchDiscountRequirement, patched: patchedDiscountRequirement, addPatch, hasChanges } = usePatch(props.discountRequirement);

const productSelector = computed(() => patchedDiscountRequirement.value.product);

function patchProductSelector(patch: AutoEncoderPatchType<ProductsSelector>) {
    addPatch(DiscountRequirement.patch({
        product: patch,
    }));
}

const amount = computed({
    get: () => patchedDiscountRequirement.value.amount,
    set: (amount: number) => {
        addPatch(DiscountRequirement.patch({
            amount,
        }));
    },
});

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }
    const p: PatchableArrayAutoEncoder<DiscountRequirement> = new PatchableArray();
    p.addPatch(patchDiscountRequirement.value);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze voorwaarde wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p: PatchableArrayAutoEncoder<DiscountRequirement> = new PatchableArray();
    p.addDelete(props.discountRequirement.id);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script>
