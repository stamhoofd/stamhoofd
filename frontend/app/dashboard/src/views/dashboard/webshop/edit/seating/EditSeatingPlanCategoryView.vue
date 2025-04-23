<template>
    <SaveView :title="isNew ? $t(`2e3852ef-423e-4fcc-82bb-c886a6c61050`) : $t(`Categorie bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('c853c26c-5f80-4605-be1d-117d38c5755c') }}
        </h1>
        <h1 v-else>
            {{ $t('d53ea60f-6a11-4400-ba0d-0a7315214386') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`1539d481-12bf-4814-9fe3-3770eaecdda8`)">
        </STInputBox>

        <STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t(`295faf23-65af-4820-80de-fa6abfe751e3`)">
            <PriceInput v-model="price" :min="null" :placeholder="$t(`ef6ac7e5-de7e-4e2e-802f-de730294f05d`)" />
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="adminOnly" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('a713c111-2c65-4160-b15c-d28fbc1ea8b3') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('03862d9a-0eb7-4ce1-a76f-94a837c4df73') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew && !isSingle" class="container">
            <hr><h2>
                {{ $t('e3ea7df6-8ebd-4bf9-a25e-6be3bfc29e57') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
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
