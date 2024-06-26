<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        <p>Je kan een leeftijdsgroep meerdere namen geven. Het is niet nodig om dus zelf een opsomming te voorzien, dat gebeurt automatisch.</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-for="n in names.length" :key="n" :title="'Naam '+n">
            <input
                class="input"
                type="text"
                autocomplete=""
                :value="getName(n - 1)" :placeholder="'Synoniem '+n" @input="setName(n - 1, ($event as any).target.value)" 
            >

            <template #right>
                <button v-if="names.length > 1" class="button icon trash gray" type="button" @click="deleteName(n - 1)" />
            </template>
        </STInputBox>

        <button class="button text" type="button" @click="addName">
            <span class="icon add" />
            <span>Synoniem</span>
        </button>

        <STInputBox title="Beschrijving" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Korte tip voor hoe deze standaard leeftijdsgroep gebruikt kan worden"
                autocomplete=""
            />
        </STInputBox>
        <p class="style-description-small">Enkel zichtbaar voor leiding of beheerders</p>

        <hr>
        <h2>Leeftijd</h2>
        <p>Dit is een standaardinstelling. Een lokale groep kan deze instellingen nog aanpassen. Deze instelling dient dus vooral als standaardinstelling en om te communiceren richting groepen.</p>

        <div class="split-inputs">
            <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="settings.minAge" :error-box="errors.errorBox">
                <AgeInput v-model="minAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
            </STInputBox>

            <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="settings.maxAge" :error-box="errors.errorBox">
                <AgeInput v-model="maxAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
            </STInputBox>
        </div>
        <p class="st-list-description">
            *Hoe oud het lid wordt in het kalenderjaar van de start van een werkjaar (dus leeftijd op 31/12/{{ startYear }}). Ter referentie: leden uit het eerste leerjaar zijn 6 jaar op 31 december. Leden uit het eerste secundair zijn 12 jaar op 31 december.
        </p>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                Verwijder deze standaard leeftijdsgroep
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SaveView, useErrors, usePatch, AgeInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { DefaultAgeGroup } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    group: DefaultAgeGroup;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<DefaultAgeGroup>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => props.isNew ? 'Nieuwe standaard leeftijdsgroep' : 'Standaard leeftijdsgroep bewerken');
const pop = usePop();
const $t = useTranslate();

const {patched, addPatch, hasChanges, patch} = usePatch(props.group);
let startYear = new Date().getFullYear();
const month = new Date().getMonth();

if (month < 7) {
    startYear--;
}

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (names.value.length === 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Gelieve een naam in te vullen",
                field: "name"
            })
        }

        if (names.value[0].length === 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Gelieve een naam in te vullen",
                field: "name"
            })
        }
        await props.saveHandler(patch.value)
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm("Ben je zeker dat je deze standaard leeftijdsgroep wilt verwijderen?", "Verwijderen", 'Je kan dit niet ongedaan maken. Er gaat mogelijks informatie verloren over alle gekoppelde inschrijvingsgroepen.')) {
        return
    }
        
    deleting.value = true;
    try {
        await props.deleteHandler()
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    deleting.value = false;
};

const names = computed({
    get: () => patched.value.names,
    set: (names) => addPatch({names: names as any}),
});

const description = computed({
    get: () => patched.value.description,
    set: (description) => addPatch({description}),
});

const minAge = computed({
    get: () => patched.value.minAge,
    set: (minAge) => addPatch({minAge}),
});

const maxAge = computed({
    get: () => patched.value.maxAge,
    set: (maxAge) => addPatch({maxAge}),
});

function getName(index: number) {
    return names.value[index] ?? "";
}

function setName(index: number, value: string) {
    const newNames = [...names.value];
    newNames[index] = value;
    names.value = newNames;
}

function deleteName(index: number) {
    const newNames = [...names.value];
    newNames.splice(index, 1);
    names.value = newNames;
}

function addName() {
    names.value = [...names.value, ""];
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})
</script>