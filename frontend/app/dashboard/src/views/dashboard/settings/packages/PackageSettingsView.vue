<template>
    <div class="st-view background">
        <STNavigationBar title="Mijn paketten">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Jouw pakketten
            </h1>

            <p>
                Onderaan kan je nieuwe pakketten activeren. Alle bedragen zijn excl. BTW, tenzij anders vermeld.
            </p>
            
            <STErrorsDefault :error-box="errorBox" />

            <Spinner v-if="loadingStatus" />
            <template v-else>
                <STList v-if="status && status.packages.length > 0">
                    <STListItem v-for="pack of status.packages" :key="pack.id" :selectable="true" class="right-stack " @click="openPackageDetails(pack)">
                        <img v-if="getPackageIcon(pack)" slot="left" :src="getPackageIcon(pack)">

                        <h3 class="style-title-list">
                            {{ pack.meta.name }}
                        </h3>
                        <p v-if="pack.validUntil" class="style-description">
                            Geldig tot {{ pack.validUntil | date }}
                        </p>

                        <button v-if="pack.shouldHintRenew()" slot="right" class="button text gray">
                            Verleng nu
                        </button>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>

                <p v-if="status && status.packages.length == 0" class="info-box">
                    Je hebt momenteel nog geen pakketten geactiveerd
                </p>

                <hr>
                <h2>Nieuwe functies activeren</h2>

                <p v-if="availablePackages.length === 0" class="info-box">
                    Je hebt momenteel alle functies in gebruik. Geweldig! Meer info over alle pakketten kan je terugvinden op <a href="https://www.stamhoofd.be/prijzen" class="inline-link" target="_blank">onze website</a>.
                </p>

                <template v-else>
                    <p>Selecteer de functies die je wilt activeren en klik op 'doorgaan'. Meer info over alle pakketten kan je terugvinden op <a href="https://www.stamhoofd.be/prijzen" class="inline-link" target="_blank">onze website</a>. Neem gerust contact op via hallo@stamhoofd.be als je bijkomende vragen zou hebben.</p>

                    <STList>
                        <STListItem v-for="pack of availablePackages" :key="pack.bundle" element-name="label" :selectable="true">
                            <Checkbox slot="left" v-model="pack.selected" :disabled="!pack.canSelect(availablePackages)" />
                            <h3 class="style-title-list">
                                {{ pack.title }}
                            </h3>
                            <p class="style-description">
                                {{ pack.description }}
                            </p>

                            <p v-if="!pack.canSelect(availablePackages)" slot="right" class="style-description">
                                Niet combineerbaar
                            </p>
                        </STListItem>
                    </STList>
                </template>
            </template>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="loading">
                    <button class="button primary" :disabled="!hasSelected" @click="checkout">
                        Doorgaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, HistoryManager,NavigationMixin } from "@simonbackx/vue-app-navigation";
import cartIcon from "@stamhoofd/assets/images/illustrations/cart.svg"
import experimentIcon from "@stamhoofd/assets/images/illustrations/experiment.svg"
import flagIcon from "@stamhoofd/assets/images/illustrations/flag.svg"
import groupIcon from "@stamhoofd/assets/images/illustrations/group.svg"
import singleCartIcon from "@stamhoofd/assets/images/illustrations/single-cart.svg"
import { BackButton, Checkbox,ErrorBox,LoadingButton, Spinner, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { STBillingStatus, STPackage, STPackageBundle, STPackageBundleHelper, STPackageType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Watch } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import PackageConfirmView from "./PackageConfirmView.vue";
import PackageDetailsView from "./PackageDetailsView.vue";

export class SelectablePackage {
    package: STPackage

    // In case of a renewal, bundle can be empty
    bundle: STPackageBundle

    selected = false

    constructor(pack: STPackage, bundle: STPackageBundle) {
        this.package = pack
        this.bundle = bundle
    }

    get title() {
        return STPackageBundleHelper.getTitle(this.bundle)
    }

    get description() {
        return STPackageBundleHelper.getDescription(this.bundle)
    }

    canSelect(all: SelectablePackage[]) {
        for (const p of all) {
            if (!p.selected || p.package.id === this.package.id) {
                continue
            }
            if (!STPackageBundleHelper.isCombineable(this.bundle, p.package)) {
                this.selected = false
                return false
            }
        }
        return true
    }
}

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        LoadingButton,
        STList,
        STListItem,
        Spinner,
        Checkbox
    },
    filters: {
        price: Formatter.price,
        date: (date: Date) => {
            return Formatter.date(date, true)
        }
    }
})
export default class PackageSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    loadingStatus = true

    status: STBillingStatus | null = null

    availablePackages: SelectablePackage[] = []

    loading = false

    mounted() {
        HistoryManager.setUrl("/settings/packages");
        this.reload().catch(e => {
            console.error(e)
        })
    }

    get hasSelected() {
        return !!this.availablePackages.find(p => p.selected)
    }

    @Watch('status')
    onUpdateStatus() {
        this.updatePackages()
    }

    getPackageIcon(pack: STPackage): string | null {
        switch (pack.meta.type) {
            case STPackageType.Members: {
                if (this.status && this.status.packages.find(p => p.meta.type === STPackageType.LegacyMembers)) {
                    return flagIcon
                }
                return groupIcon
            }
            case STPackageType.LegacyMembers: return groupIcon
            case STPackageType.TrialMembers: return experimentIcon
            case STPackageType.TrialWebshops: return experimentIcon
            case STPackageType.Webshops: return cartIcon
            case STPackageType.SingleWebshop: return singleCartIcon
        }
        return null
    }

    updatePackages() {
        const packages: SelectablePackage[] = []
        const limit = new Date()
        limit.setDate(limit.getDate() + 14)
        for (const bundle of Object.values(STPackageBundle)) {
            if (!STPackageBundleHelper.isPublic(bundle)) {
                continue
            }

            let isCombineable = true
            for (const p of this.status!.packages) {
                if (!STPackageBundleHelper.isCombineable(bundle, p) && (p.validUntil === null || p.validUntil > limit)) {
                    isCombineable = false
                    break;
                }
            }

            if (!isCombineable) {
                continue;
            }

            try {
                const pack = STPackageBundleHelper.getCurrentPackage(bundle, new Date())
                packages.push(new SelectablePackage(pack, bundle))
            } catch (e) {
                console.error(e)
            }
        }
        this.availablePackages = packages
    }

    async reload() {
        this.loadingStatus = true

        try {
            this.status = await OrganizationManager.loadBillingStatus()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.loadingStatus = false
    }

    openPackageDetails(pack: STPackage) {
        this.show(new ComponentWithProperties(PackageDetailsView, {
            pack
        }))
    }

    checkout() {
        if (!this.hasSelected) {
            return
        }
        
        this.show(new ComponentWithProperties(PackageConfirmView, {
            selectedPackages: this.availablePackages.filter(p => p.selected)
        }))
    }
  
    shouldNavigateAway() {
        if (this.loading) {
            return false
        }
        return true
    }
}
</script>