<template>
    <div id="signup-structure-view" class="st-view">
        <STNavigationBar title="Samenstelling">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>
        <STNavigationTitle>
            Samenstelling
        </STNavigationTitle>

        <main>
            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <STInputBox title="Soort vereniging" error-fields="type" :error-box="errorBox">
                    <select v-model="type" class="input">
                        <option :value="null" disabled>
                            Maak een keuze
                        </option>
                        <option v-for="_type in availableTypes" :key="_type.value" :value="_type.value">
                            {{ _type.name }}
                        </option>
                    </select>
                </STInputBox>

                <STInputBox v-if="type == 'Youth'" title="Koepelorganisatie" error-fields="umbrellaOrganization" :error-box="errorBox">
                    <select v-model="umbrellaOrganization" class="input">
                        <option :value="null" disabled>
                            Maak een keuze
                        </option>
                        <option :value="item.value" v-for="item in availableUmbrellaOrganizations" :key="item.value">
                            {{ item.name }}
                        </option>
                    </select>
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
            <template #left>
                Je kan dit later nog wijzigen of op een geavanceerdere manier instellen
            </template>
            <template #right>
                <button class="button primary" @click="goNext">
                    Volgende
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Radio, RadioGroup } from "@stamhoofd/components"
import { ErrorBox, BackButton } from "@stamhoofd/components";
import STErrorsDefault from "@stamhoofd/components/src/errors/STErrorsDefault.vue";
import STInputBox from "@stamhoofd/components/src/inputs/STInputBox.vue";
import STNavigationBar from "@stamhoofd/components/src/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/components/src/navigation/STNavigationTitle.vue"
import STToolbar from "@stamhoofd/components/src/navigation/STToolbar.vue"
import { Organization, OrganizationGenderType,OrganizationType, UmbrellaOrganization, Version, OrganizationTypeHelper, UmbrellaOrganizationHelper} from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import SignupYearDurationView from './SignupYearDurationView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle,
        STErrorsDefault,
        STInputBox,
        RadioGroup,
        Radio,
        BackButton
    }
})
export default class SignupStructureView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization
    errorBox: ErrorBox | null = null

    type: OrganizationType | null = null
    umbrellaOrganization: UmbrellaOrganization | null = null
    genderType: OrganizationGenderType | null = null

    goNext() {

        try {
            if (this.type === null) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Maak een keuze",
                    field: "type"
                })
            }

            if (this.umbrellaOrganization === null && this.type == OrganizationType.Youth) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Maak een keuze",
                    field: "umbrellaOrganization"
                })
            }

            if (this.genderType === null) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Maak een keuze",
                    field: "genderType"
                })
            }

            this.errorBox = null
        
            // todo: extend organization
            const organization = Organization.decode(new ObjectData(this.organization.encode({version: Version}), {version: Version}))

            organization.meta.type = this.type
            organization.meta.umbrellaOrganization = this.umbrellaOrganization
            organization.meta.genderType = this.genderType

            this.show(new ComponentWithProperties(SignupYearDurationView, { organization }))
            plausible('signupStructure');
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            plausible('signupStructureError');
            return;
        }
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
        return OrganizationTypeHelper.getList();
    }

    get availableUmbrellaOrganizations() {
        return UmbrellaOrganizationHelper.getList();
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#signup-structure-view {
}
</style>
