<template>
    <div>
        <p v-if="!hasBillingListener && isPaymentFailed" class="error-box selectable with-button" @click="openBilling">
            Jouw betaling via domiciliëring/kredietkaart is mislukt. Breng de betaling zelf in orde via 'Boekhouding → Openstaand bedrag' voor {{ formatDateTime(paymentFailedDeactivateDate) }} om te voorkomen dat sommige functies tijdelijk onbeschikbaar worden.

            <button class="button text" type="button">
                Nakijken
            </button>
        </p>
        <p v-else-if="hasBillingListener && isPaymentFailed" class="error-box selectable with-button" @click="openBilling">
            Een automatische betaling is mislukt. Breng de betaling zelf in orde voor {{ formatDateTime(paymentFailedDeactivateDate) }} om te voorkomen dat sommige functies tijdelijk onbeschikbaar worden.

            <button class="button text" type="button">
                Openen
            </button>
        </p>

        <p v-if="!shouldFilter('webshops') && hasExpired(webshopDeactivateDate)" class="error-box selectable with-button" @click="openPackages">
            Jouw webshops pakket is vervallen. Verleng jouw pakket om jouw webshops te heractiveren en te vermijden dat je gegevens verliest.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>

        <p v-if="!shouldFilter('webshops') && isNearing(webshopDeactivateDate)" class="warning-box selectable with-button" @click="openPackages">
            Jouw webshops worden automatisch uitgeschakeld vanaf {{ formatDateTime(webshopDeactivateDate) }}. Verleng jouw pakket om de webshop module langer in gebruik te houden.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>

        <p v-if="!shouldFilter('webshops') && isWebshopsTrial" class="warning-box selectable with-button" @click="openPackages">
            Je test momenteel de webshops functie. Koop een pakket aan om het echt in gebruik te nemen.

            <button class="button text" type="button">
                Aankopen
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isMembersTrial" class="warning-box selectable with-button" @click="openPackages">
            Je test momenteel de ledenadministratie functie. Koop een pakket aan om het echt in gebruik te nemen.

            <button class="button text" type="button">
                Aankopen
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isActivitiesTrial" class="warning-box selectable with-button" @click="openPackages">
            Je test momenteel inschrijvingen voor activiteiten. Koop een pakket aan om het echt in gebruik te nemen.

            <button class="button text" type="button">
                Aankopen
            </button>
        </p>

        <p v-if="!shouldFilter('members') && hasExpired(membersDeactivateDate)" class="error-box selectable with-button" @click="openPackages">
            Het ledenadministratie pakket is vervallen. Verleng jouw pakket om ervoor te zorgen dat leden terug kunnen inschrijven, en om te voorkomen dat gegevens verloren zullen gaan.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isNearing(membersDeactivateDate)" class="warning-box selectable with-button" @click="openPackages">
            De ledenadministratie wordt uitgeschakeld vanaf {{ formatDateTime(membersDeactivateDate) }}. Verleng jouw pakket om onderbreking van online inschrijvingen en het bekijken van gegevens te voorkomen.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isNearing(membersActivitiesDeactivateDate)" class="warning-box selectable with-button" @click="openPackages">
            De functionaliteiten 'Inschrijven voor activiteiten' worden uitgeschakeld vanaf {{ formatDateTime(membersActivitiesDeactivateDate) }}. Verleng jouw pakket om de nieuwe functies te kunnen blijven gebruiken.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LoadComponent } from "@stamhoofd/components";
import { STPackageType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";


import PackageSettingsView from "./PackageSettingsView.vue";

@Component({
    filters: {
        date: Formatter.date.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    },
    emits: ["billing"]
})
export default class BillingWarningBox extends Mixins(NavigationMixin) {
    @Prop({ default: null })
        filterTypes: "members" | "webshops" | null


    shouldFilter(type: "members" | "webshops") {
        if (this.filterTypes === null) {
            return false
        }
        if (this.filterTypes !== type) {
            return true
        }
        return false
    }

    get hasBillingListener(){
        return !!this.$.vnode.props?.onBilling
    }

    get isWebshopsTrial() {
        return this.organization.meta.packages.isWebshopsTrial
    }

    get isMembersTrial() {
        return this.organization.meta.packages.isMembersTrial
    }

    get isActivitiesTrial() {
        return this.organization.meta.packages.isActivitiesTrial
    }

    get packageTypeList() {
        if (this.filterTypes === null) {
            return Object.values(STPackageType)
        }
        const types: STPackageType[] = []

        if (!this.shouldFilter("members")) {
            types.push(STPackageType.Members, STPackageType.LegacyMembers)
        }

        if (!this.shouldFilter("webshops")) {
            types.push(STPackageType.Webshops, STPackageType.SingleWebshop)
        }

        return types
    }

    get organization() {
        return this.$organization
    }

    get paymentFailedDeactivateDate() {
        let d: Date | null = null
        for (const [type, pack] of this.organization.meta.packages.packages) {
            if (!this.packageTypeList.includes(type)) {
                continue
            }
            if (pack.deactivateDate === null || pack.firstFailedPayment === null) {
                continue
            }
            if (d && d < pack.deactivateDate) {
                continue
            }
            d = pack.deactivateDate
        }
        return d
    }

    get isPaymentFailed() {
        return this.paymentFailedDeactivateDate !== null
    }

    get webshopDeactivateDate() {
        let d: Date | null = null
        for (const [type, pack] of this.organization.meta.packages.packages) {
            if (type === STPackageType.Webshops || type === STPackageType.SingleWebshop) {
                if (pack.deactivateDate === null) {
                    return null
                }
                if (d && d > pack.deactivateDate) {
                    continue
                }
                d = pack.deactivateDate
            }
        }
        return d
    }

    get membersDeactivateDate() {
        let d: Date | null = null
        for (const [type, pack] of this.organization.meta.packages.packages) {
            if (type === STPackageType.Members || type === STPackageType.LegacyMembers) {
                if (pack.deactivateDate === null) {
                    return null
                }
                if (d && d > pack.deactivateDate) {
                    continue
                }
                d = pack.deactivateDate
            }
        }
        return d
    }

    get membersActivitiesDeactivateDate() {
        let d: Date | null = null
        let hasLegacy = false
        for (const [type, pack] of this.organization.meta.packages.packages) {
            if (type === STPackageType.LegacyMembers) {
                hasLegacy = true;
                continue;
            }
            if (type === STPackageType.Members) {
                if (pack.deactivateDate === null) {
                    return null
                }
                if (d && d > pack.deactivateDate) {
                    continue
                }
                d = pack.deactivateDate
            }
        }
        if (!hasLegacy) {
            return null
        }
        return d
    }

    /**
     * Return if date is in less than 2 weeks
     */
    isNearing(date: Date | null) {
        if (this.hasExpired(date)) {
            return false
        }

        if (date === null) {
            return false
        }
        return (date.getTime() - new Date().getTime()) < 1000 * 60 * 60 * 24 * 14
    }

    hasExpired(date: Date | null) {
        if (date === null) {
            return false
        }
        return date <= new Date()
    }

    openPackages() {
        if (!this.$user!.permissions?.hasFinanceAccess(this.organization.privateMeta?.roles ?? [])) {
            new CenteredMessage("Enkel voor hoofdbeheerders", "Het aanpassen van pakketten is enkel beschikbaar voor hoofdbeheerders. Vraag hen om de verlenging in orde te brengen.").addCloseButton().show()
            return
        }
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PackageSettingsView)
        }).setDisplayStyle("popup"))
    }

    async openBilling() {
        if (this.hasBillingListener) {
            this.$emit("billing")
            return
        }

        if (!this.$user!.permissions?.hasFinanceAccess(this.organization.privateMeta?.roles ?? [])) {
            new CenteredMessage("Enkel voor hoofdbeheerders", "Betalingen zijn enkel beschikbaar voor hoofdbeheerders. Vraag hen om de betaling in orde te brengen.").addCloseButton().show()
            return
        }
        this.show({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: await LoadComponent(() => import(/* webpackChunkName: "FinancesView" */ '../FinancesView.vue'), {}, { instant: false })
                })
            ],
            animated: true
        })
    }

  
}
</script>