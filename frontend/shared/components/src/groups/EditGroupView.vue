<template>
    <LoadingView v-if="loadingOrganizer || !period" :error-box="loadingExternalOrganizerErrorBox" />
    <SaveView v-else :loading="saving" :title="title" :disabled="!hasChanges && !isNew" class="group-edit-view" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="type === GroupType.Membership">
            <p v-if="isNew" class="info-box">
                Maak gebruik van de activiteitenmodule om leden in te schrijven voor activiteiten. Maak daarvoor geen inschrijvingsgroep aan.
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

                <STInputBox v-if="defaultAgeGroups.length" title="Aansluiting/verzekering KSA-Nationaal*" error-fields="settings.defaultAgeGroupId" :error-box="errors.errorBox">
                    <Dropdown v-model="defaultAgeGroupId">
                        <option :value="null">
                            Geen automatische aansluiting of verzekeringen (!)
                        </option>
                        <option v-for="ageGroup of defaultAgeGroups" :key="ageGroup.id" :value="ageGroup.id">
                            {{ getAgeGroupSelectionText(ageGroup) }}
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
        <p v-if="patched.type === GroupType.EventRegistration" class="style-description-small">
            De beschrijving is zichtbaar als leden doorklikken om in te schrijven voor de activiteit.
        </p>

        <template v-if="patched.type === GroupType.EventRegistration && !organization && isMultiOrganization">
            <hr>
            <h2>Organisator</h2>
            <p>Voor nationale activiteiten moet je kiezen via welke groep alle betalingen verlopen. De betaalinstellingen van die groep worden dan gebruikt en alle inschrijvingen worden dan ingeboekt in de boekhouding van die groep.</p>
            <p class="style-description-block">
                Daarnaast bepaalt de organisator ook instellingen die invloed hebben op de dataverzameling en andere subtielere zaken.
            </p>

            <STList>
                <STListItem v-if="externalOrganization" :selectable="isNew" @click="isNew ? chooseOrganizer('Kies een organisator') : undefined">
                    <template #left>
                        <OrganizationAvatar :organization="externalOrganization" />
                    </template>

                    <h3 class="style-title-list">
                        {{ externalOrganization.name }}
                    </h3>
                    <p class="style-description">
                        {{ externalOrganization.address.anonymousString(Country.Belgium) }}
                    </p>

                    <template v-if="isNew" #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </template>

        <div v-if="type !== GroupType.WaitingList || patched.settings.prices.length !== 1 || patched.settings.prices[0]?.price.price" class="container">
            <hr>
            <h2 class="style-with-button">
                <div>{{ $t('0fb1a3a9-4ced-4097-b931-e865b3173cf9') }}</div>
                <div>
                    <button class="button text only-icon-smartphone" type="button" @click="addGroupPrice">
                        <span class="icon add" />
                        <span>{{ $t('a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc') }}</span>
                    </button>
                </div>
            </h2>
            <p>{{ $t("de2222d9-c934-4d06-8702-9527686de012") }}</p>

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
                            <span v-if="price.hidden" v-tooltip="$t('aff982ed-0f1a-4838-af79-9e00cd53131b')" class="icon gray eye-off" />
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
                    Vraag of keuzemenu toevoegen
                </h3>
            </STListItem>
        </STList>

        <hr>
        <h2>Inschrijvingen via ledenportaal</h2>
        <p>Leden kunnen zelf inschrijven via het ledenportaal als je deze optie open zet. Ze betalen het opgegeven tarief dan zelf via de betaalmethodes die je hebt ingesteld bij de instellingen van jouw groep.</p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="virtualOpenStatus" :value="GroupStatus.Closed" />
                </template>

                <h3 class="style-title-list">
                    Gesloten
                </h3>
                <p class="style-description-small">
                    De inschrijvingen zijn gesloten en openen niet automatisch.
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="virtualOpenStatus" value="RegistrationStartDate" />
                </template>

                <h3 class="style-title-list">
                    Vanaf datum
                </h3>
                <p class="style-description-small">
                    De inschrijvingen openen pas vanaf een bepaalde datum.
                </p>

                <div v-if="virtualOpenStatus === 'RegistrationStartDate'" class="split-inputs option" @click.stop.prevent>
                    <STInputBox :title="$t('4f7cef46-0b46-4225-839e-510d8a8b95bc')" error-fields="settings.registrationStartDate" :error-box="errors.errorBox">
                        <DateSelection v-model="registrationStartDate" />
                    </STInputBox>
                    <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" :title="$t('1e43813a-f48e-436c-bb49-e9ebb0f27f58')" :validator="errors.validator" />
                </div>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="virtualOpenStatus" :value="GroupStatus.Open" />
                </template>

                <h3 class="style-title-list">
                    Open
                </h3>
                <p class="style-description-small">
                    De inschrijvingen zijn open
                </p>
            </STListItem>

            <STListItem v-if="virtualOpenStatus !== GroupStatus.Closed" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useRegistrationEndDate" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('fd378bac-7d3d-4932-b511-851078805aff') }}
                </h3>

                <div v-if="useRegistrationEndDate" class="split-inputs option" @click.stop.prevent>
                    <STInputBox :title="$t('6905dd1f-fe82-4ddc-bc6c-9ad496d34a71')" error-fields="settings.registrationEndDate" :error-box="errors.errorBox">
                        <DateSelection v-model="registrationEndDate" />
                    </STInputBox>
                    <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" :title="$t('1617abfe-8657-4a9f-9fe3-6e6d896c4ef6')" :validator="errors.validator" />
                </div>
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

            <button v-if="requireGroupIds.length === 0" type="button" class="button text only-icon-smartphone" @click="addRequireGroupIds">
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

            <STListItem v-if="enableMaxMembers || type !== GroupType.WaitingList" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="enableMaxMembers" />
                </template>

                <h3 class="style-title-list">
                    Limiteer maximum aantal inschrijvingen  (waarvan nu {{ usedStock }} ingenomen of gereserveerd)
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

            <p v-if="waitingListType === WaitingListType.PreRegistrations || waitingListType === WaitingListType.ExistingMembersFirst" class="info-box">
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

                    <div v-if="waitingListType === WaitingListType.ExistingMembersFirst" class="option">
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

                <STListItem :selectable="true" element-name="label" :for="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate)">
                    <template #left>
                        <Radio :id="WaitingListType.PreRegistrations" v-model="waitingListType" :value="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate)" />
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

                    <div v-if="waitingListType === WaitingListType.PreRegistrations" class="option">
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
        <h2>Persoonsgegevens verzamelen</h2>
        <p>Deze persoonsgegevens zijn verplicht (soms optioneel) in te vullen voor leden die inschrijven. Let erop dat deze gegevens gedeeld zijn met andere inschrijvingen. Als dezelfde gegevens dus voor meerdere inschrijvingen verzameld worden, dan worden ze maar één keer gevraagd (anders kunnen leden de gegevens wel nog nakijken als het al even geleden werd ingevuld) en kan je niet per inschrijving andere gegevens invullen. Gebruik ze dus niet voor tijdelijke vragen.</p>

        <InheritedRecordsConfigurationBox :group-level="true" :override-organization="externalOrganization" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AgeInput, DateSelection, Dropdown, EditGroupView, ErrorBox, GroupIdsInput, InheritedRecordsConfigurationBox, NumberInput, OrganizationAvatar, TimeInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Country, DefaultAgeGroup, Group, GroupGenderType, GroupOption, GroupOptionMenu, GroupPrice, GroupSettings, GroupStatus, GroupType, OrganizationRecordsConfiguration, WaitingListType } from '@stamhoofd/structures';
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
        deleteHandler?: (() => Promise<void>) | null;
        showToasts?: boolean;
    }>(),
    {
        deleteHandler: null,
        showToasts: true,
        isMultiOrganization: false,
    },
);

const platform = usePlatform();
const organization = useOrganization();
const { patched, hasChanges, addPatch, patch } = usePatch(props.group);
const period = useRegistrationPeriod(computed(() => patched.value.periodId));
const forceShowRequireGroupIds = ref(false);
const usedStock = computed(() => patched.value.settings.getUsedStock(patched.value) || 0);

function addRequireGroupIds() {
    forceShowRequireGroupIds.value = true;
}

const { externalOrganization: externalOrganization, choose: chooseOrganizer, loading: loadingOrganizer, errorBox: loadingExternalOrganizerErrorBox } = useExternalOrganization(
    computed({
        get: () => patched.value.organizationId,
        set: (organizationId: string) => addPatch({
            organizationId,
        }),
    }),
);

const patchPricesArray = (prices: PatchableArrayAutoEncoder<GroupPrice>) => {
    addPatch({
        settings: GroupSettings.patch({
            prices,
        }),
    });
};
const { addPatch: addPricePatch, addPut: addPricePut, addDelete: addPriceDelete } = usePatchableArray(patchPricesArray);
const draggablePrices = useDraggableArray(() => patched.value.settings.prices, patchPricesArray);

const { addPatch: addOptionMenuPatch, addPut: addOptionMenuPut, addDelete: addOptionMenuDelete } = usePatchableArray((optionMenus: PatchableArrayAutoEncoder<GroupOptionMenu>) => {
    addPatch({
        settings: GroupSettings.patch({
            optionMenus,
        }),
    });
});

const recordsConfiguration = computed(() => patched.value.settings.recordsConfiguration);
const patchRecordsConfiguration = (recordsConfiguration: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
    addPatch({
        settings: GroupSettings.patch({
            recordsConfiguration,
        }),
    });
};
const inheritedRecordsConfiguration = computed(() => {
    return OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patched.value,
        includeGroup: false,
    });
});

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const pop = usePop();
const { priceName: reducedPriceName } = useFinancialSupportSettings({
    group: patched,
});
const present = usePresent();
const didSetAutomaticGroup = ref(false);

const availableWaitingLists = computed(() => {
    let base = externalOrganization?.value?.period?.groups.flatMap(g => g.waitingList ? [g.waitingList] : []) ?? [];

    // Replace patched waiting lists
    base = base.map((list) => {
        if (list.id === patched.value.waitingList?.id) {
            return patched.value.waitingList;
        }
        return list;
    });

    if (props.group.waitingList && props.group.waitingList.id !== patched.value.waitingList?.id) {
        base.push(props.group.waitingList);
    }

    // Add patched waiting list and the end, to maintain ordering
    if (patched.value.waitingList) {
        base.push(patched.value.waitingList);
    }

    // Remove duplicates (removing last one)
    base = base.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

    return base.map((list) => {
        const usedByGroups = externalOrganization?.value?.period?.groups.filter(g => g.waitingList?.id === list.id);
        return {
            list,
            description: usedByGroups?.length ? 'Deze wachtlijst wordt gebruikt door ' + Formatter.joinLast(usedByGroups.map(g => g.settings.name), ', ', ' en ') : 'Niet gebruikt',
        };
    });
});

const defaultAgeGroups = computed(() => {
    return platform.value.config.defaultAgeGroups;
});

const defaultAgeGroup = computed(() => {
    return defaultAgeGroups.value.find(g => g.id === patched.value.defaultAgeGroupId);
});

const name = computed({
    get: () => patched.value.settings.name,
    set: (name) => {
        addPatch({
            settings: GroupSettings.patch({
                name,
            }),
        });

        if ((!defaultAgeGroupId.value || didSetAutomaticGroup.value)) {
            const match = defaultAgeGroups.value.find(g => g.names.find(nn => StringCompare.typoCount(nn, name) === 0));
            if (match) {
                defaultAgeGroupId.value = match.id;
                didSetAutomaticGroup.value = true;
            }
            else {
                defaultAgeGroupId.value = null;
                didSetAutomaticGroup.value = true;
            }
        }
    },
});

const virtualOpenStatus = computed({
    get: () => {
        if (patched.value.status !== GroupStatus.Open) {
            return GroupStatus.Closed;
        }

        if (useRegistrationStartDate.value) {
            if (registrationStartDate.value !== props.group.settings.registrationStartDate || (registrationStartDate.value && registrationStartDate.value > new Date())) {
                return 'RegistrationStartDate' as const;
            }
        }

        if (patched.value.closed && props.group.closed) {
            return GroupStatus.Closed;
        }

        return GroupStatus.Open;
    },
    set: (val) => {
        if (val === 'RegistrationStartDate') {
            addPatch({
                status: GroupStatus.Open,
            });
            useRegistrationStartDate.value = true;

            if (patched.value.settings.registrationEndDate && patched.value.settings.registrationEndDate.getTime() <= Date.now()) {
                addPatch({
                    settings: GroupSettings.patch({
                        registrationEndDate: null,
                    }),
                });
            }
            return;
        }

        if (val === GroupStatus.Open) {
            addPatch({
                status: GroupStatus.Open,
            });
            useRegistrationStartDate.value = false;

            if (patched.value.settings.registrationEndDate && patched.value.settings.registrationEndDate.getTime() <= Date.now()) {
                addPatch({
                    settings: GroupSettings.patch({
                        registrationEndDate: null,
                    }),
                });
            }
            return;
        }

        if (val === GroupStatus.Closed) {
            addPatch({
                status: GroupStatus.Closed,
            });
        }
    },
});

const description = computed({
    get: () => patched.value.settings.description,
    set: description => addPatch({
        settings: GroupSettings.patch({
            description,
        }),
    }),
});

const minAge = computed({
    get: () => patched.value.settings.minAge,
    set: minAge => addPatch({
        settings: GroupSettings.patch({
            minAge,
        }),
    }),
});

const maxAge = computed({
    get: () => patched.value.settings.maxAge,
    set: maxAge => addPatch({
        settings: GroupSettings.patch({
            maxAge,
        }),
    }),
});

const genderType = computed({
    get: () => patched.value.settings.genderType,
    set: genderType => addPatch({
        settings: GroupSettings.patch({
            genderType,
        }),
    }),
});

const requireGroupIds = computed({
    get: () => patched.value.settings.requireGroupIds,
    set: requireGroupIds => addPatch({
        settings: GroupSettings.patch({
            requireGroupIds: requireGroupIds as any,
        }),
    }),
});

const allowRegistrationsByOrganization = computed({
    get: () => patched.value.settings.allowRegistrationsByOrganization,
    set: allowRegistrationsByOrganization => addPatch({
        settings: GroupSettings.patch({
            allowRegistrationsByOrganization,
        }),
    }),
});

const type = computed(() => patched.value.type);

const defaultAgeGroupId = computed({
    get: () => patched.value.defaultAgeGroupId,
    set: (defaultAgeGroupId) => {
        addPatch({
            defaultAgeGroupId,
        });
        didSetAutomaticGroup.value = false;
    },
});

const waitingListType = computed({
    get: () => patched.value.settings.waitingListType,
    set: (waitingListType) => {
        addPatch({
            settings: GroupSettings.patch({
                waitingListType,
            }),
        });

        if (waitingListType === WaitingListType.PreRegistrations) {
            if (!preRegistrationsDate.value && registrationStartDate.value) {
                const d = new Date(registrationStartDate.value);
                d.setMonth(d.getMonth() - 1);
                preRegistrationsDate.value = d;
            }
        }
        else {
            preRegistrationsDate.value = null;
        }
    },
});

const maxMembers = computed({
    get: () => patched.value.settings.maxMembers,
    set: maxMembers => addPatch({
        settings: GroupSettings.patch({
            maxMembers,
        }),
    }),
});

const enableMaxMembers = computed({
    get: () => patched.value.settings.maxMembers !== null,
    set: (enableMaxMembers) => {
        if (!enableMaxMembers) {
            addPatch({
                settings: GroupSettings.patch({
                    maxMembers: null,
                }),
            });
        }
        else {
            addPatch({
                settings: GroupSettings.patch({
                    maxMembers: props.group.settings.maxMembers ?? patched.value.settings.maxMembers ?? 200,
                }),
            });
        }
    },
});

const registrationStartDate = computed({
    get: () => patched.value.settings.registrationStartDate,
    set: registrationStartDate => addPatch({
        settings: GroupSettings.patch({
            registrationStartDate,
        }),
    }),
});

const registrationEndDate = computed({
    get: () => patched.value.settings.registrationEndDate,
    set: registrationEndDate => addPatch({
        settings: GroupSettings.patch({
            registrationEndDate,
        }),
    }),
});

const preRegistrationsDate = computed({
    get: () => patched.value.settings.preRegistrationsDate,
    set: preRegistrationsDate => addPatch({
        settings: GroupSettings.patch({
            preRegistrationsDate,
        }),
    }),
});

const priorityForFamily = computed({
    get: () => patched.value.settings.priorityForFamily,
    set: priorityForFamily => addPatch({
        settings: GroupSettings.patch({
            priorityForFamily,
        }),
    }),
});

const waitingListIfFull = computed({
    get: () => patched.value.settings.waitingListIfFull,
    set: waitingListIfFull => addPatch({
        settings: GroupSettings.patch({
            waitingListIfFull,
        }),
    }),
});

const waitingList = computed({
    get: () => patched.value.waitingList,
    set: waitingList => addPatch({
        waitingList,
    }),
});

const useRegistrationStartDate = computed({
    get: () => !!patched.value.settings.registrationStartDate,
    set: (useRegistrationStartDate) => {
        if (!useRegistrationStartDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: null,
                }),
            });
        }
        else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: props.group.settings.registrationStartDate && props.group.settings.registrationStartDate > new Date() ? props.group.settings.registrationStartDate : new Date(Date.now() + 1000 * 60 * 60 * 24),
                }),
            });
        }
    },
});

const useRegistrationEndDate = computed({
    get: () => !!patched.value.settings.registrationEndDate,
    set: (useRegistrationEndDate) => {
        if (!useRegistrationEndDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: null,
                }),
            });
        }
        else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: props.group.settings.registrationEndDate ?? new Date(),
                }),
            });
        }
    },
});

const title = computed(() => {
    if (props.group.type === GroupType.WaitingList) {
        return props.isNew ? $t('5936be80-5f7a-429b-8bc2-7afdd47ff232') : $t('b3f49e49-2db8-46e3-8a9b-bc05a4b989c0');
    }

    if (props.group.type === GroupType.EventRegistration) {
        return props.isNew ? $t('bd6ad13b-be70-4d03-a1a0-3578786f4df3') : $t('8fd3a74f-5dae-4a7e-bcd3-7ac1da2e7e6c');
    }
    return props.isNew ? $t('c7944f69-c772-4cc5-b7c8-2ef96272dfe0') : $t('d886e927-86d1-48ed-93ed-60e924484db1');
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        errors.errorBox = null;
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        await props.saveHandler(patch.value);
        if (props.showToasts) {
            await Toast.success($t('1e6b16bd-ca6e-49e2-9792-f8864a140d7b')).show();
        }
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm(props.group.type === GroupType.EventRegistration ? $t('90ec517b-14e6-4436-8c91-fabac5c1bddf') : $t('11426f89-b2bf-4f7a-bd5a-a51c34e6aa96'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            await Toast.success($t('eb66ea67-3c37-40f2-8572-9589d71ffab6')).show();
        }
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    finally {
        deleting.value = false;
    }
}

function addGroupPrice() {
    const price = GroupPrice.create({
        name: $t('9b0aebaf-d119-49df-955b-eb57654529e5'),
        price: patched.value.settings.prices[0]?.price?.clone(),
    });
    addPricePut(price);
}

async function editGroupPrice(price: GroupPrice) {
    await present({
        components: [
            new ComponentWithProperties(GroupPriceView, {
                price,
                group: patched,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<GroupPrice>) => {
                    addPricePatch(patch);
                },
                deleteHandler: async () => {
                    addPriceDelete(price.id);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addGroupOptionMenu() {
    const optionMenu = GroupOptionMenu.create({
        name: $t('9b0aebaf-d119-49df-955b-eb57654529e5'),
        options: [
            GroupOption.create({
                name: $t('82b0f786-db14-4a2c-8514-3ca3b28ac65f'),
            }),
        ],
    });

    await present({
        components: [
            new ComponentWithProperties(GroupOptionMenuView, {
                optionMenu,
                group: patched,
                isNew: true,
                saveHandler: async (patch: AutoEncoderPatchType<GroupOptionMenu>) => {
                    addOptionMenuPut(optionMenu.patch(patch));
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
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
            name: 'Wachtlijst van ' + patched.value.settings.name,
        }),
    });

    // Edit the group
    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                group: waitingList,
                isNew: true,
                showToasts: false,
                saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                    addPatch({
                        waitingList: waitingList.patch(patch),
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function isPropertyEnabled(name: 'emailAddress' | 'birthDay' | 'phone' | 'address' | 'gender') {
    return !!OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patched.value,
        includeGroup: true,
    })[name];
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
                        waitingList: patch,
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const genderTypes = [
    {
        value: GroupGenderType.Mixed,
        name: 'Gemengd',
    },
    {
        value: GroupGenderType.OnlyFemale,
        name: 'Enkel meisjes',
    },
    {
        value: GroupGenderType.OnlyMale,
        name: 'Enkel jongens',
    },
];

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

function getAgeGroupAgeString(ageGroup: DefaultAgeGroup): string {
    const { minAge, maxAge } = ageGroup;
    if (minAge === null && maxAge === null) {
        return '';
    }

    if (minAge && maxAge) {
        return `${minAge} - ${maxAge} jaar`;
    }

    if (minAge) {
        return `+${minAge}`;
    }

    if (maxAge) {
        return `-${maxAge}`;
    }

    return '';
}

function getAgeGroupSelectionText(ageGroup: DefaultAgeGroup) {
    let text = ageGroup.name;
    const ageGroupAgeString = getAgeGroupAgeString(ageGroup);

    if (ageGroupAgeString) {
        text = text + ': ' + ageGroupAgeString;
    }

    if (!ageGroup.defaultMembershipTypeId) {
        text = text + ' (niet automatisch)';
    }

    return text;
}

defineExpose({
    shouldNavigateAway,
});

</script>
