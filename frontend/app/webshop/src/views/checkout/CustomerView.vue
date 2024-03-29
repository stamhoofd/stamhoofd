<template>
    <SaveView title="Jouw gegevens" :loading="loading" save-icon-right="arrow-right" save-text="Doorgaan" data-submit-last-field @save="goNext">
        <h1>Jouw gegevens</h1>

        <STErrorsDefault :error-box="errorBox" />

        <template v-if="!isLoggedIn">
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

            <EmailInput v-model="email" title="E-mailadres" name="email" :validator="validator" :placeholder="emailPlaceholder" autocomplete="email" />
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription" />
        </template>

        <PhoneInput v-if="phoneEnabled" v-model="phone" :title="$t('shared.inputs.mobile.label' )" name="mobile" :validator="validator" placeholder="Voor dringende info" autocomplete="tel" />

        <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="CheckoutManager.checkout.fieldAnswers" :error-box="errorBox" />
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { EmailInput, ErrorBox, FieldBox, PhoneInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { WebshopTicketType } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';


@Component({
    components: {
        STList,
        STListItem,
        STErrorsDefault,
        STInputBox,
        EmailInput,
        PhoneInput,
        SaveView,
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

    get phoneEnabled() {
        return this.webshop.meta.phoneEnabled
    }

    get isLoggedIn() {
        return SessionManager.currentSession?.isComplete() ?? false
    }
    
    get checkoutMethod() {
        return CheckoutManager.checkout.checkoutMethod!
    }

    get emailPlaceholder() {
        if (this.webshop.meta.ticketType !== WebshopTicketType.None) {
            return 'Voor tickets'
        }
        return 'Voor bevestigingsemail'
    }

    get emailDescription() {
        if (this.webshop.meta.ticketType !== WebshopTicketType.None) {
            return 'Je ontvangt jouw tickets op dit e-mailadres. Kijk het goed na.'
        }
        return null
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
            await CheckoutStepsManager.goNext(CheckoutStepType.Customer, this)
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

