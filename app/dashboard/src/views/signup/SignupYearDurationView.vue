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

            <STInputBox title="Inschrijven start op" error-fields="startDate" :error-box="errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox title="Inschrijven sluit op" error-fields="endDate" :error-box="errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>

            <STErrorsDefault :error-box="errorBox" />
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
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { DateSelection, ErrorBox, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Organization } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import SignupPricesView from './SignupPricesView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
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
            if (this.endDate < this.startDate) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "endDate before startDate",
                    human: "Het begin van de inschrijvingsperiode moet voor het einde liggen."
                })
            }
            this.errorBox = null

            // todo: extend organization
            const organization = this.organization

            this.show(new ComponentWithProperties(SignupPricesView, { organization }))
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
