<template>
    <div class="st-view background">
        <STNavigationBar title="Samenstelling" />

        <main>
            <h1>
                Configureer leeftijdsgroepen
            </h1>
            <p>Aan de hand van jouw antwoorden kunnen we de meeste instellingen automatisch configureren. Je kan dit hierna nog nauwkeuriger instellen.</p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <STInputBox title="Soort vereniging" error-fields="type" :error-box="errorBox">
                    <Dropdown v-model="type">
                        <option :value="null" disabled>
                            Maak een keuze
                        </option>
                        <option v-for="_type in availableTypes" :key="_type.value" :value="_type.value">
                            {{ _type.name }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="type == 'Youth'" title="Koepelorganisatie" error-fields="umbrellaOrganization" :error-box="errorBox">
                    <Dropdown v-model="umbrellaOrganization">
                        <option :value="null" disabled>
                            Maak een keuze
                        </option>
                        <option v-for="item in availableUmbrellaOrganizations" :key="item.value" :value="item.value">
                            {{ item.name }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>

            <STInputBox title="Jongens en meisjes" error-fields="genderType" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-for="_genderType in genderTypes" :key="_genderType.value" v-model="genderType" :value="_genderType.value">
                        {{ _genderType.name }}
                    </Radio>
                </RadioGroup>
            </STInputBox>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Volgende
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, DateSelection, Dropdown,ErrorBox, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { Organization, OrganizationGenderType, OrganizationMetaData, OrganizationModules, OrganizationPatch, OrganizationType,OrganizationTypeHelper, UmbrellaOrganization, UmbrellaOrganizationHelper, Version } from "@stamhoofd/structures"
import { Sorter } from '@stamhoofd/utility';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import MembersYearSetupView from './MembersYearSetupView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        RadioGroup,
        Radio,
        BackButton,
        TimeInput,
        LoadingButton,
        Dropdown
    },
})
export default class MembersStructureSetupView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = this.$organization

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: this.$organization.id })

    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }

    get type() {
        return this.organization.meta.type
    }

    set type(type: OrganizationType) {
        this.addMetaPatch({ type })
    }

    get umbrellaOrganization() {
        return this.organization.meta.umbrellaOrganization
    }

    set umbrellaOrganization(umbrellaOrganization: UmbrellaOrganization | null) {
        this.addMetaPatch({ umbrellaOrganization })
    }

    get genderType() {
        return this.organization.meta.genderType
    }

    set genderType(genderType: OrganizationGenderType) {
        this.addMetaPatch({ genderType })
    }

    get genderTypes() {
        return [
            {
                value: OrganizationGenderType.Mixed,
                name: "Gemengd",
            },
            {
                value: OrganizationGenderType.Separated,
                name: "Gescheiden",
            },
            {
                value: OrganizationGenderType.OnlyFemale,
                name: "Enkel meisjes",
            },
            {
                value: OrganizationGenderType.OnlyMale,
                name: "Enkel jongens",
            },
        ]
    }

    get availableTypes() {
        return OrganizationTypeHelper.getList().sort((a, b) => 
            Sorter.stack(
                Sorter.byBooleanValue(
                    !a.name.toLowerCase().startsWith("andere"), 
                    !b.name.toLowerCase().startsWith("andere")
                ), 
                Sorter.byStringProperty(a, b, "name")
            )
        );
    }

    get availableUmbrellaOrganizations() {
        return UmbrellaOrganizationHelper.getList().sort((a, b) => 
            Sorter.stack(
                Sorter.byBooleanValue(
                    !a.name.toLowerCase().startsWith("andere"), 
                    !b.name.toLowerCase().startsWith("andere")
                ), 
                Sorter.byStringProperty(a, b, "name")
            )
        )
    }

    addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationMetaData>> ) {
        this.organizationPatch = this.organizationPatch.patch(OrganizationPatch.create({ 
            meta: OrganizationMetaData.patch(patch)
        }))
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
      
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            await this.$organizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: this.$organization.id })
            this.show(new ComponentWithProperties(MembersYearSetupView, {}))
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, this.$organization, { version: Version })) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>