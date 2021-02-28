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

                <hr>
                <h2>Inschrijven</h2>

                <div class="split-inputs">
                    <STInputBox title="Inschrijven start op" error-fields="settings.startDate" :error-box="errorBox">
                        <DateSelection v-model="startDate" />
                    </STInputBox>
                    <TimeInput v-model="startDate" title="Vanaf" :validator="validator" /> 
                </div>
                

                <div class="split-inputs">
                    <STInputBox title="Inschrijven sluit op" error-fields="settings.endDate" :error-box="errorBox">
                        <DateSelection v-model="endDate" />
                    </STInputBox>
                    <TimeInput v-model="endDate" title="Tot welk tijdstip" :validator="validator" />
                </div>
                <p class="st-list-description">
                    Als de inschrijvingen het hele jaar doorlopen, vul dan hier gewoon een datum in ergens op het einde van het jaar. Let op het jaartal.
                </p>
      
                <div class="split-inputs">
                    <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="settings.minAge" :error-box="errorBox">
                        <AgeInput v-model="minAge" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>

                    <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="settings.maxAge" :error-box="errorBox">
                        <AgeInput v-model="maxAge" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>
                </div>
                <p class="st-list-description">
                    *De leeftijd die het lid zal worden in het jaar waarin de inschrijvingen starten. Ter referentie: leden uit het eerste leerjaar worden 6 jaar in september. Leden uit het eerste secundair worden 12 jaar in september.
                </p>

                <STInputBox title="Jongens en meisjes" error-fields="genderType" :error-box="errorBox" class="max">
                    <RadioGroup>
                        <Radio v-for="_genderType in genderTypes" :key="_genderType.value" v-model="genderType" :value="_genderType.value">
                            {{ _genderType.name }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <hr>
                <h2>Wachtlijst</h2>
                <STInputBox error-fields="genderType" :error-box="errorBox" class="max">
                    <RadioGroup class="column">
                        <Radio v-model="waitingListType" value="None">
                            Geen wachtlijst
                        </Radio>
                        <Radio v-model="waitingListType" value="PreRegistrations">
                            Voorinschrijvingen <span class="radio-description">Bestaande leden kunnen al vroeger beginnen met inschrijven. Bij het openen van de inschrijvingen kan men blijven inschrijven tot het maximaal aantal leden bereikt is. Daarna sluiten de inschrijvingen.</span>
                        </Radio>
                        <Radio v-model="waitingListType" value="ExistingMembersFirst">
                            Alle nieuwe leden op wachtlijst<span class="radio-description">Bestaande leden kunnen meteen inschrijven. Van de nieuwe leden kies je zelf wie je doorlaat.</span>
                        </Radio>
                        <Radio v-model="waitingListType" value="All">
                            Iedereen op wachtlijst <span class="radio-description">Iedereen moet manueel worden goedgekeurd.</span>
                        </Radio>
                    </RadioGroup>
                </STInputBox>
               
                <STInputBox v-if="waitingListType != 'None'" title="Maximaal aantal ingeschreven leden">
                    <Slider v-model="maxMembers" :max="200" />
                </STInputBox>

                <div v-if="waitingListType == 'PreRegistrations'" class="split-inputs">
                    <STInputBox v-if="waitingListType == 'PreRegistrations'" title="Begindatum voorinschrijvingen" error-fields="settings.preRegistrationsDate" :error-box="errorBox">
                        <DateSelection v-model="preRegistrationsDate" />
                    </STInputBox>
                    
                    <TimeInput v-model="preRegistrationsDate" title="Vanaf" :validator="validator" /> 
                </div>
                <Checkbox v-if="waitingListType == 'PreRegistrations' || waitingListType == 'ExistingMembersFirst'" v-model="priorityForFamily">
                    Naast bestaande leden ook voorrang geven aan broers/zussen
                </Checkbox>
            </template>
            <template v-if="tab == 'payments'">
                <EditGroupPriceBox :validator="validator" :prices="getPrices()" @patch="addPricesPatch" />
                <STErrorsDefault :error-box="errorBox" />
            </template>

            <template v-if="tab == 'permissions'">
                <h2>Toegangsbeheer</h2>
                <p>Kies welke beheerdersgroepen toegang hebben tot deze inschrijvingsgroep. Vraag aan de hoofdbeheerders om nieuwe beheerdersgroepen aan te maken indien nodig. Hoofdbeheerders hebben altijd toegang tot alle groepen. Enkel beheerders met 'volledige toegang' kunnen instellingen wijzigen van de inschrijvingsgroep.</p>
                
                <STList>
                    <GroupPermissionRow v-for="role in roles" :key="role.id" :role="role" :showRole="true" :organization="patchedOrganization" :group="patchedGroup" @patch="addOrganizationPatch" />
                </STList>
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STList, AgeInput, BackButton,CenteredMessage, Checkbox, DateSelection, ErrorBox, FemaleIcon, LoadingButton, MaleIcon, PriceInput, Radio, RadioGroup, SegmentedControl, Slider, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Toast, Validator } from "@stamhoofd/components";
import { OrganizationMetaData, RecordType, Version } from '@stamhoofd/structures';
import { Group, GroupGenderType, GroupPrices, GroupSettings, Organization, OrganizationRecordsConfiguration, WaitingListType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import EditGroupPriceBox from "./EditGroupPriceBox.vue"
import GroupPermissionRow from "../admins/GroupPermissionRow.vue"

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
        GroupPermissionRow
    },
})
export default class EditGroupView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    tabs = ["general", "payments", "permissions"];
    tab = this.tabs[0];
    tabLabels = ["Algemeen", "Lidgeld", "Toegang"];

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

    get isNew() {
        return !OrganizationManager.organization.groups.find(g => g.id === this.group.id)
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

    get name() {
        return this.patchedGroup.settings.name
    }

    set name(name: string) {
        this.addSettingsPatch({ name })
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
        if (waitingListType == WaitingListType.PreRegistrations) {
            const preRegistrationsDate = new Date(this.startDate.getTime())
            preRegistrationsDate.setDate(preRegistrationsDate.getDate() - 14)
            this.addSettingsPatch({ preRegistrationsDate })
        } else {
            this.addSettingsPatch({ preRegistrationsDate: null })
        }
        if (waitingListType != WaitingListType.None) {
            this.addSettingsPatch({ maxMembers: this.maxMembers ?? 50 })
        } else {
            this.addSettingsPatch({ maxMembers: null })
        }
        this.addSettingsPatch({ waitingListType })
    }

    get preRegistrationsDate() {
        return this.patchedGroup.settings.preRegistrationsDate
    }

    set preRegistrationsDate(preRegistrationsDate: Date | null) {
        this.addSettingsPatch({ preRegistrationsDate })
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
        if (this.patchedGroup.settings.prices.find(g => g.reducedPrice !== null) && !this.patchedOrganization.meta.recordsConfiguration.shouldAsk(RecordType.FinancialProblems)) {
            console.log("Auto enabled financial problems record")

            const p = OrganizationRecordsConfiguration.patch({});
            p.enabledRecords.addPut(RecordType.FinancialProblems)
            const patchOrganization = Organization.patch({
                meta:  OrganizationMetaData.patch({
                    recordsConfiguration: p
                })
            })

            patch = patch.patch(patchOrganization)

            new Toast("We vragen nu ook bij het inschrijven of een lid in een kansarm gezin leeft zodat we het verminderd lidgeld kunnen toepassen", "info-filled").show()
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
        const p = Organization.patch({})
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
        console.log("should navigate away")
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-edit-view {
    

}
</style>
