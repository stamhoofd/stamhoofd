<template>
    <div class="st-view">
        <STNavigationBar title="Overschrijvingen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>

            <template #right>
                <input v-model="searchQuery" class="input search" placeholder="Zoeken">
            </template>
        </STNavigationBar>

        <main>
            <h1>Overschrijvingen</h1>
            <p>Hier kan je de betalingen van het lidgeld opvolgen. We bekijken momenteel een mogelijkheid om dit op een betaalbare manier te automatiseren, maar hier komt veel bij kijken. Online betalingen zijn helaas erg duur, en onbetaalbaar voor veel verenigingen. Moesten jullie het toch overwegen om 39 cent per Bancontact betaling, of 20 cent per Payconiq betaling te betalen, kan je ons contacteren en kunnen we dit voor jullie activeren. Online betalingen bij feitelijke verenigingen is ook niet mogelijk.</p>
    
            <p class="warning-box">We raden aan om één keer per week de overschrijvingen na te kijken. Daarna kan je dat afbouwen tot één keer per maand. Gebruik de zoekfunctie om het werk te versnellen. De middelste 4 cijfers van een mededeling zijn altijd uniek en kan je gebruiken om te zoeken naar bv. /0015/. Je kan ook zoeken op naam of familienaam van de ouders.</p>

            <Spinner v-if="loading"/>
            <STList v-else>
                <STListItem v-for="payment in payments" :key="payment.id" :selectable="true" class="right-stack right-description" element-name="label">
                    <Checkbox slot="left"/>

                    <h2 class="style-title-list">{{ payment.registrations.map(r => r.member.details.name).join(", ") }}</h2>
                    <p class="style-description-small">{{ payment.createdAt | date }}</p>
                    <p class="style-description-small">{{ payment.transferDescription }}</p>
                    
                    <template slot="right">
                        <span>{{ payment.price | price }}</span>
                        <span v-if="getPaymentTiming(payment) == 'Succeeded'" class="icon success green" v-tooltip="'Betaald op '+payment.paidAt"></span>
                        <span v-else-if="getPaymentTiming(payment) == 'Pending'" class="icon clock gray" v-tooltip="'Wacht op betaling, zou intussen overgeschreven moeten zijn. Je kan deze al een herinnering sturen.'"></span>
                        <span v-else-if="getPaymentTiming(payment) == 'Late'" class="icon error red" v-tooltip="'Na meer dan een maand nog steeds niet betaald'"></span>
                        <span v-else-if="getPaymentTiming(payment) == 'New'" class="icon new gray" v-tooltip="'Recente inschrijving, betaling kan mogelijks nog niet aangekomen zijn (minder dan 3 werkdagen geleden)'"></span>
                    </template>
                </STListItem>
            </STList>
            
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary">Niet betaald</button>
                <button class="button primary">Markeer als betaald</button>
            </template>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, CenteredMessage, BackButton, Spinner, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings, OrganizationPatch, EncryptedPaymentDetailed, PaymentDetailed, RegistrationWithMember, PaymentStatus } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditGroupView from './EditGroupView.vue';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { MemberManager } from '../../../classes/MemberManager';
import { Formatter } from '@stamhoofd/utility';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Spinner,
        BackButton
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter)
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class PaymentsView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    loading = false
    searchQuery = ""
    payments: PaymentDetailed[] = []

    mounted() {
        this.loading = true

        this.loadPayments().catch((e) => {
            console.error(e)
        }).finally(() => {
            this.loading = false
        })
    }

    calculateWorkDaysSince(d: Date) {
        const date = new Date(d.getTime())
        const now = new Date()
        now.setHours(12, 0, 0, 0)
        date.setHours(12, 0, 0, 0)

        let days = 0
        while(date < now) {
            if (date.getDay() != 0 && date.getDay() != 6) {
                days++
            }
            date.setDate(date.getDate() + 1)
        }
        return days;
    }

    getPaymentTiming(payment: PaymentDetailed) {
        if (payment.status == PaymentStatus.Succeeded) {
            return "Succeeded"
        }

        if (payment.status == PaymentStatus.Failed) {
            return "Failed"
        }

        const workDays = this.calculateWorkDaysSince(payment.createdAt)
        if (workDays > 20) {
            return "Late"
        }

        // Weekdays between now and creation
        if (workDays > 3) {
            return "Pending"
        }

        return "New"
    }

    getPaymentTimingOrder(payment: PaymentDetailed) {
        switch(this.getPaymentTiming(payment)) {
            case "Failed": return 1;
            case "Late": return 2;
            case "Pending": return 3;
            case "New": return 4;
            case "Succeeded": return 5;
        }
    }

    async loadPayments(groupId: string | null = null) {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/payments",
            decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
        })

        console.log("Received response. Decryping...")

        const organization = OrganizationManager.organization

        // Decrypt data
        const payments: PaymentDetailed[] = []
        for (const encryptedPayment of response.data) {
            // Create a detailed payment without registrations
            const payment = PaymentDetailed.create({...encryptedPayment, registrations: []})

            // Decrypt the members and add them one by one
            for (const registration of encryptedPayment.registrations) {
                const group = organization.groups.find(g => g.id == registration.groupId)
                if (!group) {
                    // todo: create a fallback group
                    throw new Error("Group not found")
                }

                const [member] = await MemberManager.decryptMembersWithoutRegistrations([registration.member])

                payment.registrations.push(RegistrationWithMember.create({
                    ...registration,
                    member,
                    group,
                    payment
                }))
            }

            payments.push(payment)
        }
        console.log("Done.")

        // Sort
        payments.sort((a, b) => {
            const sa = this.getPaymentTimingOrder(a)
            const sb = this.getPaymentTimingOrder(b)

            if (sa == sb) {
                return b.createdAt.getTime() - a.createdAt.getTime()
            }
            return sa - sb;
        })

        this.payments = payments

    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';


</style>
