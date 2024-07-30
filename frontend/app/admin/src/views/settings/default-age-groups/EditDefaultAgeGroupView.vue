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

        <STInputBox title="Beschrijving" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Korte tip voor hoe deze standaard leeftijdsgroep gebruikt kan worden"
                autocomplete=""
            />
        </STInputBox>
        <p class="style-description-small">
            Enkel zichtbaar voor leiding of beheerders
        </p>

        <hr>
        <h2>Automatische aansluiting</h2>
        <p>Leden die in deze leeftijdsgroep inschrijven, kan je automatisch laten aansluiten bij de koepel. Op die manier is de verzekering meteen in orde en hoeft de leiding dit niet per lid individueel te doen.</p>

        <STInputBox title="Aansluiting KSA-Nationaal" error-fields="defaultMembershipTypeId" :error-box="errors.errorBox">
            <Dropdown v-model="defaultMembershipTypeId">
                <option :value="null">
                    Geen automatische aansluiting
                </option>
                <option v-for="membershipType of membershipTypes" :key="membershipType.id" :value="membershipType.id">
                    {{ membershipType.name }}
                </option>
            </Dropdown>
        </STInputBox>

        <hr>
        <h2>Leeftijd</h2>
        <p>Dit is een standaardinstelling. Een lokale groep kan deze instellingen nog aanpassen. Deze instelling dient dus vooral als standaardinstelling en om te communiceren richting groepen.</p>

        <div class="split-inputs">
            <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="minAge" :error-box="errors.errorBox">
                <AgeInput v-model="minAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
            </STInputBox>

            <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="maxAge" :error-box="errors.errorBox">
                <AgeInput v-model="maxAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
            </STInputBox>
        </div>
        <p class="st-list-description">
            *Hoe oud het lid wordt in het kalenderjaar van de start van een werkjaar (dus leeftijd op 31/12/{{ startYear }}). Ter referentie: leden uit het eerste leerjaar zijn 6 jaar op 31 december. Leden uit het eerste secundair zijn 12 jaar op 31 december.
        </p>

        <hr>
        <h2>Gegevensverzameling</h2>
        <p>Deze gegevens worden verzameld en gekoppeld aan leden die inschrijven bij deze standaard leeftijdsgroep. Let erop dat deze gegevens gedeeld zijn met andere inschrijvingen. Als dezelfde gegevens dus voor meerdere inschrijvingen verzameld worden, dan worden ze maar één keer gevraagd (anders kunnen leden de gegevens wel nog nakijken als het al even geleden werd ingevuld) en kan je niet per inschrijving andere gegevens invullen. Gebruik ze dus niet voor tijdelijke vragen.</p>

        <InheritedRecordsConfigurationBox :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />

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
import { AgeInput, CenteredMessage, Dropdown, ErrorBox, SaveView, useErrors, usePatch, usePlatform, InheritedRecordsConfigurationBox } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { DefaultAgeGroup, OrganizationRecordsConfiguration, PlatformMembershipTypeBehaviour } from '@stamhoofd/structures';
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
const platform = usePlatform();
const membershipTypes = computed(() => platform.value.config.membershipTypes.filter(t => t.behaviour === PlatformMembershipTypeBehaviour.Period))

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

const defaultMembershipTypeId = computed({
    get: () => patched.value.defaultMembershipTypeId,
    set: (defaultMembershipTypeId) => addPatch({defaultMembershipTypeId}),
});

const recordsConfiguration = computed(() => patched.value.recordsConfiguration);
const patchRecordsConfiguration = (recordsConfiguration: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
    addPatch({
        recordsConfiguration
    })
}

const inheritedRecordsConfiguration = computed(() => {
    return OrganizationRecordsConfiguration.build({
        platform: platform.value
    })

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
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})
</script>
