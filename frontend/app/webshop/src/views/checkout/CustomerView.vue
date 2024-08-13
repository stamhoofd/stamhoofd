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

        <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="$checkoutManager.checkout.fieldAnswers" :error-box="errorBox" />
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { EmailInput, ErrorBox, FieldBox, PhoneInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { WebshopTicketType } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { CheckoutManager } from '../../classes/CheckoutManager';
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
        return this.$context.isComplete() ?? false
    }
    
    get checkoutMethod() {
        return this.$checkoutManager.checkout.checkoutMethod!
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
        return this.$webshopManager.webshop
    }

    get firstName() {
        return this.$checkoutManager.checkout.customer.firstName
    }

    set firstName(firstName: string) {
        this.$checkoutManager.checkout.customer.firstName = firstName
        this.$checkoutManager.saveCheckout()
    } 

    get lastName() {
        return this.$checkoutManager.checkout.customer.lastName
    }

    set lastName(lastName: string) {
        this.$checkoutManager.checkout.customer.lastName = lastName
        this.$checkoutManager.saveCheckout()
    } 

    get email() {
        return this.$checkoutManager.checkout.customer.email
    }

    set email(email: string) {
        this.$checkoutManager.checkout.customer.email = email
        this.$checkoutManager.saveCheckout()
    } 

    get phone() {
        return this.$checkoutManager.checkout.customer.phone
    }

    set phone(phone: string) {
        this.$checkoutManager.checkout.customer.phone = phone
        this.$checkoutManager.saveCheckout()
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
            await CheckoutStepsManager.for(this.$checkoutManager).goNext(CheckoutStepType.Customer, this)
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }
}
</script>

