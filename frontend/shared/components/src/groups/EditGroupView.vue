<template>
    <LoadingViewTransition :error-box="loadingExternalOrganizerErrorBox">
        <SaveView v-if="!loadingOrganizer && period" :loading="saving" :title="title" :disabled="!hasChanges && !isNew" class="group-edit-view" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
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
                            autocomplete="off"
                        >
                    </STInputBox>

                    <STInputBox v-if="defaultAgeGroupsFiltered.length" :title="$t('528545c4-028b-4711-9b16-f6fa990c3130')" error-fields="settings.defaultAgeGroupId" :error-box="errors.errorBox">
                        <Dropdown v-model="defaultAgeGroupId">
                            <option :value="null">
                                Geen automatische aansluiting of verzekeringen (!)
                            </option>
                            <option v-for="ageGroup of defaultAgeGroupsFiltered" :key="ageGroup.id" :value="ageGroup.id">
                                {{ getAgeGroupSelectionText(ageGroup) }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </div>
                <p v-if="defaultAgeGroups.length" class="style-description-small">
                    {{ $t('e99c7d31-f9fe-4e0f-8947-bdc30784de5b') }}
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
                            autocomplete="off"
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
                    autocomplete="off"
                />
            </STInputBox>
            <p v-if="patchedGroup.type === GroupType.EventRegistration" class="style-description-small">
                De beschrijving is zichtbaar als leden doorklikken om in te schrijven voor de activiteit.
            </p>

            <template v-if="patchedGroup.type === GroupType.EventRegistration && isMultiOrganization">
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

            <div v-if="type !== GroupType.WaitingList || patchedGroup.settings.prices.length !== 1 || patchedGroup.settings.prices[0]?.price.price" class="container">
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

                <STList v-if="patchedGroup.settings.prices.length !== 1" v-model="draggablePrices" :draggable="true">
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

                            <p v-if="price.isSoldOut(patchedGroup)" class="style-description-small">
                                Uitverkocht
                            </p>
                            <p v-else-if="price.stock" class="style-description-small">
                                Nog {{ pluralText(price.getRemainingStock(patchedGroup) ?? 0, 'stuk', 'stuks') }} beschikbaar
                            </p>

                            <template #right>
                                <span v-if="price.hidden" v-tooltip="$t('aff982ed-0f1a-4838-af79-9e00cd53131b')" class="icon gray eye-off" />
                                <span class="button icon drag gray" @click.stop @contextmenu.stop />
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </template>
                </STList>
                <GroupPriceBox v-else :price="patchedGroup.settings.prices[0]" :group="patchedGroup" :errors="errors" :default-membership-type-id="defaultMembershipTypeId" @patch:price="addPricePatch" />
            </div>

            <div v-for="optionMenu of patchedGroup.settings.optionMenus" :key="optionMenu.id" class="container">
                <hr>
                <GroupOptionMenuBox :option-menu="optionMenu" :group="patchedGroup" :errors="errors" :level="2" @patch:group="addGroupPatch" @patch:option-menu="addOptionMenuPatch" @delete="addOptionMenuDelete(optionMenu.id)" />
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

            <div v-if="patchedGroup.type === GroupType.Membership" class="container">
                <hr>
                <h2>Restricties</h2>

                <template v-if="isPropertyEnabled('birthDay')">
                    <div class="split-inputs">
                        <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="settings.minAge" :error-box="errors.errorBox">
                            <AgeInput v-model="minAge" :year="patched.period.startDate.getFullYear()" placeholder="Onbeperkt" :nullable="true" />
                        </STInputBox>

                        <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="settings.maxAge" :error-box="errors.errorBox">
                            <AgeInput v-model="maxAge" :year="patched.period.startDate.getFullYear()" placeholder="Onbeperkt" :nullable="true" />
                        </STInputBox>
                    </div>
                    <p class="st-list-description">
                        *Hoe oud het lid is op 31/12/{{ patched.period.startDate.getFullYear() }}.<template v-if="externalOrganization?.address.country === Country.Belgium">
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

                <STInputBox title="Aansluiting" error-fields="requirePlatformMembershipOnRegistrationDate" :error-box="errors.errorBox" class="max">
                    <STList>
                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="requirePlatformMembershipOnRegistrationDate" />
                            </template>

                            <h3 class="style-title-list">
                                Aansluiting is verplicht
                            </h3>
                            <p class="style-description-small">
                                Een lid moet een aansluiting hebben op de dag van de inschrijving.
                            </p>
                        </STListItem>
                    </STList>
                </STInputBox>

                <button v-if="requireGroupIds.length === 0" type="button" class="button text only-icon-smartphone" @click="addRequireGroupIds">
                    <span class="icon add" />
                    <span>Verplicht andere inschrijving</span>
                </button>
            </div>

            <div v-if="showAllowRegistrationsByOrganization || showEnableMaxMembers" class="container">
                <hr>
                <h2>Beschikbaarheid</h2>
                <STList>
                    <STListItem v-if="showAllowRegistrationsByOrganization" :selectable="true" element-name="label">
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
                    <STListItem v-if="showEnableMaxMembers" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="enableMaxMembers" />
                        </template>
                        <h3 class="style-title-list">
                            Limiteer maximum aantal inschrijvingen (waarvan nu {{ usedStock }} ingenomen of gereserveerd)
                        </h3>
                        <div v-if="enableMaxMembers" class="option" @click.stop.prevent>
                            <STInputBox title="" error-fields="maxMembers" :error-box="errors.errorBox">
                                <NumberInput v-model="maxMembers" :min="0" suffix="leden" suffix-singular="lid" />
                            </STInputBox>
                            <p class="style-description-small">
                                Als er een wachtlijst is ingesteld kunnen de leden op de wachtlijst inschrijven als de groep volzet is.
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </div>

            <div v-if="patchedGroup.waitingList || enableMaxMembers" class="container">
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

                    <STListItem v-for="{list, description: waitingListDescription} of availableWaitingLists" :key="list.id" :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingList" :value="list" />
                        </template>

                        <h3 class="style-title-list">
                            {{ list.settings.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ waitingListDescription }}
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

            <template v-if="waitingListType !== WaitingListType.None || (enableMaxMembers && type === GroupType.Membership)">
                <hr>
                <h2>Voorrangsregeling online inschrijvingen</h2>
                <p>Zorg ervoor dat bestaande leden voorrang krijgen op inschrijvingen (vooral als je met wachtlijsten werkt).</p>

                <p v-if="waitingListType === WaitingListType.PreRegistrations || waitingListType === WaitingListType.ExistingMembersFirst" class="info-box">
                    {{ $t('e2130593-e64d-4f3a-bb16-75ba4ed7604e') }}
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

            <JumpToContainer v-if="patchedGroup.type === GroupType.Membership" class="container" :visible="forceShowRequireGroupIds || !!requireGroupIds.length">
                <GroupIdsInput v-model="requireGroupIds" :default-period-id="patchedGroup.periodId" title="Verplichte andere inschrijvingen" />
            </JumpToContainer>

            <template v-if="$feature('member-trials')">
                <template v-if="patchedGroup.type === GroupType.Membership && (!defaultMembershipConfig || defaultMembershipConfig.trialDays)">
                    <hr>
                    <h2>{{ $t('8265d9e0-32c1-453c-ab2f-d31f1eb244c3') }}</h2>
                    <p>{{ $t('89a760d7-8995-458c-9635-da104971e95c') }}</p>

                    <STInputBox :title="$t('f0ceba51-bad2-4454-9a9b-4b12f0983c82')" error-fields="settings.trialDays" :error-box="errors.errorBox">
                        <NumberInput v-model="trialDays" suffix="dagen" suffix-singular="dag" :min="0" :max="defaultMembershipConfig?.trialDays ?? null" />
                    </STInputBox>
                    <p v-if="defaultMembershipConfig && defaultMembershipConfig.trialDays" class="style-description-small">
                        {{ $t('d68a6d63-d782-49e2-84a5-4f77dbfa2977', {days: Formatter.days(defaultMembershipConfig.trialDays)}) }}
                    </p>

                    <STInputBox :title="$t('5ecd5e10-f233-4a6c-8acd-c1abff128a21')" error-fields="settings.startDate" :error-box="errors.errorBox">
                        <DateSelection v-model="startDate" :placeholder="formatDate(patchedGroup.settings.startDate, true)" :min="patched.period.startDate" :max="patched.period.endDate" />
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('db636f2c-371d-4209-bd44-eaa6984c2813') }}
                    </p>
                </template>
            </template>

            <hr>
            <h2>Persoonsgegevens verzamelen</h2>
            <p>Deze persoonsgegevens zijn verplicht (soms optioneel) in te vullen voor leden die inschrijven. Let erop dat deze gegevens gedeeld zijn met andere inschrijvingen. Als dezelfde gegevens dus voor meerdere inschrijvingen verzameld worden, dan worden ze maar één keer gevraagd (anders kunnen leden de gegevens wel nog nakijken als het al even geleden werd ingevuld) en kan je niet per inschrijving andere gegevens invullen. Gebruik ze dus niet voor tijdelijke vragen.</p>
            <p v-if="auth.hasFullAccess()" class="info-box">
                Voeg nieuwe persoonsgegevens toe via Instellingen → Persoonsgegevens van leden.
            </p>
            <InheritedRecordsConfigurationBox :group-level="true" :override-organization="externalOrganization" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />

            <hr>
            <h2>Eénmalige vragen</h2>
            <p>Deze vragen zijn enkel van toepassing op deze specifieke inschrijving en gaan daarna verloren. <strong class="style-strong">Bij elke inschrijving moeten ze opnieuw worden ingegeven:</strong> het antwoord hangt dus vast aan de inschrijving, niet het lid zelf. De antwoorden zijn enkel zichtbaar in de context van een inschrijving, niet tussen de gegevens van een lid.</p>

            <p class="warning-box">
                <span>
                    Gebruik dit <strong class="style-strong style-underline">NIET</strong> om persoonsgegevens van leden te verzamelen (bv. GEEN allergieën, al dan niet kunnen zwemmen, dieetvoorkeur...) - anders moeten ze dit per inschrijving en elk jaar opnieuw ingeven en is het niet duidelijk welke gegevens nu de juiste zijn. Voeg hier enkel vragen toe die je éénmalig nodig hebt specifiek voor deze activiteit.
                </span>
            </p>

            <EditRecordCategoriesBox :categories="patchedGroup.settings.recordCategories" :settings="recordEditorSettings" @patch:categories="addRecordCategoriesPatch" />
        </SaveView>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AgeInput, DateSelection, Dropdown, EditGroupView, EditRecordCategoriesBox, ErrorBox, GroupIdsInput, InheritedRecordsConfigurationBox, LoadingViewTransition, NumberInput, OrganizationAvatar, RecordEditorSettings, RecordEditorType, TimeInput, useRegisterItemFilterBuilders } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { BooleanStatus, Country, DefaultAgeGroup, Group, GroupGenderType, GroupOption, GroupOptionMenu, GroupPrice, GroupSettings, GroupStatus, GroupType, MemberDetails, MemberWithRegistrationsBlob, Organization, OrganizationRecordsConfiguration, OrganizationRegistrationPeriod, Platform, PlatformFamily, PlatformMember, RecordCategory, RegisterItem, WaitingListType, type MemberProperty } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import JumpToContainer from '../containers/JumpToContainer.vue';
import { useErrors } from '../errors/useErrors';
import { useAuth, useDraggableArray, useOrganization, usePatch, usePatchableArray, usePlatform } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import GroupOptionMenuBox from './components/GroupOptionMenuBox.vue';
import GroupOptionMenuView from './components/GroupOptionMenuView.vue';
import GroupPriceBox from './components/GroupPriceBox.vue';
import GroupPriceView from './components/GroupPriceView.vue';
import { useExternalOrganization, useFinancialSupportSettings } from './hooks';

const props = withDefaults(
    defineProps<{
        isNew: boolean;
        period: OrganizationRegistrationPeriod;
        groupId: string;
        isMultiOrganization: boolean;
        saveHandler: (period: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>;
        deleteHandler?: (() => Promise<void>) | null;
        showToasts?: boolean;
        organizationHint?: Organization | null;
    }>(),
    {
        deleteHandler: null,
        showToasts: true,
        isMultiOrganization: false,
        organizationHint: null,
    },
);

const platform = usePlatform();
const organization = useOrganization();
const { patched, hasChanges, addPatch, patch } = usePatch(props.period);
const patchedGroup = computed(() => patched.value.groups.find(group => group.id === props.groupId)!);
const groupBeforePatch = computed(() => props.period.groups.find(group => group.id === props.groupId)!);
if (!groupBeforePatch.value) {
    console.error(`Group with id ${props.groupId} not found in OrganizationRegistrationPeriod`);
}

function addGroupPatch(newPatch: PartialWithoutMethods<AutoEncoderPatchType<Group>>) {
    const groups: PatchableArrayAutoEncoder<Group> = new PatchableArray();

    groups.addPatch(Group.patch({ id: props.groupId, ...newPatch }));

    addPatch({ groups });
}

const forceShowRequireGroupIds = ref(false);
const usedStock = computed(() => patchedGroup.value.settings.getUsedStock(patchedGroup.value) || 0);
const auth = useAuth();

function addRequireGroupIds() {
    forceShowRequireGroupIds.value = true;
}

const { externalOrganization, choose: chooseOrganizer, loading: loadingOrganizer, errorBox: loadingExternalOrganizerErrorBox } = useExternalOrganization(
    computed({
        get: () => patchedGroup.value.organizationId,
        set: (organizationId: string) => addGroupPatch({
            organizationId,
        }),
    }),
    props.organizationHint,
);

const patchPricesArray = (prices: PatchableArrayAutoEncoder<GroupPrice>) => {
    addGroupPatch({
        settings: GroupSettings.patch({
            prices,
        }),
    });
};

function addRecordCategoriesPatch(categories: PatchableArrayAutoEncoder<RecordCategory>) {
    addGroupPatch({
        settings: GroupSettings.patch({
            recordCategories: categories,
        }),
    });
}

const { addPatch: addPricePatch, addPut: addPricePut, addDelete: addPriceDelete } = usePatchableArray(patchPricesArray);
const draggablePrices = useDraggableArray(() => patchedGroup.value.settings.prices, patchPricesArray);

const { addPatch: addOptionMenuPatch, addPut: addOptionMenuPut, addDelete: addOptionMenuDelete } = usePatchableArray((optionMenus: PatchableArrayAutoEncoder<GroupOptionMenu>) => {
    addGroupPatch({
        settings: GroupSettings.patch({
            optionMenus,
        }),
    });
});

const recordsConfiguration = computed(() => patchedGroup.value.settings.recordsConfiguration);
const patchRecordsConfiguration = (recordsConfiguration: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
    addGroupPatch({
        settings: GroupSettings.patch({
            recordsConfiguration,
        }),
    });
};
const inheritedRecordsConfiguration = computed(() => {
    return OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patchedGroup.value,
        includeGroup: false,
    });
});

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const pop = usePop();
const { priceName: reducedPriceName } = useFinancialSupportSettings({
    group: patchedGroup,
});
const present = usePresent();
const didSetAutomaticGroup = ref(false);

const availableWaitingLists = computed(() => {
    let base = patched.value.waitingLists;

    // Add patched waiting list and the end, to maintain ordering
    if (patchedGroup.value.waitingList) {
        base.push(patchedGroup.value.waitingList);
    }

    base = base.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

    return base
        .map((list) => {
            const usedByGroups = patched.value.groups.filter(g => g.waitingList?.id === list.id);
            return {
                list,
                description: usedByGroups?.length ? 'Deze wachtlijst wordt gebruikt door ' + Formatter.joinLast(usedByGroups.map(g => g.settings.name), ', ', ' en ') : 'Niet gebruikt',
            };
        });
});

const defaultAgeGroups = computed(() => {
    return platform.value.config.defaultAgeGroups;
});

const defaultAgeGroupsFiltered = computed(() => {
    const tags = organization.value?.meta.tags ?? [];
    return defaultAgeGroups.value.filter(defaultAgeGroup => defaultAgeGroup.isEnabledForTags(tags));
});

const defaultAgeGroup = computed(() => {
    return defaultAgeGroups.value.find(g => g.id === patchedGroup.value.defaultAgeGroupId);
});

const name = computed({
    get: () => patchedGroup.value.settings.name,
    set: (name) => {
        addGroupPatch({
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
        if (patchedGroup.value.status !== GroupStatus.Open) {
            return GroupStatus.Closed;
        }

        if (useRegistrationStartDate.value) {
            if (registrationStartDate.value !== groupBeforePatch.value.settings.registrationStartDate || (registrationStartDate.value && registrationStartDate.value > new Date())) {
                return 'RegistrationStartDate' as const;
            }
        }

        if (patchedGroup.value.status !== groupBeforePatch.value.status) {
            return patchedGroup.value.status;
        }

        if (patchedGroup.value.closed && groupBeforePatch.value.closed) {
            return GroupStatus.Closed;
        }

        return GroupStatus.Open;
    },
    set: (val) => {
        if (val === 'RegistrationStartDate') {
            addGroupPatch({
                status: GroupStatus.Open,
            });
            useRegistrationStartDate.value = true;

            if (patchedGroup.value.settings.registrationEndDate && patchedGroup.value.settings.registrationEndDate.getTime() <= Date.now()) {
                addGroupPatch({
                    settings: GroupSettings.patch({
                        registrationEndDate: null,
                    }),
                });
            }
            return;
        }

        if (val === GroupStatus.Open) {
            addGroupPatch({
                status: GroupStatus.Open,
            });
            useRegistrationStartDate.value = false;

            if (patchedGroup.value.settings.registrationEndDate && patchedGroup.value.settings.registrationEndDate.getTime() <= Date.now()) {
                addGroupPatch({
                    settings: GroupSettings.patch({
                        registrationEndDate: null,
                    }),
                });
            }
            return;
        }

        if (val === GroupStatus.Closed) {
            addGroupPatch({
                status: GroupStatus.Closed,
            });
        }
    },
});

const description = computed({
    get: () => patchedGroup.value.settings.description,
    set: description => addGroupPatch({
        settings: GroupSettings.patch({
            description,
        }),
    }),
});

const minAge = computed({
    get: () => patchedGroup.value.settings.minAge,
    set: minAge => addGroupPatch({
        settings: GroupSettings.patch({
            minAge,
        }),
    }),
});

const maxAge = computed({
    get: () => patchedGroup.value.settings.maxAge,
    set: maxAge => addGroupPatch({
        settings: GroupSettings.patch({
            maxAge,
        }),
    }),
});

const genderType = computed({
    get: () => patchedGroup.value.settings.genderType,
    set: genderType => addGroupPatch({
        settings: GroupSettings.patch({
            genderType,
        }),
    }),
});

const startDate = computed({
    get: () => patchedGroup.value.settings.startDate,
    set: startDate => addGroupPatch({
        settings: GroupSettings.patch({
            startDate,
        }),
    }),
});

const requireGroupIds = computed({
    get: () => patchedGroup.value.settings.requireGroupIds,
    set: requireGroupIds => addGroupPatch({
        settings: GroupSettings.patch({
            requireGroupIds: requireGroupIds as any,
        }),
    }),
});

const showAllowRegistrationsByOrganization = computed(() => props.isMultiOrganization || allowRegistrationsByOrganization.value);

const allowRegistrationsByOrganization = computed({
    get: () => patchedGroup.value.settings.allowRegistrationsByOrganization,
    set: allowRegistrationsByOrganization => addGroupPatch({
        settings: GroupSettings.patch({
            allowRegistrationsByOrganization,
        }),
    }),
});

const type = computed(() => patchedGroup.value.type);

const defaultAgeGroupId = computed({
    get: () => patchedGroup.value.defaultAgeGroupId,
    set: (defaultAgeGroupId) => {
        addGroupPatch({
            defaultAgeGroupId,
        });
        didSetAutomaticGroup.value = false;
    },
});

const waitingListType = computed({
    get: () => patchedGroup.value.settings.waitingListType,
    set: (waitingListType) => {
        addGroupPatch({
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
    get: () => patchedGroup.value.settings.maxMembers,
    set: maxMembers => addGroupPatch({
        settings: GroupSettings.patch({
            maxMembers,
        }),
    }),
});

const showEnableMaxMembers = computed(() => enableMaxMembers.value || type.value !== GroupType.WaitingList);

const enableMaxMembers = computed({
    get: () => patchedGroup.value.settings.maxMembers !== null,
    set: (enableMaxMembers) => {
        if (!enableMaxMembers) {
            addGroupPatch({
                settings: GroupSettings.patch({
                    maxMembers: null,
                }),
            });
        }
        else {
            addGroupPatch({
                settings: GroupSettings.patch({
                    maxMembers: patchedGroup.value.settings.maxMembers ?? 200,
                }),
            });
        }
    },
});

const requirePlatformMembershipOnRegistrationDate = computed({
    get: () => patchedGroup.value.settings.requirePlatformMembershipOnRegistrationDate === true,
    set: (value: boolean) => {
        addGroupPatch({
            settings: GroupSettings.patch({
                requirePlatformMembershipOnRegistrationDate: value,
            }),
        });
    },
});

const registrationStartDate = computed({
    get: () => patchedGroup.value.settings.registrationStartDate,
    set: registrationStartDate => addGroupPatch({
        settings: GroupSettings.patch({
            registrationStartDate,
        }),
    }),
});

const registrationEndDate = computed({
    get: () => patchedGroup.value.settings.registrationEndDate,
    set: registrationEndDate => addGroupPatch({
        settings: GroupSettings.patch({
            registrationEndDate,
        }),
    }),
});

const preRegistrationsDate = computed({
    get: () => patchedGroup.value.settings.preRegistrationsDate,
    set: preRegistrationsDate => addGroupPatch({
        settings: GroupSettings.patch({
            preRegistrationsDate,
        }),
    }),
});

const priorityForFamily = computed({
    get: () => patchedGroup.value.settings.priorityForFamily,
    set: priorityForFamily => addGroupPatch({
        settings: GroupSettings.patch({
            priorityForFamily,
        }),
    }),
});

const waitingList = computed({
    get: () => {
        if (patchedGroup.value.waitingList === null) {
            return null;
        }
        return patched.value.waitingLists.find(w => w.id === patchedGroup.value.waitingList!.id) ?? patchedGroup.value.waitingList;
    },
    set: waitingList => addGroupPatch({
        waitingList,
    }),
});

const trialDays = computed({
    get: () => patchedGroup.value.settings.trialDays,
    set: trialDays => addGroupPatch({
        settings: GroupSettings.patch({
            trialDays,
        }),
    }),
});

const useRegistrationStartDate = computed({
    get: () => !!patchedGroup.value.settings.registrationStartDate,
    set: (useRegistrationStartDate) => {
        if (!useRegistrationStartDate) {
            addGroupPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: null,
                }),
            });
        }
        else {
            addGroupPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: patchedGroup.value.settings.registrationStartDate && patchedGroup.value.settings.registrationStartDate > new Date() ? patchedGroup.value.settings.registrationStartDate : new Date(Date.now() + 1000 * 60 * 60 * 24),
                }),
            });
        }
    },
});

const useRegistrationEndDate = computed({
    get: () => !!patchedGroup.value.settings.registrationEndDate,
    set: (useRegistrationEndDate) => {
        if (!useRegistrationEndDate) {
            addGroupPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: null,
                }),
            });
        }
        else {
            addGroupPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: patchedGroup.value.settings.registrationEndDate ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                }),
            });
        }
    },
});

const title = computed(() => {
    if (patchedGroup.value.type === GroupType.WaitingList) {
        return props.isNew ? $t('5936be80-5f7a-429b-8bc2-7afdd47ff232') : $t('b3f49e49-2db8-46e3-8a9b-bc05a4b989c0');
    }

    if (patchedGroup.value.type === GroupType.EventRegistration) {
        return props.isNew ? $t('bd6ad13b-be70-4d03-a1a0-3578786f4df3') : $t('8fd3a74f-5dae-4a7e-bcd3-7ac1da2e7e6c');
    }
    return props.isNew ? $t('c7944f69-c772-4cc5-b7c8-2ef96272dfe0') : $t('d886e927-86d1-48ed-93ed-60e924484db1');
});

const defaultMembershipTypeId = computed(() => defaultAgeGroup.value?.defaultMembershipTypeId ?? null);

const defaultMembership = computed(() => {
    return platform.value.config.membershipTypes.find(t => t.id === defaultMembershipTypeId.value);
});
const defaultMembershipConfig = computed(() => {
    return defaultMembership.value?.periods.get(patchedGroup.value.periodId);
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
            Toast.success($t('1e6b16bd-ca6e-49e2-9792-f8864a140d7b')).show();
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
    if (!await CenteredMessage.confirm(patchedGroup.value.type === GroupType.EventRegistration ? $t('90ec517b-14e6-4436-8c91-fabac5c1bddf') : $t('11426f89-b2bf-4f7a-bd5a-a51c34e6aa96'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            Toast.success($t('eb66ea67-3c37-40f2-8572-9589d71ffab6')).show();
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

async function addGroupPrice() {
    const isValid = await errors.validator.validateByKey('price');

    if (isValid) {
        const price = GroupPrice.create({
            name: $t('9b0aebaf-d119-49df-955b-eb57654529e5'),
            price: patchedGroup.value.settings.prices[0]?.price?.clone(),
        });

        await present({
            components: [
                new ComponentWithProperties(GroupPriceView, {
                    price,
                    group: patchedGroup,
                    isNew: true,
                    defaultMembershipTypeId,
                    showNameAlways: true,
                    saveHandler: async (patch: AutoEncoderPatchType<GroupPrice>) => {
                        addPricePut(price.patch(patch));
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }
}

async function editGroupPrice(price: GroupPrice) {
    await present({
        components: [
            new ComponentWithProperties(GroupPriceView, {
                price,
                group: patchedGroup,
                isNew: false,
                defaultMembershipTypeId,
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
                group: patchedGroup,
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
        organizationId: patchedGroup.value.organizationId,
        periodId: patchedGroup.value.periodId,
        type: GroupType.WaitingList,
        settings: GroupSettings.create({
            name: 'Wachtlijst van ' + patchedGroup.value.settings.name,
        }),
    });

    const groups: PatchableArrayAutoEncoder<Group> = new PatchableArray();
    groups.addPut(waitingList);
    const basePatch = OrganizationRegistrationPeriod.patch({ groups });

    // Edit the group
    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                period: patched.value.patch(basePatch),
                groupId: waitingList.id,
                isNew: true,
                showToasts: false,
                organizationHint: externalOrganization.value,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(basePatch.patch(patch));
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function isPropertyEnabled(name: MemberProperty) {
    return !!OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patchedGroup.value,
        includeGroup: true,
    })[name];
}

async function editWaitingList(waitingList: Group) {
    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                period: patched.value,
                groupId: waitingList.id,
                isNew: false,
                showToasts: false,
                organizationHint: externalOrganization.value,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(patch);
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

const getRegisterItemFilterBuilders = useRegisterItemFilterBuilders();

const family = new PlatformFamily({
    platform: Platform.shared,
    contextOrganization: organization.value,
});

const recordEditorSettings = computed(() => {
    const exampleMember = new PlatformMember({
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
    });

    return new RecordEditorSettings({
        type: RecordEditorType.Registration,
        dataPermission: false,
        toggleDefaultEnabled: false,
        filterBuilder: (recordCategories: RecordCategory[]) => {
            return getRegisterItemFilterBuilders(patchedGroup.value.patch({
                settings: GroupSettings.patch({
                    recordCategories: recordCategories as any,
                }),
            }))[0];
        },
        exampleValue: RegisterItem.defaultFor(exampleMember, patchedGroup.value, externalOrganization.value ?? Organization.create({
            id: patchedGroup.value.organizationId,
        })),
    });
});

defineExpose({
    shouldNavigateAway,
});

</script>
