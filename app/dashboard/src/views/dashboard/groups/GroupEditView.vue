<template>
    <div class="st-view group-edit-view">
        <STNavigationBar title="Nieuwe groep toevoegen">
            <button slot="right" class="button icon close" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Nieuwe groep toevoegen
            </h1>
            <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />

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

            <STInputBox title="Beschrijving" error-fields="settings.description" :error-box="errorBox">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Zichtbaar voor leden tijdens het inschrijven"
                    autocomplete=""
                />
            </STInputBox>

            <div class="split-inputs">
                <STInputBox title="Inschrijven start op" error-fields="settings.startDate" :error-box="errorBox">
                    <DateSelection v-model="startDate" />
                </STInputBox>

                <STInputBox title="Inschrijven sluit op" error-fields="settings.endDate" :error-box="errorBox">
                    <DateSelection v-model="endDate" />
                </STInputBox>
            </div>

            <div class="split-inputs">
                <STInputBox title="Minimum geboortejaar (max. leeftijd)" error-fields="settings.minBirthYear" :error-box="errorBox">
                    <BirthYearInput v-model="minBirthYear" placeholder="Onbeperkt" :nullable="true" />
                </STInputBox>

                <STInputBox title="Maximum geboortejaar (min. leeftijd)" error-fields="settings.maxBirthYear" :error-box="errorBox">
                    <BirthYearInput v-model="maxBirthYear" placeholder="Onbeperkt" :nullable="true" />
                </STInputBox>
            </div>
            <p class="st-list-description">
                De geboortejaren worden elk jaar automatisch aangepast.
            </p>

            <STInputBox title="Jongens en meisjes" error-fields="genderType" :error-box="errorBox">
                <RadioGroup>
                    <Radio v-for="_genderType in genderTypes" :key="_genderType.value" v-model="genderType" :value="_genderType.value">
                        {{ _genderType.name }}
                    </Radio>
                </RadioGroup>
            </STInputBox>
        </main>

        <STToolbar>
            <template slot="right">
                <Spinner v-if="saving" />
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, FemaleIcon, MaleIcon, Radio, RadioGroup, SegmentedControl, Spinner,STErrorsDefault,STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"

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
        Radio,
        BirthYearInput,
        Spinner
    },
})
export default class GroupEditView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null

    tabs = ["general", "payments", "permissions"];
    tab = this.tabs[0];
    tabLabels = ["Algemeen", "Betaling", "Toegang"];

    saving = false

    @Prop()
    groupId!: string;

    @Prop()
    organizationPatch!: AutoEncoderPatchType<Organization> & AutoEncoder ;

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get group() {
        const organization = this.organization
        for (const group of organization.groups) {
            if (group.id === this.groupId) {
                return group
            }
        }
        throw new Error("Group not found")
    }

    addPatch(patch: AutoEncoderPatchType<Group> ) {
        if (this.saving) {
            return
        }
        (this.organizationPatch as any).groups.addPatch(patch)
    }

    addSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupSettings>> ) {
        this.addPatch(GroupPatch.create({ 
            id: this.groupId, 
            settings: GroupSettingsPatch.create(patch)
        }))
    }

    get name() {
        return this.group.settings.name
    }

    set name(name: string) {
        this.addSettingsPatch({ name })
    }

    get description() {
        return this.group.settings.description
    }

    set description(description: string) {
        this.addSettingsPatch({ description })
    }

    get startDate() {
        return this.group.settings.startDate
    }

    set startDate(startDate: Date) {
        this.addSettingsPatch({ startDate })
    }

    get endDate() {
        return this.group.settings.endDate
    }

    set endDate(endDate: Date) {
        this.addSettingsPatch({ endDate })
    }

    get genderType() {
        return this.group.settings.genderType
    }

    set genderType(genderType: GroupGenderType) {
        this.addSettingsPatch({ genderType })
    }

    // Birth years
    get minBirthYear() {
        return this.group.settings.minBirthYear
    }

    set minBirthYear(minBirthYear: number | null) {
        this.addSettingsPatch({ minBirthYear })
    }

    get maxBirthYear() {
        return this.group.settings.maxBirthYear
    }
    
    set maxBirthYear(maxBirthYear: number | null) {
        this.addSettingsPatch({ maxBirthYear })
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

    async save() {
        this.saving = true

        await OrganizationManager.patch(this.organizationPatch)
        this.saving = false
        this.pop()
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-edit-view {

}
</style>
