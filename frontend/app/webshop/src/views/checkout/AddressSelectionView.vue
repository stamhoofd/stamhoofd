<template>
    <div class="boxed-view">
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
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, ErrorBox, LoadingButton, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Address, Group, KeychainedResponse, MemberWithRegistrations, Payment, PaymentMethod, PaymentStatus, Record, RecordType, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup, ValidatedAddress, WebshopTakeoutMethod, WebshopTimeSlot, WebshopTimeSlots } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingButton,
        STErrorsDefault,
        AddressInput
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
           const nextStep = CheckoutStepsManager.getNextStep(CheckoutStepType.Address)
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
        HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Address.toLowerCase())
    }

    activated() {
        // For an unknown reason, we need to set a timer to properly update the URL...
        window.setTimeout(() => {
            HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Address.toLowerCase())
        }, 100);
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>