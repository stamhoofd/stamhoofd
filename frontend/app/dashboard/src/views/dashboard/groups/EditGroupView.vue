<template>
    <div class="st-view group-edit-view">
        <STNavigationBar :title="isNew ? 'Nieuwe groep toevoegen' : name+' bewerken'">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <template slot="right">
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button v-if="!canPop" class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Nieuwe groep toevoegen
            </h1>
            <h1 v-else>
                {{ name }} bewerken
            </h1>
            <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />

            <template v-if="tab == 'general'">
                <STErrorsDefault :error-box="errorBox" />

                <STInputBox title="Naam" error-fields="settings.name" :error-box="errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="Naam van deze groep"
                        autocomplete=""
                    >
                </STInputBox>

                <STInputBox title="Beschrijving" error-fields="settings.description" :error-box="errorBox" class="max">
                    <textarea
                        v-model="description"
                        class="input"
                        type="text"
                        placeholder="Zichtbaar voor leden tijdens het inschrijven"
                        autocomplete=""
                    />
                </STInputBox>

                <div class="split-inputs">
                    <STInputBox title="Startdatum" error-fields="settings.startDate" :error-box="errorBox">
                        <DateSelection v-model="startDate" />
                    </STInputBox>
                    <TimeInput v-if="displayStartEndTime" v-model="startDate" title="Vanaf welk tijdstip" :validator="validator" /> 
                </div>
                

                <div class="split-inputs">
                    <STInputBox title="Einddatum" error-fields="settings.endDate" :error-box="errorBox">
                        <DateSelection v-model="endDate" />
                    </STInputBox>
                    <TimeInput v-if="displayStartEndTime" v-model="endDate" title="Tot welk tijdstip" :validator="validator" />
                </div>
                <p class="st-list-description">
                    De start- en einddatum is zichtbaar bij het inschrijven. Let op: dit is niet de datum waarop de inschrijvingen starten en eindigen, dat staat hieronder.
                </p>

                <Checkbox v-model="displayStartEndTime">
                    Start- en eindtijdstip toevoegen
                </Checkbox>

                <STInputBox title="Locatie (optioneel)" error-fields="settings.location" :error-box="errorBox">
                    <input
                        v-model="location"
                        class="input"
                        type="text"
                        placeholder="Optioneel"
                        autocomplete=""
                    >
                </STInputBox>

                <hr>
                <h2>Inschrijven</h2>

                <div class="split-inputs">
                    <STInputBox title="Inschrijven start op" error-fields="settings.registrationStartDate" :error-box="errorBox">
                        <DateSelection v-model="registrationStartDate" />
                    </STInputBox>
                    <TimeInput v-model="registrationStartDate" title="Vanaf" :validator="validator" /> 
                </div>
                

                <div class="split-inputs">
                    <STInputBox title="Inschrijven sluit op" error-fields="settings.registrationEndDate" :error-box="errorBox">
                        <DateSelection v-model="registrationEndDate" />
                    </STInputBox>
                    <TimeInput v-model="registrationEndDate" title="Tot welk tijdstip" :validator="validator" />
                </div>
                <p class="st-list-description">
                    Als de inschrijvingen het hele jaar doorlopen, vul dan hier gewoon een datum in ergens op het einde van het jaar. Let op het jaartal.
                </p>
      
                <div class="split-inputs">
                    <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="settings.minAge" :error-box="errorBox">
                        <AgeInput v-model="minAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>

                    <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="settings.maxAge" :error-box="errorBox">
                        <AgeInput v-model="maxAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>
                </div>
                <p class="st-list-description">
                    *De leeftijd van het lid op 31/12/{{ startYear }} (jaar startdatum). Ter referentie: leden uit het eerste leerjaar zijn 6 jaar op 31 december. Leden uit het eerste secundair zijn 12 jaar op 31 december.
                </p>

                <STInputBox title="Jongens en meisjes" error-fields="genderType" :error-box="errorBox" class="max">
                    <RadioGroup>
                        <Radio v-for="_genderType in genderTypes" :key="_genderType.value" v-model="genderType" :value="_genderType.value">
                            {{ _genderType.name }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <hr>
                <h2>Maximum aantal leden</h2>

                <Checkbox v-model="enableMaxMembers">
                    Limiteer maximum aantal ingeschreven leden
                </Checkbox>

                <Checkbox v-if="enableMaxMembers" v-model="waitingListIfFull">
                    Wachtlijst als maximum is bereikt
                </Checkbox>

                <STInputBox v-if="enableMaxMembers" title="Maximaal aantal ingeschreven leden">
                    <Slider v-model="maxMembers" :max="200" />
                </STInputBox>

                <p v-if="enableMaxMembers" class="style-description-small">
                    Bij online betalingen wordt de plaats maximaal 30 minuten vrijgehouden als mensen op de betaalpagina zijn. Normaal kan de betaling daarna niet meer doorkomen. Door een trage verwerking van de bank of een storing bij de bank kan het zijn dat het langer dan 30 minuten duurt voor we een betaalbevestiging krijgen van de bank, dan kunnen we de betaling niet meer weigeren (beperking van bank). Het kan dus zijn dat in die uitzonderlijke situaties, het maximum aantal overschreven wordt. Je kan daarna eventueel zelf overgaan tot terugbetalen en uitschrijven. 
                </p>


                <hr>
                <h2>Wachtlijst en voorinschrijvingen</h2>

                <STInputBox error-fields="waitingListType" :error-box="errorBox" class="max">
                    <RadioGroup class="column">
                        <Radio v-model="waitingListType" value="None">
                            Geen speciale regeling
                        </Radio>
                        <Radio v-model="waitingListType" value="ExistingMembersFirst">
                            Alle nieuwe leden op wachtlijst<span class="radio-description">Bestaande leden kunnen meteen inschrijven (tot het maximum). De rest komt op de wachtlijst.</span>
                        </Radio>
                        <Radio v-model="waitingListType" value="PreRegistrations">
                            Voorinschrijvingen gebruiken <span class="radio-description">Bestaande leden kunnen al vroeger beginnen met inschrijven.</span>
                        </Radio>
                        <Radio v-model="waitingListType" value="All">
                            Iedereen op wachtlijst <span class="radio-description">Iedereen moet manueel worden goedgekeurd.</span>
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <div v-if="waitingListType == 'PreRegistrations'" class="split-inputs">
                    <STInputBox title="Begindatum voorinschrijvingen" error-fields="settings.preRegistrationsDate" :error-box="errorBox">
                        <DateSelection v-model="preRegistrationsDate" />
                    </STInputBox>
                    
                    <TimeInput v-model="preRegistrationsDate" title="Vanaf" :validator="validator" /> 
                </div>
                
                <Checkbox v-if="waitingListType == 'PreRegistrations' || waitingListType == 'ExistingMembersFirst'" v-model="priorityForFamily">
                    Naast bestaande leden ook voorrang geven aan broers/zussen
                </Checkbox>

                <p v-if="waitingListType == 'PreRegistrations' || waitingListType == 'ExistingMembersFirst'" class="info-box">
                    Leden worden als bestaand beschouwd als ze ingeschreven zijn voor een vorige inschrijvingsperiode van gelijk welke inschrijvingsgroep. Let er dus op dat die leden ook in Stamhoofd zijn ingeladen. Je kan leden van vorig jaar importeren via Excel en bij de importeer-instellingen aanduiden dat het gaat om leden van vorig jaar. Leden moeten wel inloggen met een e-mailadres dat verbonden is met een bestaand account. Daarom verstuur je best een e-mail naar alle leden met de magische knop waarmee ze automatisch met het juiste account inloggen (of registreren).
                </p>

                <template v-if="useActivities || patchedGroup.settings.requireGroupIds.length > 0">
                    <hr>
                    <h2 class="style-with-button">
                        <div>Verplicht ingeschreven bij...</div>
                        <div>
                            <button v-if="patchedGroup.settings.requireGroupIds.length == 0" class="button text" @click="editRequireGroups">
                                <span class="icon add" />
                                <span>Toevoegen</span>
                            </button>
                            <button v-else class="button text" @click="editRequireGroups">
                                <span class="icon edit" />
                                <span>Wijzigen</span>
                            </button>
                        </div>
                    </h2>
                    <p>Geef leden enkel toegang om in te schrijven als ze al ingeschreven zijn voor één van de volgende inschrijvingsgroepen. Laat leeg als je ook nieuwe leden wil laten inschrijven.</p>

                    <STList v-if="patchedGroup.settings.requireGroupIds.length > 0">
                        <STListItem v-for="id of patchedGroup.settings.requireGroupIds" :key="id">
                            {{ getGroupName(id) }}

                            <button slot="right" class="button text" @click="removeRequireGroupId(id)">
                                <span class="icon trash" />
                                <span>Verwijderen</span>
                            </button>
                        </STListItem>
                    </STList>
                    <p v-else class="info-box">
                        Geen verplichte andere inschrijvingen
                    </p>
                </template>

                <template v-if="useActivities || patchedGroup.settings.requirePreviousGroupIds.length > 0">
                    <hr>
                    <h2 class="style-with-button">
                        <div>Verplicht vorige inschrijvingsperiode ingeschreven bij...</div>
                        <div>
                            <button v-if="patchedGroup.settings.requirePreviousGroupIds.length == 0" class="button text" @click="editRequirePreviousGroups">
                                <span class="icon add" />
                                <span>Toevoegen</span>
                            </button>
                            <button v-else class="button text" @click="editRequirePreviousGroups">
                                <span class="icon edit" />
                                <span>Wijzigen</span>
                            </button>
                        </div>
                    </h2>
                    <p>Leden kunnen enkel zelf inschrijven voor deze inschrijvingsgroep als ze de vorige inschrijvingsperiode ingeschreven waren voor één van de volgende inschrijvingsgroepen.</p>

                    <STList v-if="patchedGroup.settings.requirePreviousGroupIds.length > 0">
                        <STListItem v-for="id of patchedGroup.settings.requirePreviousGroupIds" :key="id">
                            {{ getGroupName(id) }}

                            <button slot="right" class="button text" @click="removeRequirePreviousGroupId(id)">
                                <span class="icon trash" />
                                <span>Verwijderen</span>
                            </button>
                        </STListItem>
                    </STList>
                    <p v-else class="info-box">
                        Geen verplichte vorige inschrijvingen noodzakelijk
                    </p>
                </template>

                <template v-if="useActivities || patchedGroup.settings.preventPreviousGroupIds.length > 0">
                    <hr>
                    <h2 class="style-with-button">
                        <div>Verhinder inschrijven als vorige keer ingeschreven bij...</div>
                        <div>
                            <button v-if="patchedGroup.settings.preventPreviousGroupIds.length == 0" class="button text" @click="editPreventPreviousGroups">
                                <span class="icon add" />
                                <span>Toevoegen</span>
                            </button>
                            <button v-else class="button text" @click="editPreventPreviousGroups">
                                <span class="icon edit" />
                                <span>Wijzigen</span>
                            </button>
                        </div>
                    </h2>
                    <p>Leden kunnen niet inschrijven voor deze inschrijvingsgroep als ze de vorige inschrijvingsperiode ingeschreven waren voor één van de volgende inschrijvingsgroepen.</p>

                    <STList v-if="patchedGroup.settings.preventPreviousGroupIds.length > 0">
                        <STListItem v-for="id of patchedGroup.settings.preventPreviousGroupIds" :key="id">
                            {{ getGroupName(id) }}

                            <button slot="right" class="button text" @click="removePreventPreviousGroupId(id)">
                                <span class="icon trash" />
                                <span>Verwijderen</span>
                            </button>
                        </STListItem>
                    </STList>
                    <p v-else class="info-box">
                        Geen vorige inschrijvingsgroepen die uitgesloten worden
                    </p>
                </template>

                <hr>
                <h2 class="style-with-button">
                    <div>Omslagfoto</div>
                    <div>
                        <button v-if="coverPhoto" class="button text" @click="coverPhoto = null">
                            <span class="icon trash" />
                            <span>Verwijderen</span>
                        </button>
                        <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Foto uploaden'" :resolutions="hs" />
                    </div>
                </h2>

                <p>Deze foto wordt getoond met een grootte van 1800 x 750 pixels, bovenaan de informatiepagina van deze groep.</p>

                <figure v-if="coverPhotoSrc" class="cover-photo">
                    <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
                </figure>

                <hr>
                <h2 class="style-with-button">
                    <div>Vierkante foto</div>
                    <div>
                        <button v-if="squarePhoto" class="button text" @click="squarePhoto = null">
                            <span class="icon trash" />
                            <span>Verwijderen</span>
                        </button>
                        <UploadButton v-model="squarePhoto" :text="squarePhoto ? 'Vervangen' : 'Foto uploaden'" :resolutions="hsSquare" />
                    </div>
                </h2>

                <p>Deze foto wordt getoond in het overzicht bij de keuze tussen alle groepen. Upload bij voorkeur een foto groter dan 200 x 200 pixels. Als je deze niet uploadt gebruiken we gewoon de omslagfoto (als die er is). Je hoeft dus niet dezelfde foto nog eens te uploaden.</p>

                <figure v-if="squarePhotoSrc" class="square-photo">
                    <img :src="squarePhotoSrc">
                </figure>
            </template>
            <template v-if="tab == 'payments'">
                <STErrorsDefault :error-box="errorBox" />
                <EditGroupPriceBox :validator="validator" :prices="getPrices()" :group="patchedGroup" :patched-organization="patchedOrganization" @patch="addPricesPatch" />
            </template>

            <template v-if="tab == 'permissions'">
                <h2>Toegangsbeheer</h2>
                <p>Kies welke beheerdersgroepen toegang hebben tot deze inschrijvingsgroep. Vraag aan de hoofdbeheerders om nieuwe beheerdersgroepen aan te maken indien nodig. Hoofdbeheerders hebben altijd toegang tot alle groepen. Enkel beheerders met 'volledige toegang' kunnen instellingen wijzigen van de inschrijvingsgroep.</p>
                <STErrorsDefault :error-box="errorBox" />

                <STList v-if="roles.length > 0">
                    <GroupPermissionRow v-for="role in roles" :key="role.id" :role="role" :show-role="true" :organization="patchedOrganization" :group="patchedGroup" @patch="addOrganizationPatch" />
                </STList>

                <p v-else class="info-box">
                    Er zijn nog geen beheerdersgroepen aangemaakt in deze vereniging. Enkel hoofdbeheerders kunnen deze groep voorlopig bekijken en bewerken. Je kan beheerdersgroepen aanmaken bij instellingen > beheerders.
                </p>
            </template>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AgeInput, BackButton,CenteredMessage, Checkbox, DateSelection, ErrorBox, FemaleIcon, LoadingButton, MaleIcon, PriceInput, Radio, RadioGroup, SegmentedControl, Slider, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, TimeInput, Toast, UploadButton, Validator } from "@stamhoofd/components";
import { GroupCategory, GroupPrivateSettings, OrganizationMetaData, PermissionLevel, PermissionRole, PermissionsByRole, RecordType, ResolutionFit, ResolutionRequest, Version } from '@stamhoofd/structures';
import { Group, GroupGenderType, GroupPrices, GroupSettings, Image, Organization, OrganizationRecordsConfiguration, WaitingListType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import GroupPermissionRow from "../admins/GroupPermissionRow.vue"
import EditGroupPriceBox from "./EditGroupPriceBox.vue"
import SelectGroupsView from './SelectGroupsView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        MaleIcon,
        FemaleIcon,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        AgeInput,
        Slider,
        LoadingButton,
        TimeInput,
        EditGroupPriceBox,
        BackButton,
        STList,
        GroupPermissionRow,
        UploadButton,
        STListItem
    },
})
export default class EditGroupView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    tabs = ["general", "payments", "permissions"];
    tab = this.tabs[0];
    tabLabels = ["Algemeen", "Prijs", "Toegang"];

    saving = false

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<Organization>) => Promise<void>);

    @Prop({ required: true })
    group: Group

    @Prop({ required: true })
    organization: Organization
    
    patchOrganization: AutoEncoderPatchType<Organization> = Organization.patch({})

    mounted() {
        // Auto assign roles
        if (this.isNew && OrganizationManager.user.permissions && this.group.privateSettings!.permissions.getPermissionLevel(OrganizationManager.user.permissions) !== PermissionLevel.Full) {
            const categories = this.patchedOrganization.meta.categories.filter(c => c.groupIds.includes(this.group.id))
            for (const cat of categories) {
                // Get all roles that have create permissions in the categories that this group will get added into
                const roles = cat.settings.permissions.create.flatMap(r => {
                    const role = OrganizationManager.organization.privateMeta?.roles.find(i => i.id === r.id)
                    const has = OrganizationManager.user.permissions?.roles.find(i => i.id === r.id)
                    if (role && has) {
                        return [PermissionRole.create(role)]
                    }
                    return []
                })

                if (roles.length > 0) {
                    const permissions = PermissionsByRole.patch({})
                    for (const role of roles) {
                        permissions.full.addPut(role)
                    }
                    this.addPrivateSettingsPatch(GroupPrivateSettings.patch({
                        permissions
                    }))
                }
                
            }
        }
    }

    get isNew() {
        return !OrganizationManager.organization.groups.find(g => g.id === this.group.id)
    }

    get useActivities() {
        return this.patchedOrganization.meta.modules.useActivities
    }

    get patchedOrganization() {
        return this.organization.patch(this.patchOrganization)
    }

    get patchedGroup() {
        const c = this.patchedOrganization.groups.find(c => c.id == this.group.id)
        if (c) {
            return c
        }
        return this.group
    }

    get roles() {
        return this.patchedOrganization.privateMeta?.roles ?? []
    }

    getGroupName(id: string) {
        const group = this.patchedOrganization.groups.find(g => g.id === id)
        if (!group) {
            // Search deleted groups (in non patched one)
            const deleted = OrganizationManager.organization.groups.find(g => g.id === id)
            if (deleted) {
                return deleted.settings.name +" (verwijderd)"
            }
            return "Verwijderde inschrijvingsgroep (verwijder dit best)"
        }
        return group.settings.name
    }
 
    editRequireGroups() {
        this.present(new ComponentWithProperties(SelectGroupsView, {
            initialGroupIds: this.patchedGroup.settings.requireGroupIds,
            callback: (groupIds: string[]) => {
                const diff = GroupSettings.patch({})
                for (const id of groupIds) {
                    if (!this.patchedGroup.settings.requireGroupIds.includes(id)) {
                        diff.requireGroupIds.addPut(id)
                    }
                }

                for (const id of this.patchedGroup.settings.requireGroupIds) {
                    if (!groupIds.includes(id)) {
                        diff.requireGroupIds.addDelete(id)
                    }
                }
                this.addSettingsPatch(diff)
                return Promise.resolve()
            }
        }).setDisplayStyle("popup"))
    }

    removeRequireGroupId(id: string) {
        const diff = GroupSettings.patch({})
        diff.requireGroupIds.addDelete(id)
        this.addSettingsPatch(diff)
    }

    editRequirePreviousGroups() {
        this.present(new ComponentWithProperties(SelectGroupsView, {
            initialGroupIds: this.patchedGroup.settings.requirePreviousGroupIds,
            callback: (groupIds: string[]) => {
                const diff = GroupSettings.patch({})
                for (const id of groupIds) {
                    if (!this.patchedGroup.settings.requirePreviousGroupIds.includes(id)) {
                        diff.requirePreviousGroupIds.addPut(id)
                    }
                }

                for (const id of this.patchedGroup.settings.requirePreviousGroupIds) {
                    if (!groupIds.includes(id)) {
                        diff.requirePreviousGroupIds.addDelete(id)
                    }
                }
                this.addSettingsPatch(diff)
                return Promise.resolve()
            }
        }).setDisplayStyle("popup"))
    }

    removeRequirePreviousGroupId(id: string) {
        const diff = GroupSettings.patch({})
        diff.requirePreviousGroupIds.addDelete(id)
        this.addSettingsPatch(diff)
    }

    editPreventPreviousGroups() {
        this.present(new ComponentWithProperties(SelectGroupsView, {
            initialGroupIds: this.patchedGroup.settings.preventPreviousGroupIds,
            callback: (groupIds: string[]) => {
                const diff = GroupSettings.patch({})
                for (const id of groupIds) {
                    if (!this.patchedGroup.settings.preventPreviousGroupIds.includes(id)) {
                        diff.preventPreviousGroupIds.addPut(id)
                    }
                }

                for (const id of this.patchedGroup.settings.preventPreviousGroupIds) {
                    if (!groupIds.includes(id)) {
                        diff.preventPreviousGroupIds.addDelete(id)
                    }
                }
                this.addSettingsPatch(diff)
                return Promise.resolve()
            }
        }).setDisplayStyle("popup"))
    }

    removePreventPreviousGroupId(id: string) {
        const diff = GroupSettings.patch({})
        diff.preventPreviousGroupIds.addDelete(id)
        this.addSettingsPatch(diff)
    }

    addOrganizationPatch(patch: AutoEncoderPatchType<Organization> ) {
        if (this.saving) {
            return
        }
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    addPatch(patch: AutoEncoderPatchType<Group> ) {
        if (this.saving) {
            return
        }
        this.patchOrganization.groups.addPatch(patch)
    }

    getPrices() {
        return this.patchedGroup.settings.prices
    }

    addPricesPatch(patch: PatchableArrayAutoEncoder<GroupPrices>) {
        this.addSettingsPatch({ prices: patch })
    }

    addSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupSettings>> ) {
        this.addPatch(Group.patch({ 
            id: this.group.id, 
            settings: GroupSettings.patch(patch)
        }))
    }

    addPrivateSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupPrivateSettings>> ) {
        this.addPatch(Group.patch({ 
            id: this.group.id, 
            privateSettings: GroupPrivateSettings.patch(patch)
        }))
    }

    get name() {
        return this.patchedGroup.settings.name
    }

    set name(name: string) {
        this.addSettingsPatch({ name })
    }

    get location() {
        return this.patchedGroup.settings.location
    }

    set location(location: string) {
        this.addSettingsPatch({ location })
    }

    get displayStartEndTime() {
        return this.patchedGroup.settings.displayStartEndTime
    }

    set displayStartEndTime(displayStartEndTime: boolean) {
        this.addSettingsPatch({ displayStartEndTime })

        if (!displayStartEndTime) {
            // Change dates
            const start = new Date(this.startDate)
            start.setHours(0, 0, 0, 0)
            this.startDate = start

            const end = new Date(this.endDate)
            end.setHours(23, 59, 59, 0)
            this.endDate = end
        }
    }

    get description() {
        return this.patchedGroup.settings.description
    }

    set description(description: string) {
        this.addSettingsPatch({ description })
    }

    get startDate() {
        return this.patchedGroup.settings.startDate
    }

    set startDate(startDate: Date) {
        this.addSettingsPatch({ startDate })
    }

     get endDate() {
        return this.patchedGroup.settings.endDate
    }

    set endDate(endDate: Date) {
        this.addSettingsPatch({ endDate })
    }

    get startYear() {
        return this.startDate.getFullYear()
    }

    get registrationStartDate() {
        return this.patchedGroup.settings.registrationStartDate
    }

    set registrationStartDate(registrationStartDate: Date) {
        this.addSettingsPatch({ registrationStartDate })
    }

    get registrationEndDate() {
        return this.patchedGroup.settings.registrationEndDate
    }

    set registrationEndDate(registrationEndDate: Date) {
        this.addSettingsPatch({ registrationEndDate })
    }

    get genderType() {
        return this.patchedGroup.settings.genderType
    }

    set genderType(genderType: GroupGenderType) {
        this.addSettingsPatch({ genderType })
    }

    // Birth years
    get minAge() {
        return this.patchedGroup.settings.minAge
    }

    set minAge(minAge: number | null) {
        this.addSettingsPatch({ minAge })
    }

    get maxAge() {
        return this.patchedGroup.settings.maxAge
    }
    
    set maxAge(maxAge: number | null) {
        this.addSettingsPatch({ maxAge })
    }

    get genderTypes() {
        return [
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
    }

    // Waiting list

    get waitingListType() {
        return this.patchedGroup.settings.waitingListType
    }

    set waitingListType(waitingListType: WaitingListType) {
        this.addSettingsPatch({ waitingListType })

        if (waitingListType === WaitingListType.PreRegistrations && this.preRegistrationsDate === null) {
            const d = new Date(this.startDate)
            d.setMonth(d.getMonth() - 1)
            this.preRegistrationsDate = d
        }
    }

    get preRegistrationsDate() {
        return this.patchedGroup.settings.preRegistrationsDate
    }

    set preRegistrationsDate(preRegistrationsDate: Date | null) {
        this.addSettingsPatch({ preRegistrationsDate })
    }

    get waitingListIfFull() {
        return this.patchedGroup.settings.waitingListIfFull
    }

    set waitingListIfFull(waitingListIfFull: boolean) {
        this.addSettingsPatch({ waitingListIfFull })
    }

    get enableMaxMembers() {
        return this.maxMembers !== null
    }

    set enableMaxMembers(enableMaxMembers: boolean) {
        if (enableMaxMembers === this.enableMaxMembers) {
            return
        }
        if (enableMaxMembers) {
            this.maxMembers = 200
        } else {
            this.maxMembers = null
        }
    }

    get maxMembers() {
        return this.patchedGroup.settings.maxMembers
    }

    set maxMembers(maxMembers: number | null) {
        this.addSettingsPatch({ maxMembers })
    }

    get priorityForFamily() {
        return this.patchedGroup.settings.priorityForFamily
    }

    set priorityForFamily(priorityForFamily: boolean) {
        this.addSettingsPatch({ priorityForFamily })
    }

    // Saving

    async save() {
        if (this.saving) {
            return
        }

        const valid = await this.validator.validate()

        if (!valid) {
            return;
        }
        this.saving = true

        let patch = this.patchOrganization

        // Check if reduced price is enabled
        if (!this.patchedOrganization.meta.recordsConfiguration.shouldAsk(RecordType.FinancialProblems) && !!this.patchedGroup.settings.prices.find(g => !!g.prices.find(gg => gg.reducedPrice !== null))) {
            console.log("Auto enabled financial problems record")

            const p = OrganizationRecordsConfiguration.patch({});
            p.enabledRecords.addPut(RecordType.FinancialProblems)
            const patchOrganization = Organization.patch({
                meta:  OrganizationMetaData.patch({
                    recordsConfiguration: p
                })
            })

            patch = patch.patch(patchOrganization)

            new Toast("We vragen nu ook bij het inschrijven of een lid het financieel moeilijk heeft, zodat we de verminderde prijzen kunnen toepassen", "info-filled").show()
        }

        this.errorBox = null

        try {
            await this.saveHandler(patch)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async deleteMe() {
        if (this.saving) {
            return
        }

        if (!await CenteredMessage.confirm("Ben je zeker dat je deze inschrijvingsgroep wilt verwijderen?", "Verwijderen")) {
            return
        }
        
        // Find all parent categories and delete this group
        const parents = this.patchedGroup.getParentCategories(this.patchedOrganization.meta.categories, false)
        const metaPatch = OrganizationMetaData.patch({})
        for (const category of parents) {
            const gp = GroupCategory.patch({
                id: category.id,
            })
            gp.groupIds.addDelete(this.group.id)
            metaPatch.categories.addPatch(gp)
        }

        const p = Organization.patch({
            meta: metaPatch
        })

        // Delete the group from the organization
        p.groups.addDelete(this.group.id)

        this.errorBox = null
        this.saving = true

        try {
            await this.saveHandler(p)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false

        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchOrganization, this.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    // Cover picture
    get coverPhoto() {
        return this.patchedGroup.settings.coverPhoto
    }

    set coverPhoto(coverPhoto: Image | null) {
        this.addSettingsPatch(GroupSettings.patch({
            coverPhoto
        }))
    }

     get hs() {
        return [
            ResolutionRequest.create({
                width: 1600
            }),
            ResolutionRequest.create({
                width: 800
            }),
            ResolutionRequest.create({
                height: 250,
                width: 250,
                fit: ResolutionFit.Cover
            })
        ]
    }

    get coverPhotoResolution() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return image.getResolutionForSize(800, 200)
    }

    get coverPhotoSrc() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return this.coverPhotoResolution?.file.getPublicPath()
    }
    
    get coverImageWidth() {
        return this.coverPhotoResolution?.width
    }

    get coverImageHeight() {
        return this.coverPhotoResolution?.height
    }

     // Cover picture
    get squarePhoto() {
        return this.patchedGroup.settings.squarePhoto
    }

    set squarePhoto(squarePhoto: Image | null) {
        this.addSettingsPatch(GroupSettings.patch({
            squarePhoto
        }))
    }

     get hsSquare() {
        return [
            ResolutionRequest.create({
                height: 250,
                width: 250,
                fit: ResolutionFit.Cover
            })
        ]
    }

    get squarePhotoSrc() {
        const image = this.squarePhoto
        if (!image) {
            return null
        }
        return image.getResolutionForSize(250, 250).file.getPublicPath()
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-edit-view {
    .cover-photo {
        height: 0;
        position: relative;
        padding-bottom: 750/1800*100%;
        background: $color-gray;
        border-radius: $border-radius;
        margin-top: 20px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
            position: absolute;
            left: 0;
            top: 0;
        }
    }

    .square-photo {
        img {
            height: 200px;
            width: 200px;
            border-radius: $border-radius;
            object-fit: contain;
        }
    }

}
</style>
