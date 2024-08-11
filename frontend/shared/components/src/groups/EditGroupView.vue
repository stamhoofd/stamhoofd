<template>
    <LoadingView v-if="loadingOrganizer || !period" :error-box="loadingExternalOrganizerErrorBox" />
    <SaveView v-else :loading="saving" :title="title" :disabled="!hasChanges && !isNew" class="group-edit-view" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="type === GroupType.Membership">
            <p v-if="(!defaultAgeGroupId) && defaultAgeGroups.length" class="warning-box">
                Leden die in deze groep inschrijven zullen niet automatisch worden aangesloten bij KSA Nationaal, en zijn dus ook niet verzekerd (tenzij je manueel een verzekering aanvraagt voor het lid). Dit is normaal gezien enkel voor uitzonderingen, bijvoorbeeld voor oud-leiding, een wachtzone, kampouders of helpende handen. Kies een standaard inschrijvingsgroep om de aansluiting bij KSA Nationaal te garanderen.
            </p>

            <p v-if="defaultAgeGroup && !defaultAgeGroup.defaultMembershipTypeId" class="warning-box">
                Leden die in deze groep inschrijven zullen niet automatisch worden aangesloten bij KSA Nationaal. Je kan wel een aansluiting op individuele basis per lid toevoegen.
            </p>

            <div class="split-inputs">
                <STInputBox title="Naam" error-fields="settings.name" :error-box="errors.errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="Naam van deze groep"
                        autocomplete=""
                    >
                </STInputBox>

                <STInputBox v-if="defaultAgeGroups.length" title="Aansluiting KSA-Nationaal*" error-fields="settings.defaultAgeGroupId" :error-box="errors.errorBox">
                    <Dropdown v-model="defaultAgeGroupId">
                        <option :value="null">
                            Geen automatische aansluiting of verzekeringen (!)
                        </option>
                        <option v-for="ageGroup of defaultAgeGroups" :key="ageGroup.id" :value="ageGroup.id">
                            {{ ageGroup.name }}<template v-if="!ageGroup.defaultMembershipTypeId">
                                (niet automatisch)
                            </template>
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>
            <p v-if="defaultAgeGroups.length" class="style-description-small">
                * Voor de aansluiting bij KSA Nationaal moet je nog een correcte standaard inschrijvingsgroep selecteren zodat de benaming die jouw groep gebruikt gekoppeld kan worden aan de benaming van KSA Nationaal.
            </p>
        </template>

        <template v-if="type === GroupType.WaitingList">
            <div class="split-inputs">
                <STInputBox title="Naam" error-fields="settings.name" :error-box="errors.errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="bv. Wachtlijst nieuwe leden"
                        autocomplete=""
                    >
                </STInputBox>
            </div>
        </template>

        <STInputBox title="Beschrijving" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Zichtbaar voor leden tijdens het inschrijven. Hier kan je bijvoorbeeld inschrijvinginstructies kwijt, of informatie geven over prijzen."
                autocomplete=""
            />
        </STInputBox>


        <template v-if="patched.type === GroupType.EventRegistration && !organization">
            <hr>
            <h2>Organisator</h2>
            <p>Voor nationale activiteiten moet je kiezen via welke groep alle betalingen verlopen. De betaalinstellingen van die groep worden dan gebruikt en alle inschrijvingen worden dan ingeboekt in de boekhouding van die groep.</p>
            <p class="style-description-block">
                Daarnaast bepaalt de organisator ook instellingen die invloed hebben op de dataverzameling en andere subtielere zaken.
            </p>

            <STList>
                <STListItem v-if="externalOrganization" :selectable="true" @click="chooseOrganizer('Kies een organisator')">
                    <template #left>
                        <OrganizationAvatar :organization="externalOrganization" />
                    </template>

                    <h3 class="style-title-list">
                        {{ externalOrganization.name }}
                    </h3>
                    <p class="style-description">
                        {{ externalOrganization.address.anonymousString(Country.Belgium) }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </template>

        <div v-if="type !== GroupType.WaitingList || patched.settings.prices.length !== 1 || patched.settings.prices[0]?.price.price" class="container">
            <hr>
            <h2 class="style-with-button">
                <div>{{ $t('Tarieven') }}</div>
                <div>
                    <button class="button text only-icon-smartphone" type="button" @click="addGroupPrice">
                        <span class="icon add" />
                        <span>{{ $t('Tarief') }}</span>
                    </button>
                </div>
            </h2>
            <p>Je kan een meerdere tarieven instellen en elk tarief een eigen naam geven. Een lid kan bij het inschrijven zelf één van de beschikbare tarieven kiezen.</p>

            <STList v-if="patched.settings.prices.length !== 1" v-model="draggablePrices" :draggable="true">
                <template #item="{item: price}">
                    <STListItem :selectable="true" class="right-stack" @click="editGroupPrice(price)">
                        <h3 class="style-title-list">
                            {{ price.name }}
                        </h3>

                        <p class="style-description-small">
                            Prijs: {{ formatPrice(price.price.price) }}
                        </p>

                        <p v-if="price.price.reducedPrice !== null" class="style-description-small">
                            {{ reducedPriceName }}: <span>{{ formatPrice(price.price.reducedPrice) }}</span>
                        </p>

                        <p v-if="price.isSoldOut(patched)" class="style-description-small">
                            Uitverkocht
                        </p>
                        <p v-else-if="price.stock" class="style-description-small">
                            Nog {{ pluralText(price.getRemainingStock(patched), 'stuk', 'stuks') }} beschikbaar
                        </p>

                        <template #right>
                            <span v-if="price.hidden" v-tooltip="$t('Verborgen')" class="icon gray eye-off" />
                            <span class="button icon drag gray" @click.stop @contextmenu.stop />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </template>
            </STList>
            <GroupPriceBox v-else :price="patched.settings.prices[0]" :group="patched" :errors="errors" @patch:price="addPricePatch" />
        </div>

        <div v-for="optionMenu of patched.settings.optionMenus" :key="optionMenu.id" class="container">
            <hr>
            <GroupOptionMenuBox :option-menu="optionMenu" :group="patched" :errors="errors" :level="2" @patch:group="addPatch" @patch:option-menu="addOptionMenuPatch" @delete="addOptionMenuDelete(optionMenu.id)" />
        </div>

        <hr>

        <STList>
            <STListItem :selectable="true" element-name="button" @click="addGroupOptionMenu()">
                <template #left>
                    <span class="icon add gray" />
                </template>

                <h3 class="style-title-list">
                    Keuzemenu toevoegen
                </h3>
            </STListItem>
        </STList>

        <div v-if="patched.type === GroupType.Membership" class="container">
            <hr>
            <h2>Restricties</h2>

            <template v-if="isPropertyEnabled('birthDay')">
                <div class="split-inputs">
                    <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="settings.minAge" :error-box="errors.errorBox">
                        <AgeInput v-model="minAge" :year="period.startDate.getFullYear()" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>

                    <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="settings.maxAge" :error-box="errors.errorBox">
                        <AgeInput v-model="maxAge" :year="period.startDate.getFullYear()" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>
                </div>
                <p class="st-list-description">
                    *Hoe oud het lid is op 31/12/{{ period.startDate.getFullYear() }}.<template v-if="externalOrganization?.address.country === Country.Belgium">
                        Ter referentie: leden uit het eerste leerjaar zijn 6 jaar op 31 december. Leden uit het eerste secundair zijn 12 jaar op 31 december.
                    </template>
                </p>
            </template>

            <STInputBox v-if="isPropertyEnabled('gender')" title="Jongens en meisjes" error-fields="genderType" :error-box="errors.errorBox" class="max">
                <STList>
                    <STListItem v-for="_genderType in genderTypes" :key="_genderType.value" element-name="label" :selectable="true">
                        <template #left>
                            <Radio v-model="genderType" :value="_genderType.value" />
                        </template>

                        <h3 class="style-title-list">
                            {{ _genderType.name }}
                        </h3>
                    </STListItem>
                </STList>
            </STInputBox>

            <button v-if="requireGroupIds.length == 0" type="button" class="button text only-icon-smartphone" @click="addRequireGroupIds">
                <span class="icon add" />
                <span>Verplicht andere inschrijving</span>
            </button>
        </div>

        <hr>
        <h2>Beschikbaarheid</h2>

        <STList>
            <STListItem v-if="isMultiOrganization || allowRegistrationsByOrganization" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="allowRegistrationsByOrganization" />
                </template>

                <h3 class="style-title-list">
                    Groepinschrijvingen
                </h3>
                <p class="style-description-small">
                    Een hoofdbeheerder van een groep kan meerdere leden inschrijven en schiet de betaling voor. De leden betalen vervolgens via een openstaand bedrag het geld terug aan hun groep.
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useRegistrationStartDate" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Start inschrijvingen pas na een bepaalde datum') }}
                </h3>

                <div v-if="useRegistrationStartDate" class="split-inputs option" @click.stop.prevent>
                    <STInputBox :title="$t('Inschrijven start op')" error-fields="settings.registrationStartDate" :error-box="errors.errorBox">
                        <DateSelection v-model="registrationStartDate" />
                    </STInputBox>
                    <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" :title="$t('Vanaf')" :validator="errors.validator" /> 
                </div>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useRegistrationEndDate" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Sluit inschrijvingen automatisch na een bepaalde datum') }}
                </h3>

                <div v-if="useRegistrationEndDate" class="split-inputs option" @click.stop.prevent>
                    <STInputBox :title="$t('Inschrijven sluit op')" error-fields="settings.registrationEndDate" :error-box="errors.errorBox">
                        <DateSelection v-model="registrationEndDate" />
                    </STInputBox>
                    <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" :title="$t('Tot welk tijdstip')" :validator="errors.validator" />
                </div>
            </STListItem>

            <STListItem v-if="enableMaxMembers || type !== GroupType.WaitingList" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="enableMaxMembers" />
                </template>

                <h3 class="style-title-list">
                    Limiteer maximum aantal inschrijvingen
                </h3>

                <div v-if="enableMaxMembers" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="maxMembers" :error-box="errors.errorBox">
                        <NumberInput v-model="maxMembers" :min="0" suffix="leden" suffix-singular="lid" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="enableMaxMembers" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="waitingListIfFull" />
                </template>

                <h3 class="style-title-list">
                    Laat leden inschrijven op wachtlijst als maximum is bereikt
                </h3>
            </STListItem>
        </STList>

        <template v-if="waitingListType !== WaitingListType.None || (enableMaxMembers && type === GroupType.Membership)">
            <hr>
            <h2>Voorrangsregeling</h2>
            <p>Zorg ervoor dat bestaande leden voorrang krijgen op inschrijvingen (vooral als je met wachtlijsten werkt).</p>

            <p v-if="waitingListType == WaitingListType.PreRegistrations || waitingListType == WaitingListType.ExistingMembersFirst" class="info-box">
                Leden worden als bestaand beschouwd als ze ingeschreven zijn voor een vorige inschrijvingsperiode van gelijk welke inschrijvingsgroep. 
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="waitingListType" :value="WaitingListType.None" />
                    </template>

                    <h3 class="style-title-list">
                        Iedereen kan gelijk starten met inschrijven (tot het maximum)
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label" :disabled="!waitingList">
                    <template #left>
                        <Radio v-model="waitingListType" :value="WaitingListType.ExistingMembersFirst" :disabled="!waitingList" />
                    </template>

                    <h3 class="style-title-list">
                        Alle nieuwe leden op wachtlijst
                    </h3>

                    <p class="style-description-small">
                        Bestaande leden kunnen meteen inschrijven (tot het maximum). De rest en nieuwe leden kunnen inschrijven op de wachtlijst.
                    </p>

                    <p v-if="!waitingList" class="style-description-small">
                        Maak eerst een wachtlijst aan om deze optie te gebruiken.
                    </p>

                    <div v-if="waitingListType == WaitingListType.ExistingMembersFirst" class="option">
                        <Checkbox v-model="priorityForFamily">
                            Ook gezinsleden van bestaande leden rechtstreeks laten inschrijven
                        </Checkbox>
                    </div>
                </STListItem>

                <STListItem :selectable="true" element-name="label" :disabled="!waitingList">
                    <template #left>
                        <Radio v-model="waitingListType" :value="WaitingListType.All" :disabled="!waitingList" />
                    </template>

                    <h3 class="style-title-list">
                        Iedereen op wachtlijst
                    </h3>

                    <p class="style-description-small">
                        Iedereen moet manueel worden goedgekeurd. Betaling gebeurt pas bij de definitieve inschrijving.
                    </p>

                    <p v-if="!waitingList" class="style-description-small">
                        Maak eerst een wachtlijst aan om deze optie te gebruiken.
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label" :for="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate || waitingListType == WaitingListType.PreRegistrations)">
                    <template #left>
                        <Radio :id="WaitingListType.PreRegistrations" v-model="waitingListType" :value="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate || waitingListType == WaitingListType.PreRegistrations)" />
                    </template>

                    <h3 class="style-title-list">
                        Voorinschrijvingen gebruiken
                    </h3>

                    <p class="style-description-small">
                        Bestaande leden kunnen al vroeger beginnen met inschrijven.
                    </p>

                    <p v-if="!registrationStartDate" class="style-description-small">
                        Stel eerst een startdatum in voor de inschrijvingen om deze optie te kunnen gebruiken.
                    </p>

                    <div v-if="waitingListType == WaitingListType.PreRegistrations" class="option">
                        <div class="split-inputs">
                            <STInputBox title="Begindatum voorinschrijvingen" error-fields="settings.preRegistrationsDate" :error-box="errors.errorBox">
                                <DateSelection v-model="preRegistrationsDate" />
                            </STInputBox>
                                    
                            <TimeInput v-model="preRegistrationsDate" title="Vanaf" :validator="errors.validator" /> 
                        </div>

                        <Checkbox v-model="priorityForFamily">
                            Ook gezinsleden van bestaande leden vroeger laten inschrijven
                        </Checkbox>
                    </div>
                </STListItem>
            </STList>
        </template>

        <div v-if="patched.waitingList || enableMaxMembers" class="container">
            <hr>
            <h2>Wachtlijst</h2>
            <p>Je kan een wachtlijst delen tussen verschillende leeftijdsgroepen. Op die manier kan je de wachtlijst makkelijk meerdere jaren aanhouden. Kies hieronder welke wachtlijst van toepassing is voor deze groep.</p>
            <p class="style-description-block">
                Je kan indien gewenst ook nog vragen stellen aan leden die op de wachtlijst willen inschrijven.
            </p>

            <STList v-if="availableWaitingLists.length">
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="waitingList" :value="null" />
                    </template>

                    <h3 class="style-title-list">
                        Geen wachtlijst
                    </h3>
                </STListItem>

                <STListItem v-for="{list, description} of availableWaitingLists" :key="list.id" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="waitingList" :value="list" />
                    </template>

                    <h3 class="style-title-list">
                        {{ list.settings.name }}
                    </h3>
                    <p class="style-description-small">
                        {{ description }}
                    </p>

                    <template #right>
                        <button class="button icon edit gray" type="button" @click="editWaitingList(list)" />
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                Er zijn nog geen wachtlijsten aangemaakt.
            </p>

            <p class="style-button-bar">
                <button type="button" class="button text" @click="addWaitingList">
                    <span class="icon add" />
                    <span>Nieuwe wachtlijst maken</span>
                </button>
            </p>
        </div>

        <JumpToContainer v-if="patched.type === GroupType.Membership" class="container" :visible="forceShowRequireGroupIds || !!requireGroupIds.length">
            <GroupIdsInput v-model="requireGroupIds" :default-period-id="patched.periodId" title="Verplichte andere inschrijvingen" />
        </JumpToContainer>

        <hr>
        <h2>Gegevensverzameling</h2>
        <p>Deze gegevens worden verzameld en gekoppeld aan leden die inschrijven. Let erop dat deze gegevens gedeeld zijn met andere inschrijvingen. Als dezelfde gegevens dus voor meerdere inschrijvingen verzameld worden, dan worden ze maar één keer gevraagd (anders kunnen leden de gegevens wel nog nakijken als het al even geleden werd ingevuld) en kan je niet per inschrijving andere gegevens invullen. Gebruik ze dus niet voor tijdelijke vragen.</p>

        <InheritedRecordsConfigurationBox :override-organization="externalOrganization" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AgeInput, DateSelection, Dropdown, EditGroupView, GroupIdsInput, InheritedRecordsConfigurationBox, NumberInput, OrganizationAvatar, TimeInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Country, Group, GroupGenderType, GroupOption, GroupOptionMenu, GroupPrice, GroupSettings, GroupType, OrganizationRecordsConfiguration, WaitingListType } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import JumpToContainer from '../containers/JumpToContainer.vue';
import { useErrors } from '../errors/useErrors';
import { useDraggableArray, useOrganization, usePatch, usePatchableArray, usePlatform } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import GroupOptionMenuBox from './components/GroupOptionMenuBox.vue';
import GroupOptionMenuView from './components/GroupOptionMenuView.vue';
import GroupPriceBox from './components/GroupPriceBox.vue';
import GroupPriceView from './components/GroupPriceView.vue';
import { useExternalOrganization, useFinancialSupportSettings, useRegistrationPeriod } from './hooks';

const props = withDefaults(
    defineProps<{
        group: Group;
        isMultiOrganization: boolean;
        isNew: boolean;
        saveHandler: (group: AutoEncoderPatchType<Group>) => Promise<void>;
        deleteHandler?: (() => Promise<void>)|null;
        showToasts?: boolean;
    }>(),
    {
        deleteHandler: null,
        showToasts: true,
        isMultiOrganization: false
    }
);

const platform = usePlatform();
const organization = useOrganization();
const {patched, hasChanges, addPatch, patch} = usePatch(props.group);
const period = useRegistrationPeriod(computed(() => patched.value.periodId))
const forceShowRequireGroupIds = ref(false)

function addRequireGroupIds() {
    forceShowRequireGroupIds.value = true
}

const {externalOrganization: externalOrganization, choose: chooseOrganizer, loading: loadingOrganizer, errorBox: loadingExternalOrganizerErrorBox} = useExternalOrganization(
    computed({
        get: () => patched.value.organizationId,
        set: (organizationId: string) => addPatch({
            organizationId
        })
    })
)

const patchPricesArray = (prices: PatchableArrayAutoEncoder<GroupPrice>) => {
    addPatch({
        settings: GroupSettings.patch({
            prices
        })
    })
}
const {addPatch: addPricePatch, addPut: addPricePut, addDelete: addPriceDelete} = usePatchableArray(patchPricesArray)
const draggablePrices = useDraggableArray(() => patched.value.settings.prices, patchPricesArray)

const {addPatch: addOptionMenuPatch, addPut: addOptionMenuPut, addDelete: addOptionMenuDelete} = usePatchableArray((optionMenus: PatchableArrayAutoEncoder<GroupOptionMenu>) => {
    addPatch({
        settings: GroupSettings.patch({
            optionMenus
        })
    })
})

const recordsConfiguration = computed(() => patched.value.settings.recordsConfiguration);
const patchRecordsConfiguration = (recordsConfiguration: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
    addPatch({
        settings: GroupSettings.patch({
            recordsConfiguration
        })
    })
}
const inheritedRecordsConfiguration = computed(() => {
    return OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patched.value,
        includeGroup: false
    })

});

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const pop = usePop();
const {priceName: reducedPriceName} = useFinancialSupportSettings()
const present = usePresent();
const didSetAutomaticGroup = ref(false)

const availableWaitingLists = computed(() => {
    let base = externalOrganization?.value?.period?.groups.flatMap(g => g.waitingList ? [g.waitingList] : []) ?? []

    // Replace patched waiting lists
    base = base.map(list => {
        if (list.id === patched.value.waitingList?.id) {
            return patched.value.waitingList
        }
        return list
    })
    
    if (props.group.waitingList && props.group.waitingList.id !== patched.value.waitingList?.id) {
        base.push(props.group.waitingList)
    }

    // Add patched waiting list and the end, to maintain ordering
    if (patched.value.waitingList) {
        base.push(patched.value.waitingList)
    }

    // Remove duplicates (removing last one)
    base = base.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)

    return base.map((list) => {
        const usedByGroups = externalOrganization?.value?.period?.groups.filter(g => g.waitingList?.id === list.id)
        return {
            list,
            description: usedByGroups?.length ? 'Deze wachtlijst wordt gebruikt door ' + Formatter.joinLast(usedByGroups.map(g => g.settings.name), ', ', ' en ') : 'Niet gebruikt'
        }
    })
})

const defaultAgeGroups = computed(() => {
    return platform.value.config.defaultAgeGroups
})

const defaultAgeGroup = computed(() => {
    return defaultAgeGroups.value.find(g => g.id === patched.value.defaultAgeGroupId)
})

const name = computed({
    get: () => patched.value.settings.name,
    set: (name) => {
        addPatch({
            settings: GroupSettings.patch({
                name
            })
        })

        if ((!defaultAgeGroupId.value || didSetAutomaticGroup.value)) {
            const match = defaultAgeGroups.value.find(g => g.names.find(nn => StringCompare.typoCount(nn, name) === 0))
            if (match) {
                defaultAgeGroupId.value = match.id
                didSetAutomaticGroup.value = true
            } else {
                defaultAgeGroupId.value = null
                didSetAutomaticGroup.value = true
            }
        }
    }
})

const description = computed({
    get: () => patched.value.settings.description,
    set: (description) => addPatch({
        settings: GroupSettings.patch({
            description
        })
    })
})

const minAge = computed({
    get: () => patched.value.settings.minAge,
    set: (minAge) => addPatch({
        settings: GroupSettings.patch({
            minAge
        })
    })
})

const maxAge = computed({
    get: () => patched.value.settings.maxAge,
    set: (maxAge) => addPatch({
        settings: GroupSettings.patch({
            maxAge
        })
    })
})

const genderType = computed({
    get: () => patched.value.settings.genderType,
    set: (genderType) => addPatch({
        settings: GroupSettings.patch({
            genderType
        })
    })
});

const requireGroupIds = computed({
    get: () => patched.value.settings.requireGroupIds,
    set: (requireGroupIds) => addPatch({
        settings: GroupSettings.patch({
            requireGroupIds: requireGroupIds as any
        })
    })
});

const allowRegistrationsByOrganization = computed({
    get: () => patched.value.settings.allowRegistrationsByOrganization,
    set: (allowRegistrationsByOrganization) => addPatch({
        settings: GroupSettings.patch({
            allowRegistrationsByOrganization
        })
    })
})

const type = computed(() => patched.value.type)

const defaultAgeGroupId = computed({
    get: () => patched.value.defaultAgeGroupId,
    set: (defaultAgeGroupId) => {
        addPatch({
            defaultAgeGroupId
        })
        didSetAutomaticGroup.value = false
    }
})

const waitingListType = computed({
    get: () => patched.value.settings.waitingListType,
    set: (waitingListType) => {
        addPatch({
            settings: GroupSettings.patch({
                waitingListType
            })
        })

        if (waitingListType === WaitingListType.PreRegistrations) {
            if (!preRegistrationsDate.value && registrationStartDate.value) {
                const d = new Date(registrationStartDate.value)
                d.setMonth(d.getMonth() - 1)
                preRegistrationsDate.value = d
            }
        } else {
            preRegistrationsDate.value = null
        }

    }
})

const maxMembers = computed({
    get: () => patched.value.settings.maxMembers,
    set: (maxMembers) => addPatch({
        settings: GroupSettings.patch({
            maxMembers
        })
    })
})

const enableMaxMembers = computed({
    get: () => !!patched.value.settings.maxMembers,
    set: (enableMaxMembers) => {
        if (!enableMaxMembers) {
            addPatch({
                settings: GroupSettings.patch({
                    maxMembers: null
                })
            })
        } else {
            addPatch({
                settings: GroupSettings.patch({
                    maxMembers: props.group.settings.maxMembers ?? patched.value.settings.maxMembers ?? 200
                })
            })
        }
    }
})

const registrationStartDate = computed({
    get: () => patched.value.settings.registrationStartDate,
    set: (registrationStartDate) => addPatch({
        settings: GroupSettings.patch({
            registrationStartDate
        })
    })
})

const registrationEndDate = computed({
    get: () => patched.value.settings.registrationEndDate,
    set: (registrationEndDate) => addPatch({
        settings: GroupSettings.patch({
            registrationEndDate
        })
    })
})

const preRegistrationsDate = computed({
    get: () => patched.value.settings.preRegistrationsDate,
    set: (preRegistrationsDate) => addPatch({
        settings: GroupSettings.patch({
            preRegistrationsDate
        })
    })
})

const priorityForFamily = computed({
    get: () => patched.value.settings.priorityForFamily,
    set: (priorityForFamily) => addPatch({
        settings: GroupSettings.patch({
            priorityForFamily
        })
    })
})

const waitingListIfFull = computed({
    get: () => patched.value.settings.waitingListIfFull,
    set: (waitingListIfFull) => addPatch({
        settings: GroupSettings.patch({
            waitingListIfFull
        })
    })
})

const waitingList = computed({
    get: () => patched.value.waitingList,
    set: (waitingList) => addPatch({
        waitingList
    })
})

const useRegistrationStartDate = computed({
    get: () => !!patched.value.settings.registrationStartDate,
    set: (useRegistrationStartDate) => {
        if (!useRegistrationStartDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: null
                })
            })
        } else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: props.group.settings.registrationStartDate ?? new Date()
                })
            })
        }
    }
})

const useRegistrationEndDate = computed({
    get: () => !!patched.value.settings.registrationEndDate,
    set: (useRegistrationEndDate) => {
        if (!useRegistrationEndDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: null
                })
            })
        } else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: props.group.settings.registrationEndDate ?? new Date()
                })
            })
        }
    }
})

const title = computed(() => {
    if (props.group.type === GroupType.WaitingList) {
        return props.isNew ? $t('Nieuwe wachtlijst') :$t('Wachtlijst bewerken');
    }

    if (props.group.type === GroupType.EventRegistration) {
        return props.isNew ? $t('groups.title.new.eventRegistration') :$t('groups.title.edit.eventRegistration');
    }
    return props.isNew ? $t('groups.title.new.membership') : $t('groups.title.edit.membership');
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        if (props.showToasts) {
            await Toast.success($t('shared.confirmation.saved')).show();
        }
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm(props.group.type === GroupType.EventRegistration ? $t('groups.confirm.delete.eventRegistration') : $t('groups.confirm.delete.membership'), $t('shared.confirmDelete'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            await Toast.success($t('shared.confirmation.deleted')).show();
        }
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        deleting.value = false;
    }
}

function addGroupPrice() {
    const price = GroupPrice.create({
        name: $t('Naamloos'),
        price: patched.value.settings.prices[0]?.price?.clone()
    })
    addPricePut(price)
}

async function editGroupPrice(price: GroupPrice) {
    await present({
        components: [
            new ComponentWithProperties(GroupPriceView, {
                price,
                group: patched,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<GroupPrice>) => {
                    addPricePatch(patch)
                },
                deleteHandler: async () => {
                    addPriceDelete(price.id)
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function addGroupOptionMenu() {
    const optionMenu = GroupOptionMenu.create({
        name: $t('Naamloos'),
        options: [
            GroupOption.create({
                name: $t('Optie 1')
            })
        ]
    })
    
    await present({
        components: [
            new ComponentWithProperties(GroupOptionMenuView, {
                optionMenu,
                group: patched,
                isNew: true,
                saveHandler: async (patch: AutoEncoderPatchType<GroupOptionMenu>) => {
                    addOptionMenuPut(optionMenu.patch(patch))
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function addWaitingList() {
    if (!externalOrganization.value) {
        return;
    }

    const waitingList = Group.create({
        organizationId: patched.value.organizationId,
        periodId: patched.value.periodId,
        type: GroupType.WaitingList,
        settings: GroupSettings.create({
            name: 'Wachtlijst van ' + patched.value.settings.name
        })
    })

    // Edit the group
    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                group: waitingList,
                isNew: true,
                showToasts: false,
                saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                    addPatch({
                        waitingList: waitingList.patch(patch)
                    })
                }
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

function isPropertyEnabled(name: "emailAddress" | "birthDay" | "phone" | "address" | "gender") {
    return !!OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patched.value,
        includeGroup: true
    })[name]
}

async function editWaitingList(waitingList: Group) {
    if (waitingList.id !== patched.value.waitingList?.id) {
        return;
    }

    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                group: waitingList,
                isNew: false,
                showToasts: false,
                saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                    addPatch({
                        waitingList: patch
                    })
                }
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

const genderTypes = [
    {
        value: GroupGenderType.Mixed,
        name: "Gemengd",
    },
    {
        value: GroupGenderType.OnlyFemale,
        name: "Enkel meisjes",
    },
    {
        value: GroupGenderType.OnlyMale,
        name: "Enkel jongens",
    },
]

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
