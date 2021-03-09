<template>
    <div class="st-view boxed">
        <STNavigationBar :large="true">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <div class="box">
            <main>
                <h1>Jouw gegevens</h1>

                <STErrorsDefault :error-box="errorBox" />

                <STInputBox title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                        </div>
                    </div>
                </STInputBox>

                <EmailInput v-model="email" title="Jouw e-mailadres" :validator="validator" placeholder="Voor bevestingsemail" />

                <PhoneInput v-model="phone" title="Jouw GSM-nummer" :validator="validator" placeholder="Voor dringende info" />
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
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { EmailInput,ErrorBox, LoadingButton, PhoneInput,STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator, BackButton } from "@stamhoofd/components"
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
        STInputBox,
        EmailInput,
        PhoneInput,
        BackButton
    },
    filters: {
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class CustomerView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null
    validator = new Validator()
    CheckoutManager = CheckoutManager
    

    get checkoutMethod() {
        return CheckoutManager.checkout.checkoutMethod!
    }

    get webshop() {
        return WebshopManager.webshop
    }

    get firstName() {
        return CheckoutManager.checkout.customer.firstName
    }

    set firstName(firstName: string) {
        CheckoutManager.checkout.customer.firstName = firstName
        CheckoutManager.saveCheckout()
    } 

    get lastName() {
        return CheckoutManager.checkout.customer.lastName
    }

    set lastName(lastName: string) {
        CheckoutManager.checkout.customer.lastName = lastName
        CheckoutManager.saveCheckout()
    } 

    get email() {
        return CheckoutManager.checkout.customer.email
    }

    set email(email: string) {
        CheckoutManager.checkout.customer.email = email
        CheckoutManager.saveCheckout()
    } 

    get phone() {
        return CheckoutManager.checkout.customer.phone
    }

    set phone(phone: string) {
        CheckoutManager.checkout.customer.phone = phone
        CheckoutManager.saveCheckout()
    } 

    async goNext() {
        if (this.loading) {
            return
        }

        if (!await this.validator.validate()) {
            return
        }
        this.loading = true
        this.errorBox = null

        try {
           const nextStep = CheckoutStepsManager.getNextStep(CheckoutStepType.Customer)
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
        console.log("set customer")
        HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Customer.toLowerCase())
    }

    activated() {
        // For an unknown reason, we need to set a timer to properly update the URL...
        window.setTimeout(() => {
            HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Customer.toLowerCase())
        }, 100);
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>