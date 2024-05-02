<template>
    <div id="free-contribution-view" class="st-view">
        <STNavigationBar title="Vrije bijdrage" />
        <main>
            <h1>Vrije bijdrage <span class="style-tag">Optioneel</span></h1>
            <p v-if="description" class="style-description pre-wrap" v-text="description" />

            <STErrorsDefault :error-box="errorBox" />

            <Radio v-model="amountOption" :value="0" name="contributionRadio">
                Geen vrije bijdrage
            </Radio>

            <Radio v-for="(a, index) in amounts" :key="index" v-model="amountOption" :value="a" name="contributionRadio">
                {{ formatPrice(a) }}
            </Radio>
            
            <Radio v-model="amountOption" :value="otherValue" name="contributionRadio">
                {{ amounts.length == 0 ? 'Bedrag kiezen' : 'Ander bedrag kiezen' }}
            </Radio>

            <div v-if="amountOption === otherValue" class="textarea-container">
                <PriceInput v-model="amount" placeholder="Jouw bijdrage" />
            </div>

            <p v-if="amount >= 5000" class="info-box">
                Heel erg bedankt voor de gulle bijdrage! 😍❤️
            </p>

            <p v-else-if="amount >= 3000" class="info-box">
                Heel erg bedankt voor de gulle bijdrage! 😍
            </p>

            <p v-else-if="amount >= 1500" class="info-box">
                Bedankt voor de warme bijdrage! 🙌
            </p>     

            <p v-else-if="amount > 0" class="info-box">
                Bedankt voor de bijdrage 😊
            </p>              
        </main>

        <STToolbar>
            <template #left>
                <span>Totaal: {{ formatPrice(cart.price) }}</span>
            </template>
            
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goNext">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox, LoadingButton, PriceInput, Radio, RadioGroup, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Watch } from "@simonbackx/vue-app-navigation/classes";


import PaymentSelectionView from './PaymentSelectionView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        RadioGroup,
        Radio,
        LoadingButton,
        STErrorsDefault,
        BackButton,
        PriceInput
    },
    filters: {
        price: Formatter.price.bind(Formatter),
    }
})
export default class FreeContributionView extends Mixins(NavigationMixin){
    
    

    amountOption = this.amounts.includes(this.cart.freeContribution) || this.cart.freeContribution == 0 ? this.cart.freeContribution : (this.otherValue)
    amount = this.cart.freeContribution
    loading = false
    errorBox: ErrorBox | null = null

    get otherValue() {
        if (this.amounts.length == 0) {
            return 1000
        }
        return Math.max(...this.amounts) + 1000
    }

    get amounts() {
        return (this.$organization.meta.recordsConfiguration.freeContribution?.amounts ?? []).filter(a => a > 0)
    }

    get description() {
        return this.$organization.meta.recordsConfiguration.freeContribution?.description ?? ""  
    }

    @Watch("amountOption")
    onChangeOption() {
        this.amount = this.amountOption
    }

    @Watch("amount")
    onChangeAmount() {
        this.cart.freeContribution = this.amount
        this.recalculate().catch(console.error)
    }

    goNext() {
        this.show(new ComponentWithProperties(PaymentSelectionView, {}))
    }

    get cart() {
        return this.$checkoutManager.cart
    }

    async recalculate() {
        try {
            await this.$checkoutManager.recalculateCart()
            this.errorBox = null
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#free-contribution-view {
    .style-description {
        padding-bottom: 20px;
    }

    .textarea-container {
        padding-bottom: 20px;
        padding-left: 35px;
        max-width: 200px;

        @media (max-width: 450px) {
            padding-left: 0;
        }
    }
}
</style>
