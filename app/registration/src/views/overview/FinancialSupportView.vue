<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Financiële ondersteuning</h1>
                <p>We doen ons best om de kostprijs van onze activiteiten zo laag mogelijk te houden. Daarnaast voorzien we middelen om gezinnen die dat nodig hebben te ondersteunen. Om de drempel zo laag mogelijk te houden, voorzien we een discrete checkbox waarmee je kan aangeven dat je ondersteuning nodig hebt. We gaan hier uiterst discreet mee om.</p>

                <STErrorsDefault :error-box="errorBox" />

                <Checkbox v-model="reduced">Mijn gezin heeft nood aan financiële ondersteuning en ik wil dit discreet kenbaar maken</Checkbox>
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right"/>
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins,  Prop } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingButton, Checkbox, ErrorBox, STErrorsDefault } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, RegisterMembers, RegisterMember, PaymentMethod, Payment, PaymentStatus, RegisterResponse, KeychainedResponse, RecordType, Record } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import TransferPaymentView from './TransferPaymentView.vue';
import { SessionManager } from '@stamhoofd/networking';
import { Decoder } from '@simonbackx/simple-encoding';
import RegistrationSuccessView from './RegistrationSuccessView.vue';
import PaymentSelectionView from './PaymentSelectionView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        LoadingButton,
        STErrorsDefault
    }
})
export default class FinancialSupportView extends Mixins(NavigationMixin){
    MemberManager = MemberManager
    step = 2

    @Prop({ required: true })
    selectedMembers: MemberWithRegistrations[]

    reduced = false
    loading = false
    errorBox: ErrorBox | null = null

    async goNext() {
        if (this.loading) {
            return
        }
        const session = SessionManager.currentSession!
        this.loading = true

        try {
            let needsSync = false;
            if (this.reduced) {
                // Update reduced
                for (const member of this.selectedMembers) {
                    if (!member.details!.records.find(r => r.type == RecordType.FinancialProblems)) {
                        member.details!.records.push(Record.create({
                            type: RecordType.FinancialProblems
                        }))
                        needsSync = true;
                    }
                }
            } else {
                // Update reduced
                for (const member of this.selectedMembers) {
                    const i = member.details!.records.findIndex(r => r.type == RecordType.FinancialProblems)
                    if (i != -1) {
                        member.details!.records.splice(i, 1);
                        needsSync = true;
                    }
                }
            }

            if (needsSync) {
                await MemberManager.patchAllMembersWith(...this.selectedMembers)
            }
            
            this.loading = false

            this.show(new ComponentWithProperties(PaymentSelectionView, {
                reduced: this.reduced,
                selectedMembers: this.selectedMembers
            }))
            
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