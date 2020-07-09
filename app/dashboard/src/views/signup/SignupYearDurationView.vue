<template>
    <div id="signup-year-duration-view" class="st-view">
        <STNavigationBar title="Werkjaar">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">
                Terug
            </button>
        </STNavigationBar>
  
        <main>
            <h1>Werkjaar</h1>
            <p>Je kan later uitzonderingen voor bepaalde groepen toevoegen indien nodig.</p>

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Inschrijven start op" error-fields="startDate" :error-box="errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox title="Inschrijven sluit op" error-fields="endDate" :error-box="errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </main>

        <STToolbar>
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
import { DateSelection } from "@stamhoofd/components"
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
        STErrorsDefault,
        STInputBox,
        DateSelection
    }
})
export default class SignupYearDurationView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization
    errorBox: ErrorBox | null = null

    startDate = new Date()
    endDate = new Date()

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

#signup-year-duration-view {
}
</style>
