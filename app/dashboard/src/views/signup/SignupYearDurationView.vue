<template>
    <div id="signup-year-duration-view" class="st-view">
        <STNavigationBar title="Werkjaar">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
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
import { ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { DateSelection, ErrorBox, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BackButton } from "@stamhoofd/components"
import { Organization, Version } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import SignupPricesView from './SignupPricesView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        DateSelection,
        BackButton
    }
})
export default class SignupYearDurationView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization
    errorBox: ErrorBox | null = null

    startDate = this.organization.meta.defaultStartDate
    endDate = this.organization.meta.defaultEndDate

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
            const organization = Organization.decode(new ObjectData(this.organization.encode({version: Version}), {version: Version}))

            organization.meta.defaultStartDate = this.startDate
            organization.meta.defaultEndDate = this.endDate

            this.show(new ComponentWithProperties(SignupPricesView, { organization }))
            plausible('signupYearDuration');
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            plausible('signupYearDurationError');
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
