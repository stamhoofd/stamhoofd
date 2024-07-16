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

                <template #right>
                    <button class="button text only-icon-smartphone" type="button" @click="removeRequireGroupId(id)">
                        <span class="icon trash" />
                        <span>Verwijderen</span>
                    </button>
                </template>
            </STListItem>
        </STList>
        <p v-else class="info-box">
            Geen verplichte andere inschrijvingen
        </p>
    </SaveView>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { AgeInput, Checkbox, DateSelection, PriceInput, Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem, SaveView, SegmentedControl, Slider, TimeInput, UploadButton } from "@stamhoofd/components";
import { Country, GroupGenderType, GroupSettings } from '@stamhoofd/structures';

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
        STList,
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
        return !!this.$organization.meta.recordsConfiguration[name] || this.$platform.config.recordsConfiguration[name]
    }

    getGroupName(id: string) {
        const group = this.patchedPeriod.groups.find(g => g.id === id)
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
