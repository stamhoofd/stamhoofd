<template>
    <div id="signup-structure-view" class="st-view">
        <STNavigationBar title="Samenstelling">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">
                Terug
            </button>
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
                        <option value="ScoutsEnGidsenVlaanderen">
                            Scouts &amp; Gidsen Vlaanderen
                        </option>
                        <option value="ChiroNationaal">
                            Chiro Nationaal
                        </option>
                        <option value="Other">
                            Andere
                        </option>
                    </select>
                </STInputBox>
            </div>

            <STInputBox title="Jongens en meisjes">
                <RadioGroup>
                    <Radio name="gender">
                        Gemengd
                    </Radio>
                    <Radio name="gender">
                        Gescheiden
                    </Radio>
                    <Radio name="gender">
                        Enkel jongens
                    </Radio>
                    <Radio name="gender">
                        Enkel meisjes
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
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Radio, RadioGroup, Slider } from "@stamhoofd/components"
import { ErrorBox } from "@stamhoofd/components/src/errors/ErrorBox";
import STErrorsDefault from "@stamhoofd/components/src/errors/STErrorsDefault.vue";
import STInputBox from "@stamhoofd/components/src/inputs/STInputBox.vue";
import STNavigationBar from "@stamhoofd/components/src/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/components/src/navigation/STNavigationTitle.vue"
import STToolbar from "@stamhoofd/components/src/navigation/STToolbar.vue"
import { Organization, OrganizationType, UmbrellaOrganization} from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle,
        Slider,
        STErrorsDefault,
        STInputBox,
        RadioGroup,
        Radio
    }
})
export default class SignupStructureView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization
    errorBox: ErrorBox | null = null

    type: OrganizationType | null = null
    umbrellaOrganization: UmbrellaOrganization | null = null

    get availableTypes() {
        return [
            {
                value: OrganizationType.Youth,
                name: "Jeugdbeweging",
            },
            {
                value: OrganizationType.Football,
                name: "Voetbal",
            },
            {
                value: OrganizationType.Tennis,
                name: "Tennis",
            },
            {
                value: OrganizationType.Golf,
                name: "Golf",
            },
            {
                value: OrganizationType.Athletics,
                name: "Atletiek",
            },
            {
                value: OrganizationType.Badminton,
                name: "Badminton",
            },
            {
                value: OrganizationType.Hockey,
                name: "Hockey",
            },
            {
                value: OrganizationType.Cycling,
                name: "Wielrennen",
            },
            {
                value: OrganizationType.Swimming,
                name: "Zwemmen",
            },
            {
                value: OrganizationType.Dance,
                name: "Dans",
            },
            {
                value: OrganizationType.Volleyball,
                name: "Volleybal",
            },
            {
                value: OrganizationType.Basketball,
                name: "Basketbal",
            },
            {
                value: OrganizationType.Judo,
                name: "Judo",
            },
            {
                value: OrganizationType.Sport,
                name: "Andere sport",
            },
            {
                value: OrganizationType.Student,
                name: "Studentenvereniging",
            },
            {
                value: OrganizationType.Other,
                name: "Niet in lijst",
            },
        ];
    }

    goNext() {

        try {
            this.errorBox = null
        } catch (e) {
            console.error(e)
            if (isSimpleError(e) || isSimpleErrors(e)) {
                console.log("Updated errorbox")
                this.errorBox = new ErrorBox(e)
            }
            return;
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#signup-structure-view {
}
</style>
