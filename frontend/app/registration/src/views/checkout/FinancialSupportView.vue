<template>
    <div class="st-view boxed">
        <STNavigationBar title="Financiële ondersteuning">
            <BackButton v-if="canPop" slot="left" @click="pop" />

            <button v-if="canDismiss" slot="right" class="button icon close" @click="dismiss"></button>
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
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from "../../classes/CheckoutManager";
import { MemberManager } from '../../classes/MemberManager';
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
    }
})
export default class FinancialSupportView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    CheckoutManager = CheckoutManager
    step = 2

    reduced = false
    loading = false
    errorBox: ErrorBox | null = null

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
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>