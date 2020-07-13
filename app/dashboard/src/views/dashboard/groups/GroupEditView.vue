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
                <STInputBox title="Minimum geboortejaar" error-fields="settings.minBirthYear" :error-box="errorBox">
                    <BirthYearInput v-model="minBirthYear" placeholder="Onbeperkt" :nullable="true" />
                </STInputBox>

                <STInputBox title="Maximum geboortejaar" error-fields="settings.maxBirthYear" :error-box="errorBox">
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
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, FemaleIcon, MaleIcon, Radio, RadioGroup, SegmentedControl, STErrorsDefault,STInputBox, STNavigationBar, STNavigationTitle } from "@stamhoofd/components";
import { Group, GroupGenderType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        MaleIcon,
        FemaleIcon,
        DateSelection,
        RadioGroup,
        Radio,
        BirthYearInput
    },
})
export default class GroupEditView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null

    tabs = ["general", "payments", "permissions"];
    tab = this.tabs[0];
    tabLabels = ["Algemeen", "Betaling", "Toegang"];

    @Prop()
    group!: Group;

    get name() {
        return this.group.settings.name
    }

    set name(name: string) {
        this.group.settings.name = name
    }

    get description() {
        return this.group.settings.description
    }

    set description(description: string) {
        this.group.settings.description = description
    }

    get startDate() {
        return this.group.settings.startDate
    }

    set startDate(startDate: Date) {
        this.group.settings.startDate = startDate
    }

    get endDate() {
        return this.group.settings.endDate
    }

    set endDate(endDate: Date) {
        this.group.settings.endDate = endDate
    }

    get genderType() {
        return this.group.settings.genderType
    }

    set genderType(genderType: GroupGenderType) {
        this.group.settings.genderType = genderType
    }

    // Birth years
    get minBirthYear() {
        return this.group.settings.minBirthYear
    }

    set minBirthYear(minBirthYear: number | null) {
        this.group.settings.minBirthYear = minBirthYear
    }

    get maxBirthYear() {
        return this.group.settings.maxBirthYear
    }
    
    set maxBirthYear(maxBirthYear: number | null) {
        this.group.settings.maxBirthYear = maxBirthYear
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-edit-view {

}
</style>
