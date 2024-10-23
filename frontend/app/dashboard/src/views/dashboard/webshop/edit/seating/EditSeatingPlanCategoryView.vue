<template>
    <SaveView :title="isNew ? 'Categorie toevoegen' : 'Categorie bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Zetelcategorie toevoegen
        </h1>
        <h1 v-else>
            Categorie bewerken
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze keuze"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Meer of minkost" error-fields="price" :error-box="errors.errorBox">
            <PriceInput v-model="price" placeholder="+ 0 euro" :min="null" />
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="adminOnly" />
                </template>

                <h3 class="style-title-list">
                    Enkel voor beheerders
                </h3>
                <p class="style-description-small">
                    Enkel een beheerder kan deze plaatsen selecteren bij het toevoegen van een bestelling.
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew && !isSingle" class="container">
            <hr>
            <h2>
                Verwijder deze categorie
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
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
