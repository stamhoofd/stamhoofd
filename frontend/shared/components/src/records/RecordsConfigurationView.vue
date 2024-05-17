<template>
    <SaveView :loading="saving" title="Gegevens van leden" :disabled="!hasChanges" @save="save">
        <h1>
            Gegevens van leden
        </h1>
            
        <STErrorsDefault :error-box="errors.errorBox" />

        <hr>
        <h2>Ingebouwde gegevens</h2>

        <p>Bepaalde gegevens zijn ingebouwd zodat we die ook op een speciale manier kunnen verwerken. Je kan deze hier aan of uit zetten, en eventueel bepaalde gegevens optioneel maken (altijd of bijvoorbeeld op basis van de leeftijd).</p>

        <p v-if="!getFilterConfiguration('emailAddress') && !getFilterConfiguration('parents')" class="error-box">
            Je moet minstens het e-mailadres van een lid of de gegevens van ouders verzamelen. Je kan niet beide uitschakelen.
        </p>

        <STList>
            <STListItem v-for="property of properties" :key="property.value.title">
                <template #left>
                    <Checkbox v-model="property.value.enabled" />
                </template>
                <p class="style-title-list">
                    {{ property.value.title }}
                </p>
                <p v-if="property.value.configuration" class="style-description-small">
                    {{ propertyFilterToString(property.value.configuration, filterBuilder) }}
                </p>
                <template v-if="property.value.enabled" #right>
                    <button class="button gray icon settings" type="button" @click="property.value.edit" />
                </template>
            </STListItem>
        </STList>

        <hr>
        <h2>Verplichte vragenlijsten</h2>
        <p>Deze vragenlijsten staan aan voor alle leden. Een lokale groep kan dit niet uitschakelen of wijzigen.</p>

        <hr>
        <h2>Optionele vragenlijsten</h2>
        <p>Een groep kan zelf kiezen of ze deze vragenlijsten aanzetten. De gegevens zijn gedeeld tussen alle lokale groepen en de koepel. Een lokale groep kan de vragenlijst dus niet wijzigen, maar kan het eventueel aanvullen door zelf extra vragenlijsten toe te voegen.</p>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, memberWithRegistrationsBlobUIFilterBuilders, propertyFilterToString, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { OrganizationRecordsConfiguration, PropertyFilter } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = defineProps<{
    recordsConfiguration: OrganizationRecordsConfiguration,
    inheritedRecordsConfiguration?: OrganizationRecordsConfiguration,
    saveHandler: (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => Promise<void>
}>();

const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const {patch, patched, addPatch, hasChanges} = usePatch(props.recordsConfiguration);
const $t = useTranslate();

type PropertyName = 'emailAddress'|'phone'|'gender'|'birthDay'|'address'|'parents'|'emergencyContacts';

const filterBuilder = memberWithRegistrationsBlobUIFilterBuilders[0]
function getFilterConfiguration(property: PropertyName): PropertyFilter|null {
    return patched.value[property]
}

function setEnableFilterConfiguration(property: PropertyName, enable: boolean) {
    if (enable === !!getFilterConfiguration(property)) {
        return
    }
    if (enable) {
        addPatch({
            [property]: props.recordsConfiguration[property] ?? PropertyFilter.createDefault()
        })
    } else {
        addPatch({
            [property]: null
        })
    }
}

function editEnableFilterConfiguration(property: PropertyName, title: string) {
    // todo
}

function buildPropertyRefs(property: PropertyName, title: string) {
    const enabled = computed({
        get: () => !!getFilterConfiguration(property),
        set: (value: boolean) => setEnableFilterConfiguration(property, value)
    })
    const locked = computed(() => !!props.inheritedRecordsConfiguration?.[property])
    const configuration = computed(() => getFilterConfiguration(property))

    return ref({
        title,
        enabled,
        locked,
        configuration,
        edit: () => editEnableFilterConfiguration(property, title)
    })
}

const properties = [
    buildPropertyRefs('phone', $t('shared.inputs.mobile.label') + ' (van lid zelf)'),
    buildPropertyRefs('emailAddress', 'E-mailadres (van lid zelf)'),
    buildPropertyRefs('gender', 'Geslacht'),
    buildPropertyRefs('birthDay', 'Geboortedatum'),
    buildPropertyRefs('address', 'Adres'),
    buildPropertyRefs('parents', 'Ouders'),
    buildPropertyRefs('emergencyContacts', 'Noodcontactpersonen'),
]

async function save() {
    if (saving.value) {
        return
    }
    saving.value = true;
    errors.errorBox = null;

    try {
        await props.saveHandler(patch.value);        
        await pop({force: true})
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})
</script>
