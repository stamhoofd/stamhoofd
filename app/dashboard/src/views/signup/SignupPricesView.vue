<template>
    <div id="signup-prices-view" class="st-view">
        <STNavigationBar title="Lidgeld">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>
  
        <main>
            <h1>Lidgeld</h1>
            <p>Je kan later nog uitzonderingen voor bepaalde (leeftijds)groepen toevoegen.</p>

            <STInputBox title="Standaard tarief" error-fields="price" :error-box="errorBox">
                <PriceInput v-model="price" placeholder="Gratis" />
            </STInputBox>

            <Checkbox v-model="enableReducedPrice">
                Verlaagd tarief voor leden met financiële moeilijkheden
            </Checkbox>
            <STInputBox v-if="enableReducedPrice" title="Verlaagd tarief" error-fields="reducedPrice" :error-box="errorBox">
                <PriceInput v-model="reducedPrice" placeholder="Gratis" />
            </STInputBox>
            
            <Checkbox v-model="enableLatePrice">
                Verlaagd tarief na een bepaalde datum
            </Checkbox>

            <div v-if="enableLatePrice" class="split-inputs">
                <STInputBox title="Verminder het lidgeld vanaf" error-fields="reducedPriceDate" :error-box="errorBox">
                    <DateSelection v-model="latePriceDate" />
                </STInputBox>

                <STInputBox title="Standaard tarief na deze datum" error-fields="reducedPriceDate" :error-box="errorBox">
                    <PriceInput v-model="latePrice" placeholder="Gratis" />
                </STInputBox>
            </div>

            <STInputBox v-if="enableLatePrice && enableReducedPrice" title="Verlaagd tarief na deze datum" error-fields="reducedLatePrice" :error-box="errorBox">
                <PriceInput v-model="reducedLatePrice" placeholder="Gratis" />
            </STInputBox>

            <Checkbox v-model="enableFamilyPrice">
                Verlaagd tarief voor broers/zussen
            </Checkbox>
            <div class="split-inputs" v-if="enableFamilyPrice">
                <STInputBox title="Voor tweede broer/zus" error-fields="reducedPrice" :error-box="errorBox">
                    <PriceInput v-model="familyPrice" placeholder="Gratis" />
                </STInputBox>
                <STInputBox title="Daaropvolgende broers/zussen" error-fields="reducedPrice" :error-box="errorBox">
                    <PriceInput v-model="extraFamilyPrice" placeholder="Gratis" />
                </STInputBox>
            </div>
            <p class="style-description" v-if="enableFamilyPrice">Als meerdere verlaagde tarieven van toepassing zijn wordt automatisch het laagste gekozen.</p>

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
import { Checkbox, DateSelection, ErrorBox, PriceInput, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BackButton } from "@stamhoofd/components"
import { GroupPrices,Organization, Version } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import SignupAccountView from './SignupAccountView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        DateSelection,
        PriceInput,
        Checkbox,
        BackButton
    }
})
export default class SignupPricesView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization

    @Prop({required: true})
    registerCode: string | null;

    errorBox: ErrorBox | null = null

    price = 4000
    
    enableReducedPrice = false
    reducedPrice = Math.round(4000/3)

    enableLatePrice = false
    latePrice = Math.round(4000/3)
    latePriceDate = new Date(this.organization.meta.defaultStartDate.getTime() + (this.organization.meta.defaultEndDate.getTime() - this.organization.meta.defaultStartDate.getTime())/2)
    reducedLatePrice = 0

    enableFamilyPrice = false
    familyPrice = 4000
    extraFamilyPrice = 4000

    goNext() {

        try {
            const organization = Organization.decode(new ObjectData(this.organization.encode({version: Version}), {version: Version}))

            //organization.
            const prices: GroupPrices[] = [
                GroupPrices.create({
                    startDate: null,
                    price: this.price,
                    reducedPrice: this.enableReducedPrice ? this.reducedPrice : null,
                    familyPrice: this.enableFamilyPrice ? this.familyPrice : null,
                    extraFamilyPrice: this.enableFamilyPrice ? this.extraFamilyPrice : null,
                })
            ]

            if (this.enableLatePrice) {
                prices.push(GroupPrices.create({
                    startDate: this.latePriceDate,
                    price: this.latePrice,
                    reducedPrice: this.enableReducedPrice ? this.reducedLatePrice : null,
                    familyPrice: this.enableFamilyPrice ? this.familyPrice : null,
                    extraFamilyPrice: this.enableFamilyPrice ? this.extraFamilyPrice : null,
                }))
            }
            organization.meta.defaultPrices = prices
            
            this.errorBox = null

            this.show(new ComponentWithProperties(SignupAccountView, { organization, registerCode: this.registerCode }))
            plausible('signupPrices');
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            plausible('signupPricesError');
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
