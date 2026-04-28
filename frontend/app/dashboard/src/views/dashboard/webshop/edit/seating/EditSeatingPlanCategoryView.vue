<template>
    <SaveView :title="isNew ? $t(`%Rh`) : $t(`%17j`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('%UP') }}
        </h1>
        <h1 v-else>
            {{ $t('%17j') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%1Os`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%Sk`)">
        </STInputBox>

        <PriceInputBox v-model="price" error-fields="price" :error-box="errors.errorBox" :title="$t(`%TQ`)" :min="null" :placeholder="$t(`%2f`)" :validator="errors.validator" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="adminOnly" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%UQ') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%UR') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew && !isSingle" class="container">
            <hr><h2>
                {{ $t('%LS') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import PriceInputBox from '@stamhoofd/components/inputs/PriceInputBox.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { SeatingPlan, SeatingPlanCategory } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    seatingPlan: SeatingPlan;
    isNew: boolean;
    category: SeatingPlanCategory;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: ((patch: AutoEncoderPatchType<SeatingPlan>) => void);

}>();

const pop = usePop();
const errors = useErrors();

const { patch: patchSeatingPlan, patched: patchedSeatingPlan, addPatch, hasChanges } = usePatch(props.seatingPlan);

const patchedCategory = computed(() => {
    const c = patchedSeatingPlan.value.categories.find(c => c.id === props.category.id);
    if (c) {
        return c;
    }
    return props.category;
});

const name = computed({
    get: () => patchedCategory.value.name,
    set: (name: string) => {
        addCategoryPatch(SeatingPlanCategory.patch({ name }));
    },
});

const price = computed({
    get: () => patchedCategory.value.price,
    set: (price: number) => {
        addCategoryPatch(SeatingPlanCategory.patch({ price }));
    },
});

const adminOnly = computed({
    get: () => patchedCategory.value.adminOnly,
    set: (adminOnly: boolean) => {
        addCategoryPatch(SeatingPlanCategory.patch({ adminOnly }));
    },
});

function addCategoryPatch(patch: AutoEncoderPatchType<SeatingPlanCategory>) {
    const p = SeatingPlan.patch({ id: props.seatingPlan.id });
    p.categories.addPatch(patch.patch({ id: props.category.id }));
    addPatch(p);
}

async function save() {
    if (!await errors.validator.validate()) {
        return;
    }
    props.saveHandler(patchSeatingPlan.value);
    pop({ force: true })?.catch(console.error);
}

const isSingle = computed(() => patchedSeatingPlan.value.categories.length <= 1);

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze categorie wilt verwijderen?', 'Verwijderen')) {
        return;
    }
    const p = SeatingPlan.patch({});
    p.categories.addDelete(props.category.id);
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
