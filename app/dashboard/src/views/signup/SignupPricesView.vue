<template>
    <div id="signup-prices-view" class="st-view">
        <STNavigationBar title="Lidgeld">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">
                Terug
            </button>
        </STNavigationBar>
  
        <main>
            <h1>Lidgeld</h1>
            <p>Je kan later nog uitzonderingen voor bepaalde (leeftijds)groepen toevoegen.</p>

            <STInputBox title="Lidgeld" error-fields="price" :error-box="errorBox">
                <PriceInput v-model="price" placeholder="Gratis" />
            </STInputBox>

            <Checkbox v-model="enableReducedPrice">
                Verminder het lidgeld voor leden met financiële moeilijkheden
            </Checkbox>

            <STInputBox v-if="enableReducedPrice" title="Verminderd lidgeld" error-fields="reducedPrice" :error-box="errorBox">
                <PriceInput v-model="reducedPrice" placeholder="Gratis" />
            </STInputBox>

            <Checkbox v-model="enableLatePrice">
                Verminder het lidgeld na een bepaalde datum
            </Checkbox>

            <div v-if="enableLatePrice" class="split-inputs">
                <STInputBox title="Verminder het lidgeld vanaf" error-fields="reducedPriceDate" :error-box="errorBox">
                    <DateSelection v-model="latePriceDate" />
                </STInputBox>

                <STInputBox title="Lidgeld na deze datum" error-fields="reducedPriceDate" :error-box="errorBox">
                    <PriceInput v-model="latePrice" placeholder="Gratis" />
                </STInputBox>
            </div>

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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, DateSelection, ErrorBox, PriceInput, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Organization } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        DateSelection,
        PriceInput,
        Checkbox
    }
})
export default class SignupPricesView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization
    errorBox: ErrorBox | null = null

    price = 4000
    
    enableReducedPrice = false
    reducedPrice = Math.round(4000/3)

    enableLatePrice = false
    latePrice = Math.round(4000/3)
    latePriceDate = new Date() // todo: take middle date

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

#signup-prices-view {
}
</style>
