<template>
    <div>
        <p v-if="isPaymentFailed" class="error-box selectable with-button" @click="openBilling">
            Jouw betaling via domiciliëring/kredietkaart is mislukt. Breng de betaling zelf in orde via 'Facturen en betalingen' voor {{ paymentFailedDeactivateDate | dateTime }} om te voorkomen dat sommige functies tijdelijk onbeschikbaar worden.

            <button class="button text" type="button">
                Nakijken
            </button>
        </p>

        <p v-if="!shouldFilter('webshops') && isNearing(webshopDeactivateDate)" class="warning-box selectable with-button" @click="openPackages">
            Jouw webshops worden automatisch uitgeschakeld vanaf {{ webshopDeactivateDate | dateTime }}. Verleng jouw pakket om de webshop module langer in gebruik te houden.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>

        <p v-if="!shouldFilter('webshops') && isWebshopsTrial" class="warning-box selectable with-button" @click="openPackages">
            Je test momenteel de webshops functie. Activeer een pakket als je beslist om ze echt in gebruik te nemen.

            <button class="button text" type="button">
                Activeren
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isMembersTrial" class="warning-box selectable with-button" @click="openPackages">
            Je test momenteel de ledenadministratie functie. Activeer een pakket als je beslist om ze echt in gebruik te nemen.

            <button class="button text" type="button">
                Activeren
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isActivitiesTrial" class="warning-box selectable with-button" @click="openPackages">
            Je test momenteel inschrijvingen voor activiteiten. Activeer het 'ledenadministratie' pakket als je beslist om deze functie in gebruik te nemen.

            <button class="button text" type="button">
                Activeren
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isNearing(membersDeactivateDate)" class="warning-box selectable with-button" @click="openPackages">
            De ledenadministratie wordt uitgeschakeld vanaf {{ membersDeactivateDate | dateTime }}. Verleng jouw pakket om onderbreking van online inschrijvingen en het bekijken van gegevens te voorkomen.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isNearing(membersActivitiesDeactivateDate)" class="warning-box selectable with-button" @click="openPackages">
            De functionaliteiten 'Inschrijven voor activiteiten' worden uitgeschakeld vanaf {{ membersActivitiesDeactivateDate | dateTime }}. Verleng jouw pakket om de nieuwe functies te kunnen blijven gebruiken.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { STPackageType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import BillingSettingsView from "./BillingSettingsView.vue";
import PackageSettingsView from "./PackageSettingsView.vue";

@Component({
    filters: {
        date: Formatter.date.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    },
})
export default class BillingWarningBox extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    filterTypes: "members" | "webshops" | null

    OrganizationManager = OrganizationManager

    shouldFilter(type: "members" | "webshops") {
        if (this.filterTypes === null) {
            return false
        }
        if (this.filterTypes !== type) {
            return true
        }
        return false
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
        return OrganizationManager.organization
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
        if (date === null) {
            return false
        }
        return (date.getTime() - new Date().getTime()) < 1000 * 60 * 60 * 24 * 14
    }

    openPackages() {
        if (!SessionManager.currentSession!.user!.permissions?.hasFullAccess()) {
            new CenteredMessage("Enkel voor hoofdbeheerders", "Het aanpassen van pakketten is enkel beschikbaar voor hoofdbeheerders. Vraag hen om de verlenging in orde te brengen.").addCloseButton().show()
            return
        }
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PackageSettingsView)
        }).setDisplayStyle("popup"))
    }

    openBilling() {
        if (!SessionManager.currentSession!.user!.permissions?.hasFullAccess()) {
            new CenteredMessage("Enkel voor hoofdbeheerders", "Betalingen zijn enkel beschikbaar voor hoofdbeheerders. Vraag hen om de betaling in orde te brengen.").addCloseButton().show()
            return
        }
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(BillingSettingsView)
        }).setDisplayStyle("popup"))
    }

  
}
</script>