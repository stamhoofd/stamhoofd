<template>
    <div class="st-view boxed">
        <STNavigationBar :dismiss="canDismiss" :pop="canPop" />

        <div class="box">
            <div class="st-view">
                <main>
                    <h1>Kies je leveringsadres</h1>
                    <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== checkout.deliveryPrice" class="info-box">
                        Bestel minimum {{ deliveryMethod.price.minimumPrice | price }} om van een verlaagde leveringskost van {{ deliveryMethod.price.discountPrice | price }} te genieten.
                    </div>

                    <p v-if="checkout.deliveryPrice == 0" class="success-box">
                        Levering is gratis
                        <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price != 0" class="info-box">
                            vanaf een bestelbedrag van {{ deliveryMethod.price.minimumPrice | price }}.
                        </template>
                    </p>
                    <p v-else class="info-box">
                        De leveringskost bedraagt {{ checkout.deliveryPrice | price }}
                        <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === checkout.deliveryPrice" class="info-box">
                            vanaf een bestelbedrag van {{ deliveryMethod.price.minimumPrice | price }}.
                        </template>
                    </p>

                    <STErrorsDefault :error-box="errorBox" />

                    <AddressInput v-model="address" :required="true" title="Vul het leveringsadres in" :validator="validator" :validate-server="server" />
                </main>

                <STToolbar>
                    <LoadingButton slot="right" :loading="loading">
                        <button class="button primary" @click="goNext">
                            <span>Doorgaan</span>
                            <span class="icon arrow-right" />
                        </button>
                    </LoadingButton>
                </STToolbar>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, ErrorBox, LoadingButton, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { ValidatedAddress } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingButton,
        STErrorsDefault,
        AddressInput,
        BackButton
    },
    filters: {
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter),
        price: Formatter.price.bind(Formatter)
    }
})
export default class AddressSelectionView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null
    validator = new Validator()
    CheckoutManager = CheckoutManager

    get checkoutMethod() {
        return CheckoutManager.checkout.checkoutMethod!
    }

    get deliveryMethod() {
        return CheckoutManager.checkout.deliveryMethod
    }

    get checkout() {
        return CheckoutManager.checkout
    }

    get webshop() {
        return WebshopManager.webshop
    }

    get address() {
        return CheckoutManager.checkout.address
    }

    set address(address: ValidatedAddress | null) {
        console.log(address)
        CheckoutManager.checkout.address = address
        CheckoutManager.saveCheckout()
    } 

    get server() {
        return WebshopManager.server
    }

    async goNext() {
        if (this.loading) {
            return
        }
        this.loading = true

        if (!await this.validator.validate()) {
            this.loading = false
            return
        }
        this.errorBox = null

        try {
            const nextStep = await CheckoutStepsManager.getNextStep(CheckoutStepType.Address, true)
            if (!nextStep) {
                throw new SimpleError({
                    code: "missing_config",
                    message: "Er ging iets mis bij het ophalen van de volgende stap"
                })
            }
            const comp = await nextStep.getComponent()

            this.show(new ComponentWithProperties(comp, {}))
            
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    mounted() {
        UrlHelper.setUrl("/checkout/"+CheckoutStepType.Address.toLowerCase())
    }
}
</script>