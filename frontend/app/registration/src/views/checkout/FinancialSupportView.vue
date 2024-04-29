<template>
    <div id="financial-support-view" class="st-view">
        <STNavigationBar :title="title" :pop="canPop" :dismiss="canDismiss" />
        <main>
            <h1>{{ title }}</h1>
            <p class="style-description pre-wrap" v-text="description" />

            <STErrorsDefault :error-box="errorBox" />

            <Checkbox v-model="reduced">
                {{ checkboxLabel }}
            </Checkbox>
        </main>

        <STToolbar>
            <span slot="left">Totaal: {{ formatPrice(cart.price) }}</span>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" type="button" @click="goNext">
                    <span>Doorgaan</span>
                    <span class="icon arrow-right" />
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, ErrorBox, LoadingButton, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { BooleanStatus, FinancialSupportSettings } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Watch } from "vue-property-decorator";


import FreeContributionView from "./FreeContributionView.vue";
import PaymentSelectionView from './PaymentSelectionView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        LoadingButton,
        STErrorsDefault,
        BackButton
    },
    filters: {
        price: Formatter.price.bind(Formatter),
    }
})
export default class FinancialSupportView extends Mixins(NavigationMixin){
    
    

    reduced = false
    loading = false
    errorBox: ErrorBox | null = null

    mounted() {
        this.reduced = !!this.$checkoutManager.checkout.cart.items.find(i => i.reduced)

        if (!this.reduced) {
            for (const item of this.$checkoutManager.checkout.cart.items) {
                const member = item.member
                if (member.details.requiresFinancialSupport?.value) {
                    this.reduced = true;
                    break;
                }
            }
        }
    }

    get title() {
        return this.settings.title || FinancialSupportSettings.defaultTitle
    }

    get description() {
        return this.settings.description || FinancialSupportSettings.defaultDescription
    }

    get checkboxLabel() {
        return this.settings.checkboxLabel || FinancialSupportSettings.defaultCheckboxLabel
    }

    get settings(): FinancialSupportSettings {
        return this.$organization.meta.recordsConfiguration.financialSupport ?? FinancialSupportSettings.create({})
    }

    @Watch("reduced")
    onChangeReduced() {
        if (this.reduced) {
            for (const item of this.$checkoutManager.checkout.cart.items) {
                item.reduced = true
            }
            this.$checkoutManager.cart.freeContribution = 0
        } else {
            for (const item of this.$checkoutManager.checkout.cart.items) {
                item.reduced = false
            }
        }
        this.recalculate().catch(console.error)
    }

    async goNext() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            if (this.reduced) {
                for (const item of this.$checkoutManager.checkout.cart.items) {
                    const member = item.member
                    // Check if we are allowed to gather this information
                    member.details.requiresFinancialSupport = BooleanStatus.create({ value: true })
                    item.reduced = true
                }
                
            } else {
                for (const item of this.$checkoutManager.checkout.cart.items) {
                    const member = item.member
                    member.details.requiresFinancialSupport = BooleanStatus.create({ value: false })
                    item.reduced = false
                }
            }

            await this.$memberManager.patchAllMembersWith(...this.$checkoutManager.checkout.cart.items.map(i => i.member))
            
            this.loading = false

            // TODO: check if free contribution is enabled
            if (!this.reduced && this.$organization.meta.recordsConfiguration.freeContribution !== null) {
                this.show(new ComponentWithProperties(FreeContributionView, {}))
            } else {
                this.show(new ComponentWithProperties(PaymentSelectionView, {}))
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.loading = false
        }
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