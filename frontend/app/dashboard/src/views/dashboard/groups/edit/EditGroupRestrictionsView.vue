<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <template v-if="isPropertyEnabled('birthDay')">
            <div class="split-inputs">
                <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="settings.minAge" :error-box="errorBox">
                    <AgeInput v-model="minAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
                </STInputBox>

                <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="settings.maxAge" :error-box="errorBox">
                    <AgeInput v-model="maxAge" :year="startYear" placeholder="Onbeperkt" :nullable="true" />
                </STInputBox>
            </div>
            <p class="st-list-description">
                *Hoe oud het lid wordt in het kalenderjaar van de startdatum van deze groep (dus leeftijd op 31/12/{{ startYear }}).<template v-if="isBelgium">
                    Ter referentie: leden uit het eerste leerjaar zijn 6 jaar op 31 december. Leden uit het eerste secundair zijn 12 jaar op 31 december.
                </template>
            </p>
        </template>

        <STInputBox v-if="isPropertyEnabled('gender')" title="Jongens en meisjes" error-fields="genderType" :error-box="errorBox" class="max">
            <RadioGroup>
                <Radio v-for="_genderType in genderTypes" :key="_genderType.value" v-model="genderType" :value="_genderType.value">
                    {{ _genderType.name }}
                </Radio>
            </RadioGroup>
        </STInputBox>

        <hr>
        <h2 class="style-with-button">
            <div>Verplicht ingeschreven bij...</div>
            <div>
                <button v-if="patchedGroup.settings.requireGroupIds.length == 0" type="button" class="button text only-icon-smartphone" @click="editRequireGroups">
                    <span class="icon add" />
                    <span>Toevoegen</span>
                </button>
                <button v-else class="button text only-icon-smartphone" type="button" @click="editRequireGroups">
                    <span class="icon edit" />
                    <span>Wijzigen</span>
                </button>
            </div>
        </h2>
        <p>Geef leden enkel toegang om in te schrijven als ze al ingeschreven zijn voor één van de volgende inschrijvingsgroepen. Laat leeg als je ook nieuwe leden wil laten inschrijven.</p>

        <STList v-if="patchedGroup.settings.requireGroupIds.length > 0">
            <STListItem v-for="id of patchedGroup.settings.requireGroupIds" :key="id">
                {{ getGroupName(id) }}

                <template #right><button class="button text only-icon-smartphone" type="button" @click="removeRequireGroupId(id)">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button></template>
            </STListItem>
        </STList>
        <p v-else class="info-box">
            Geen verplichte andere inschrijvingen
        </p>

        <hr>
        <h2 class="style-with-button">
            <div>Verplicht vorige inschrijvingsperiode ingeschreven bij...</div>
            <div>
                <button v-if="patchedGroup.settings.requirePreviousGroupIds.length == 0" type="button" class="button text only-icon-smartphone" @click="editRequirePreviousGroups">
                    <span class="icon add" />
                    <span>Toevoegen</span>
                </button>
                <button v-else class="button text only-icon-smartphone" type="button" @click="editRequirePreviousGroups">
                    <span class="icon edit" />
                    <span>Wijzigen</span>
                </button>
            </div>
        </h2>
        <p>Leden kunnen enkel zelf inschrijven voor deze inschrijvingsgroep als ze de vorige inschrijvingsperiode ingeschreven waren voor één van de volgende inschrijvingsgroepen.</p>

        <STList v-if="patchedGroup.settings.requirePreviousGroupIds.length > 0">
            <STListItem v-for="id of patchedGroup.settings.requirePreviousGroupIds" :key="id">
                {{ getGroupName(id) }}

                <template #right><button class="button text only-icon-smartphone" type="button" @click="removeRequirePreviousGroupId(id)">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button></template>
            </STListItem>
        </STList>
        <p v-else class="info-box">
            Geen verplichte vorige inschrijvingen noodzakelijk
        </p>

        <hr>
        <h2 class="style-with-button">
            <div>Verhinder inschrijven als vorige keer ingeschreven bij...</div>
            <div>
                <button v-if="patchedGroup.settings.preventPreviousGroupIds.length == 0" type="button" class="button text only-icon-smartphone" @click="editPreventPreviousGroups">
                    <span class="icon add" />
                    <span>Toevoegen</span>
                </button>
                <button v-else class="button text only-icon-smartphone" type="button" @click="editPreventPreviousGroups">
                    <span class="icon edit" />
                    <span>Wijzigen</span>
                </button>
            </div>
        </h2>
        <p>Leden kunnen niet inschrijven voor deze inschrijvingsgroep als ze de vorige inschrijvingsperiode ingeschreven waren voor één van de volgende inschrijvingsgroepen.</p>

        <STList v-if="patchedGroup.settings.preventPreviousGroupIds.length > 0">
            <STListItem v-for="id of patchedGroup.settings.preventPreviousGroupIds" :key="id">
                {{ getGroupName(id) }}

                <template #right><button class="button text only-icon-smartphone" type="button" @click="removePreventPreviousGroupId(id)">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button></template>
            </STListItem>
        </STList>
        <p v-else class="info-box">
            Geen vorige inschrijvingsgroepen die uitgesloten worden
        </p>
    </SaveView>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { AgeInput, Checkbox, DateSelection, PriceInput, Radio, RadioGroup, SaveView, SegmentedControl, Slider, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, UploadButton } from "@stamhoofd/components";
import { Country, GroupGenderType, GroupSettings } from '@stamhoofd/structures';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import GroupPermissionRow from "../../admins/GroupPermissionRow.vue";
import EditGroupPriceBox from "../EditGroupPriceBox.vue";
import SelectGroupsView from '../SelectGroupsView.vue';
import EditGroupMixin from './EditGroupMixin';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        AgeInput,
        Slider,
        TimeInput,
        EditGroupPriceBox,
        STList,
        GroupPermissionRow,
        UploadButton,
        STListItem
    },
})
export default class EditGroupRestrictionsView extends Mixins(EditGroupMixin) {
    get title() {
        return 'Inschrijvingsbeperkingen'
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    isPropertyEnabled(name: "emailAddress" | "birthDay" | "phone" | "address" | "gender") {
        return !!this.$organization.meta.recordsConfiguration[name]
    }

    getGroupName(id: string) {
        const group = this.patchedOrganization.groups.find(g => g.id === id)
        if (!group) {
            // Search deleted groups (in non patched one)
            const deleted = this.$organization.groups.find(g => g.id === id)
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
            allowArchived: false,
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
            cycleOffset: 1,
            allowArchived: false,
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
            cycleOffset: 1,
            allowArchived: false,
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


    get name() {
        return this.patchedGroup.settings.name
    }

    get startDate() {
        return this.patchedGroup.settings.startDate
    }

    get startYear() {
        return this.startDate.getFullYear()
    }

    get registrationStartDate() {
        return this.patchedGroup.settings.registrationStartDate
    }

    set registrationStartDate(registrationStartDate: Date | null) {
        this.addSettingsPatch({ registrationStartDate })
    }

    get registrationEndDate() {
        return this.patchedGroup.settings.registrationEndDate
    }

    set registrationEndDate(registrationEndDate: Date | null) {
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
}
</script>