<template>
    <div class="st-view boxed">
        <STNavigationBar title="Financiële ondersteuning">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>
        <div class="box">
            <main>
                <h1>Financiële ondersteuning</h1>
                <p>We doen ons best om de kostprijs van onze activiteiten zo laag mogelijk te houden. Daarnaast voorzien we middelen om gezinnen die dat nodig hebben te ondersteunen. Om de drempel zo laag mogelijk te houden, voorzien we een discrete checkbox waarmee je kan aangeven dat je ondersteuning nodig hebt. We gaan hier uiterst discreet mee om.</p>

                <STErrorsDefault :error-box="errorBox" />

                <Checkbox v-model="reduced">
                    Mijn gezin heeft nood aan financiële ondersteuning en ik wil dit discreet kenbaar maken
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
import { Record, RecordType } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Watch } from "vue-property-decorator";

import { CheckoutManager } from "../../classes/CheckoutManager";
import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from "../../classes/OrganizationManager";
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
    }

    @Watch("reduced")
    onChangeReduced() {
        if (this.reduced) {
            for (const item of CheckoutManager.checkout.cart.items) {
                item.reduced = true
            }
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
            let needsSync = false;
            if (this.reduced) {
                // Update reduced
                for (const item of CheckoutManager.checkout.cart.items) {
                    const member = item.member
                    if (!member.details.records.find(r => r.type == RecordType.FinancialProblems)) {
                        member.details.records.push(Record.create({
                            type: RecordType.FinancialProblems
                        }))
                        needsSync = true;
                    }
                    item.reduced = true
                }
                
            } else {
                // Update reduced
                for (const item of CheckoutManager.checkout.cart.items) {
                    const member = item.member
                    const i = member.details.records.findIndex(r => r.type == RecordType.FinancialProblems)
                    if (i != -1) {
                        member.details.records.splice(i, 1);
                        needsSync = true;
                    }
                    item.reduced = false
                }
            }

            if (needsSync) {
                await MemberManager.patchAllMembersWith(...CheckoutManager.checkout.cart.items.map(i => i.member))
            }
            
            this.loading = false
            this.show(new ComponentWithProperties(PaymentSelectionView, {}))
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>