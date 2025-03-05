<template>
    <SaveView :title="isNew ? $t(`127967a5-502a-4e42-be8b-562cd96953d8`) : $t(`Categorie bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('de34c588-39ff-4d2f-94c4-dd0594219ba3') }}
        </h1>
        <h1 v-else>
            {{ $t('949deda3-2ee8-46e8-8791-e594b30fe50b') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`a9d8f27c-b4d3-415a-94a4-2ec3c018ee48`)"></STInputBox>

        <STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t(`aeb33249-07e1-420d-908b-17cb4ddb7e05`)">
            <PriceInput v-model="price" :min="null" :placeholder="$t(`adf86174-0aaa-4486-8428-bed8cce8851d`)"/>
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="adminOnly"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('dbcb1ffc-c564-4b17-9b98-a1e8d93769ce') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('96d24174-c406-4d98-8803-15a11628a68f') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew && !isSingle" class="container">
            <hr><h2>
                {{ $t('143eea60-461e-44d9-8536-dd90e3e99413') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, useErrors, usePatch } from '@stamhoofd/components';
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
