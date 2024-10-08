<template>
    <SaveView :loading="saving" title="Persoonsgegevens van leden" :disabled="!hasChanges" @save="save">
        <h1>
            Persoonsgegevens van leden
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr>
        <h2 v-if="app === 'admin'">
            Minimale gegevens voor alle leden in het systeem
        </h2>
        <h2 v-else>
            Ingebouwde gegevens (alle leden behalve wachtlijst)
        </h2>

        <p v-if="app === 'admin'">
            Deze minimale gegevens zijn essentieel voor een goede werking van het systeem en worden gevraagd voor elk lid - ook leden op de wachtlijst en leden die inschrijven bij niet-standaard leeftijdsgroepen.
        </p>
        <p v-if="app === 'admin'" class="style-description-block">
            Dit kan op meerdere niveau's worden uitgebreid: per standaard leeftijdsgroep van de koepel, op lokaal niveau van een lokale groep en per leeftijdsgroep, wachtlijst of activiteit van een lokale groep (of activiteit op nationaal niveau).
        </p>

        <p v-if="app === 'dashboard'">
            Bepaal welke gegevens je voor alle leden wilt verzamelen (behalve leden die enkel inschrijven op een wachtlijst - dat kan via de instellingen van die wachtlijst aangepast worden). Je kan dit ook per leeftijdsgroep instellen, voor maximale flexibiliteit (via de instellingen van elke leeftijdsgroep).
        </p>

        <p v-if="!getFilterConfiguration('emailAddress') && !getFilterConfiguration('parents')" class="error-box">
            Je moet minstens het e-mailadres van een lid of de gegevens van ouders verzamelen. Je kan niet beide uitschakelen.
        </p>

        <InheritedRecordsConfigurationBox :inherited-records-configuration="props.inheritedRecordsConfiguration" :records-configuration="patched" @patch:records-configuration="addPatch" />

        <hr>
        <h2 v-if="app === 'admin'">
            Ingebouwde persoonsgegevens uitbreiden
        </h2>
        <h2 v-else>
            Extra persoonsgegevens
        </h2>

        <p v-if="app === 'dashboard'">
            Breid het aantal persoonsgegevens zelf nog uit. Vervolgens kan je per inschrijvingsgroep (of gewoon voor alle leden) de persoonsgegevens inschakelen.
        </p>
        <p v-if="app === 'admin'">
            Voeg zelf nog persoonsgegevens toe die voor alle lokale groepen beschikbaar zijn. Je kan deze vervolgens verplichten voor alle leden die inschrijven bij gelijk welke standaard-leeftijdsgroep, of deze verplichten per standaard-leeftijdsgroep (via de instellingen van elke standaard-leeftijdsgroep). Indien niet ingeschakeld kunnen lokale groepen kunnen deze ook nog inschakelen volgens hun wensen.
        </p>
        <p class="style-description-block">
            Lees <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>

        <p class="info-box">
            Gebruik vragenlijsten niet om tijdelijke gegevens te verzamelen. Voeg daarvoor keuzemenu's toe aan je inschrijvingsgroepen of activiteiten.
        </p>

        <EditRecordCategoriesBox :categories="patched.recordCategories" :settings="settings" @patch:categories="addCategoriesPatch" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, memberWithRegistrationsBlobUIFilterBuilders, useAppContext, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, OrganizationRecordsConfiguration, Platform, PlatformFamily, PlatformMember, PropertyFilter, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { RecordEditorSettings } from './RecordEditorSettings';
import InheritedRecordsConfigurationBox from './components/InheritedRecordsConfigurationBox.vue';
import EditRecordCategoriesBox from './components/EditRecordCategoriesBox.vue';

type PropertyName = 'emailAddress' | 'phone' | 'gender' | 'birthDay' | 'address' | 'parents' | 'emergencyContacts';

const props = withDefaults(
    defineProps<{
        recordsConfiguration: OrganizationRecordsConfiguration;
        inheritedRecordsConfiguration?: OrganizationRecordsConfiguration | null;
        saveHandler: (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => Promise<void>;
    }>(), {
        inheritedRecordsConfiguration: null,
    },
);

// Hooks
const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const { patch, patched, addPatch, hasChanges } = usePatch(props.recordsConfiguration);

const organization = useOrganization();
const app = useAppContext();

const settings = computed(() => {
    const family = new PlatformFamily({
        platform: Platform.shared,
        contextOrganization: organization.value,
    });
    const ss = new RecordEditorSettings({
        dataPermission: true,
        toggleDefaultEnabled: true,
        inheritedRecordsConfiguration: props.inheritedRecordsConfiguration ? OrganizationRecordsConfiguration.mergeChild(props.inheritedRecordsConfiguration, patched.value) : patched.value,
        filterBuilder: (categories: RecordCategory[]) => {
            return memberWithRegistrationsBlobUIFilterBuilders[0];
        },
        exampleValue: new PlatformMember({
            member: MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({
                    firstName: 'Voorbeeld',
                    lastName: 'Lid',
                    dataPermissions: BooleanStatus.create({ value: true }),
                    birthDay: new Date('2020-01-01'),
                }),
                users: [],
                registrations: [],
            }),
            isNew: true,
            family,
        }),
        patchExampleValue(value: PlatformMember, patch) {
            const cloned = value.clone();
            value.addDetailsPatch(MemberDetails.patch({
                recordAnswers: patch,
            }));
            return cloned;
        },
    });
    family.members.push(ss.exampleValue);
    return ss;
});

function getFilterConfiguration(property: PropertyName): PropertyFilter | null {
    return props.inheritedRecordsConfiguration?.[property] ?? patched.value[property];
}

function addCategoriesPatch(p: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch({ recordCategories: p });
}

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

    try {
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});
</script>
