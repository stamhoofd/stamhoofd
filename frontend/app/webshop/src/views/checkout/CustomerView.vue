<template>
    <form class="st-view boxed" @submit.prevent="goNext">
        <STNavigationBar>
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <div class="box">
            <main>
                <h1>Jouw gegevens</h1>

                <STErrorsDefault :error-box="errorBox" />

                <STInputBox title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" name="fname" type="text" placeholder="Voornaam" required autocomplete="given-name">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" name="lname" type="text" placeholder="Achternaam" required autocomplete="family-name">
                        </div>
                    </div>
                </STInputBox>

                <EmailInput v-model="email" title="E-mailadres" name="email" :validator="validator" placeholder="Voor bevestingsemail" autocomplete="email" />

                <PhoneInput v-model="phone" :title="$t('shared.inputs.mobile.label' )" name="mobile" :validator="validator" placeholder="Voor dringende info" autocomplete="tel" />

                <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="CheckoutManager.checkout.fieldAnswers" :error-box="errorBox" />
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </form>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, EmailInput, ErrorBox, FieldBox, LoadingButton, PhoneInput, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
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
        BackButton,
        FieldBox
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

    get fields() {
        return this.webshop.meta.customFields
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

        // Clear old open fields

        try {
            const nextStep = await CheckoutStepsManager.getNextStep(CheckoutStepType.Customer, true)
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
        UrlHelper.setUrl("/checkout/"+CheckoutStepType.Customer.toLowerCase())
    }
}
</script>

