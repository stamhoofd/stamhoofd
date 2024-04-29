<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-balance-item-view" :loading="loading" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errorBox" />

        <p v-if="!hasPayments(patchedBalanceItem)" class="warning-box">
            Een afrekening (= de schuld) wijzigen die al gebruikt werd in een aangemaakte betaling (= hoe de schuld betaald werd) zal enkel het openstaande bedrag wijzigen. Een betaling is niet meer aanpasbaar na het aanmaken ervan. Indien je het bedrag van een betaling wilt wijzigen moet je ofwel een extra betaling aanmaken voor het verschil of de betaling annuleren en opnieuw aanmaken.
        </p>

        <div class="split-inputs">
            <div>
                <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox">
                    <input
                        ref="firstInput"
                        v-model="description"
                        class="input"
                        type="text"
                        placeholder="Bv. Aankoop T-shirt"
                        autocomplete=""
                    >
                </STInputBox>

                <STInputBox title="Prijs" error-fields="price" :error-box="errorBox">
                    <PriceInput v-model="price" placeholder="Gratis" :min="null" :disabled="!!balanceItem.order" />
                </STInputBox>
            </div>
            <div>
                <STInputBox title="Datum" error-fields="createdAt" :error-box="errorBox">
                    <DateSelection v-model="createdAt" />
                </STInputBox>
            </div>
        </div>

        <template v-if="familyManager.members.length > 1 && member">
            <STInputBox title="Lid" error-fields="memberId" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-for="member in familyManager.members" :key="member.id" v-model="memberId" :value="member.id">
                        {{ member.name }}
                    </Radio>
                </RadioGroup>
            </STInputBox>
        </template>

        <template v-if="patchedBalanceItem.registration">
            <hr>
            <h2>Aangerekend voor</h2>

            <STList>
                <MemberRegistrationBlock :registration="patchedBalanceItem.registration" @edit="linkRegistration" />
            </STList>
        </template>

        <button v-else-if="member" class="button text" type="button" @click="linkRegistration">
            <span class="icon link" /><span>Koppelen aan inschrijving</span>
        </button>

        <template v-if="!isNew && hasPayments(patchedBalanceItem)">
            <hr>
            <h2>Betaalpogingen</h2>
            <p>Een openstaand bedrag kan door een lid betaald worden via het ledenportaal. Daar kan men via één van de ingestelde betaalmethodes afrekenen. Meerdere openstaande bedragen (ook over meerdere leden heen als een account meerdere leden beheert) kunnen in één keer betaald worden, vandaar dat het bedrag van een betaling vaak hoger is dan het bedrag van een individuele afrekening.</p>

            <p v-if="patchedBalanceItem.payments.length == 0" class="info-box">
                Er werd nog geen betaling aangemaakt voor deze afrekening
            </p>

            <STList v-else>
                <STListItem v-for="payment of patchedBalanceItem.payments" :key="payment.id" :selectable="true" class="right-stack" @click="openPayment(payment.payment)">
                    <h3 class="style-title-list">
                        {{ getPaymentMethodName(payment.payment.method) }}
                        <template v-if="payment.payment.price < 0">
                            (terugbetaling)
                        </template>
                    </h3>
                    <p v-if="payment.payment.price >= 0" class="style-description-small">
                        Totaalbedrag is {{ formatPrice(payment.payment.price) }}, waarvan {{ formatPrice(payment.price) }} bestemd voor deze aanrekening
                    </p>
                    <p v-else class="style-description-small">
                        Er werd {{ formatPrice(-payment.payment.price) }} terugbetaald
                    </p>

                    <p v-if="formatDate(payment.payment.createdAt) !== formatDate(payment.payment.paidAt)" class="style-description-small">
                        Aangemaakt op {{ formatDate(payment.payment.createdAt) }}
                    </p>
                    <p v-if="payment.payment.paidAt && payment.payment.price >= 0" class="style-description-small">
                        Betaald op {{ formatDate(payment.payment.paidAt) }}
                    </p>
                    <p v-else-if="payment.payment.paidAt" class="style-description-small">
                        Terugbetaald op {{ formatDate(payment.payment.paidAt) }}
                    </p>

                    <span v-if="payment.payment.isFailed" slot="right" class="style-tag error">Mislukt</span>
                    <span v-else-if="payment.payment.isPending" slot="right" class="style-tag warn">In verwerking</span>
                    <span v-else-if="payment.payment.isSucceeded" slot="right" class="style-tag success">{{ formatPrice(payment.payment.price) }}</span>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>
            </STList>

            <div v-if="patchedBalanceItem.payments.length > 0" class="pricing-box">
                <STList>
                    <STListItem>
                        Betaald

                        <template #right>
                            {{ formatPrice(outstanding.paid) }}
                        </template>
                    </STListItem>

                    <STListItem>
                        Nog te betalen

                        <template #right>
                            {{ formatPrice(outstanding.remaining) }}
                        </template>
                    </STListItem>

                    <STListItem v-if="outstanding.pending">
                        Waarvan in verwerking

                        <template #right>
                            {{ formatPrice(outstanding.pending) }}
                        </template>
                    </STListItem>
                </STList>
            </div>

            <template v-if="outstanding.pending === 0 && outstanding.paid === 0">
                <hr>
                <h2>Acties</h2>

                <STList>
                    <STListItem :selectable="true" @click="doDelete">
                        <h2 class="style-title-list">
                            Verwijder deze aanrekening
                        </h2>
                        <button slot="right" type="button" class="button secundary danger hide-smartphone">
                            <span class="icon trash" />
                            <span>Verwijderen</span>
                        </button>
                        <button slot="right" type="button" class="button icon trash only-smartphone" />
                    </STListItem>
                </STList>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, DateSelection,ErrorBox, PriceInput, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { BalanceItem, BalanceItemDetailed, BalanceItemStatus } from '@stamhoofd/structures';
import { MemberBalanceItem, Payment, PaymentMethod, PaymentMethodHelper, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../../classes/FamilyManager';

import PaymentView from '../../payments/PaymentView.vue';
import MemberRegistrationBlock from '../MemberRegistrationBlock.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        STListItem,
        STList,
        MemberRegistrationBlock,
        RadioGroup,
        Radio,
        DateSelection
    },
})
export default class EditBalanceItemView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        balanceItem!: MemberBalanceItem|BalanceItemDetailed

    @Prop({ required: true })
        isNew!: boolean
    
    patchBalanceItem: AutoEncoderPatchType<BalanceItem> = this.balanceItem instanceof MemberBalanceItem ? MemberBalanceItem.patch({}) : BalanceItemDetailed.patch({})

    @Prop({ required: true })
        saveHandler: ((patch: AutoEncoderPatchType<BalanceItem>) => Promise<void>);

    familyManager = new FamilyManager(this.$memberManager, []);

    get title() {
        return this.isNew ? 'Verschuldigd bedrag toevoegen' : 'Verschuldigd bedrag bewerken';
    }

    mounted() {
        // Load family if connected to a member
        if (this.balanceItem.memberId) {
            // Load family
            this.familyManager.loadFamily(this.balanceItem.memberId).catch(console.error)
        }
    }

    get member() {
        return this.familyManager.members.find(m => m.id == this.balanceItem.memberId)
    }

    get patchedBalanceItem() {
        return this.balanceItem.patch(this.patchBalanceItem)
    }

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<BalanceItem>>|PartialWithoutMethods<AutoEncoderPatchType<MemberBalanceItem>>) {
        this.patchBalanceItem = this.patchBalanceItem.patch(patch)
    }

    linkRegistration(event) {
        if (!this.member) {
            return
        }
        const member = this.member

        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: 'Geen',
                    action: () => {
                        this.addPatch({
                            registration: null
                        })
                        return false;
                    }
                })
            ],
            member.registrations.map(r => {
                const group = this.$organization.groups.find(g => g.id === r.groupId)
                return new ContextMenuItem({
                    name: group?.settings.name ?? '?',
                    description: r.cycle === group?.cycle ? 'Huidige periode' : ((group?.cycle ?? 0) - r.cycle) + " periode(s) geleden",
                    action: () => {
                        this.addPatch({
                            registration: r
                        })
                        return false;
                    }
                })
            })
        ])

        menu.show({clickEvent: event}).catch(console.error)
    }

    get description() {
        return this.patchedBalanceItem.description;
    }

    set description(description: string) {
        this.addPatch({
            description
        })
    }

    get price() {
        return this.patchedBalanceItem.price;
    }

    set price(price: number) {
        this.addPatch({
            price
        })
    }

    get createdAt() {
        return this.patchedBalanceItem.createdAt;
    }

    set createdAt(createdAt: Date) {
        this.addPatch({
            createdAt
        })
    }

    get memberId() {
        return this.patchedBalanceItem.memberId;
    }

    set memberId(memberId: string | null) {
        this.addPatch({
            memberId,
            registration: null
        })
    }

    formatDate(date: Date) {
        return Formatter.date(date, true)
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    getPaymentMethodName(method: PaymentMethod) {
        return PaymentMethodHelper.getNameCapitalized(method);
    }

    hasPayments(balanceItem: MemberBalanceItem|BalanceItemDetailed): balanceItem is MemberBalanceItem {
        return (balanceItem instanceof MemberBalanceItem)
    }
    
    get outstanding() {
        if (!this.hasPayments(this.patchedBalanceItem)) {
            return {
                paid: 0,
                pending: 0,
                remaining: 0
            }
        }
        const paid = this.patchedBalanceItem.payments.filter(p => p.payment.isSucceeded).map(p => p.price).reduce((a, b) => a + b, 0)
        const pending = this.patchedBalanceItem.payments.filter(p => p.payment.isPending).map(p => p.price).reduce((a, b) => a + b, 0)
        const remaining = this.patchedBalanceItem.price - paid

        return {
            paid,
            pending,
            remaining
        }
    }

    loading = false

    async save() {
        if (this.loading) {
            return
        }
        this.errorBox = null;

        try {
            const valid = await this.validator.validate();
            if (!valid) {
                return;
            }
            this.loading = true
            await this.saveHandler(this.patchBalanceItem)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e);
        }
        this.loading = false
    }

    async doDelete() {
        if (this.loading) {
            return
        }
        if (!(await CenteredMessage.confirm("Deze aanrekening verwijderen?", "Verwijderen", "Je kan dit niet ongedaan maken."))) {
            return
        }

        this.errorBox = null;

        try {
            this.loading = true
            await this.saveHandler(MemberBalanceItem.patch({
                status: BalanceItemStatus.Hidden,
                price: 0
            }))
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e);
        }
        this.loading = false
    }

    get hasChanges() {
        return patchContainsChanges(this.patchBalanceItem, this.balanceItem, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    openPayment(payment: Payment) {
        const component = new ComponentWithProperties(PaymentView, {
            initialPayment: payment
        })
        this.present({
            components: [component],
            modalDisplayStyle: "popup"
        })
    }
}
</script>
