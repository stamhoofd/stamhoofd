<template>
    <div id="financial-support-view" class="st-view boxed">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>
        <div class="box">
            <main>
                <h1>{{ title }}</h1>
                <p class="style-description pre-wrap" v-text="description" />

                <STErrorsDefault :error-box="errorBox" />

                <Checkbox v-model="reduced">
                    {{ checkboxLabel }}
                </Checkbox>
            </main>

            <STToolbar>
                <span slot="left">Totaal: {{ cart.price | price }}</span>
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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, ErrorBox, LoadingButton, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { BooleanStatus } from "@stamhoofd/structures";
import { FinancialSupportSettings } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Watch } from "vue-property-decorator";

import { CheckoutManager } from "../../classes/CheckoutManager";
import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from "../../classes/OrganizationManager";
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
    MemberManager = MemberManager
    CheckoutManager = CheckoutManager

    reduced = false
    loading = false
    errorBox: ErrorBox | null = null

    mounted() {
        this.reduced = !!CheckoutManager.checkout.cart.items.find(i => i.reduced)

        if (!this.reduced) {
            for (const item of CheckoutManager.checkout.cart.items) {
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
        return OrganizationManager.organization.meta.recordsConfiguration.financialSupport ?? FinancialSupportSettings.create({})
    }

    @Watch("reduced")
    onChangeReduced() {
        if (this.reduced) {
            for (const item of CheckoutManager.checkout.cart.items) {
                item.reduced = true
            }
            CheckoutManager.cart.freeContribution = 0
        } else {
            for (const item of CheckoutManager.checkout.cart.items) {
                item.reduced = false
            }
        }
        this.recalculate()
    }

    async goNext() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            if (this.reduced) {
                for (const item of CheckoutManager.checkout.cart.items) {
                    const member = item.member
                    // Check if we are allowed to gather this information
                    member.details.requiresFinancialSupport = BooleanStatus.create({ value: true })
                    item.reduced = true
                }
                
            } else {
                for (const item of CheckoutManager.checkout.cart.items) {
                    const member = item.member
                    member.details.requiresFinancialSupport = BooleanStatus.create({ value: false })
                    item.reduced = false
                }
            }

            await MemberManager.patchAllMembersWith(...CheckoutManager.checkout.cart.items.map(i => i.member))
            
            this.loading = false

            // TODO: check if free contribution is enabled
            if (!this.reduced && OrganizationManager.organization.meta.recordsConfiguration.freeContribution !== null) {
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
        return this.CheckoutManager.cart
    }

    recalculate() {
        try {
            this.cart.validate(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
            this.errorBox = null
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        try {
            this.cart.calculatePrices(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
        } catch (e) {
            // error in calculation!
            console.error(e)
        }
        CheckoutManager.saveCart()
    }
}
</script>