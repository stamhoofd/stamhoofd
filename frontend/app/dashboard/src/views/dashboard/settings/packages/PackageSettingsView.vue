<template>
    <div class="st-view background">
        <STNavigationBar title="Mijn paketten" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Functionaliteiten activeren
            </h1>
            
            <STErrorsDefault :error-box="errorBox" />

            <Spinner v-if="loadingStatus && status === null" />
            <template v-else>
                <p v-if="availablePackages.length === 0" class="info-box">
                    <span>Geweldig! Je hebt gebruikt momenteel alle functies. Meer info over alle prijzen kan je terugvinden op <a :href="'https://'+$t('shared.domains.marketing')+'/prijzen'" class="inline-link" target="_blank">onze website</a>.</span>
                </p>

                <template v-else>
                    <p class="style-description-block">
                        Kies de functies die je wilt activeren. Meer info over alle prijzen kan je terugvinden op <a :href="'https://'+$t('shared.domains.marketing')+'/prijzen'" class="inline-link" target="_blank">onze website</a>.
                    </p>

                    <STList>
                        <STListItem v-for="pack of availablePackages" :key="pack.bundle" element-name="button" :selectable="true" class="right-stack" @click="checkout(pack)">
                            <figure slot="left" class="style-image-with-icon" :class="{gray: !pack.alreadyBought && !pack.inTrial, 'secundary': !pack.alreadyBought && pack.inTrial}">
                                <figure>
                                    <span class="icon group" />
                                </figure>

                                <aside>
                                    <span v-if="pack.alreadyBought" v-tooltip="'Deze functie is actief'" class="icon success small primary" />
                                    <span v-else-if="pack.inTrial" v-tooltip="'Momenteel in proefperiode, activeer om in gebruik te nemen'" class="icon trial small stroke secundary" />
                                </aside>
                            </figure>

                            <p v-if="pack.inTrial && !pack.alreadyBought" class="style-title-prefix-list theme-secundary">
                                In proefperiode
                                <button v-if="pack.inTrial && !pack.alreadyBought" slot="right" v-tooltip="'Stop proefperiode'" type="button" class="button icon small disabled selected" @click.stop="stopTrial(pack)" />
                            </p>

                            <p v-if="pack.alreadyBought && pack.expiresSoon" class="style-title-prefix-list">
                                Vervalt binnenkort
                            </p>

                            <p v-else-if="pack.alreadyBought" class="style-title-prefix-list">
                                Actief
                            </p>

                            <h3 class="style-title-list">
                                {{ pack.title }}
                            </h3>

                            <p v-if="pack.alreadyBought && pack.package.validUntil" class="style-description-small">
                                Geldig tot {{ pack.package.validUntil | dateTime }}
                            </p>

                            <p class="style-description-small">
                                {{ pack.description }}
                            </p>


                            

                            <span v-if="!pack.alreadyBought && (pack.inTrial || !pack.canStartTrial)" slot="right" class="button text selected">
                                <span>Activeren</span>
                                <span class="icon arrow-right-small" />
                            </span>

                            <span v-if="!pack.alreadyBought && !pack.inTrial && pack.canStartTrial" slot="right" class="button text selected">
                                <span>Uitproberen</span>
                                <span class="icon arrow-right-small" />
                            </span>
                            
                            <span v-if="pack.alreadyBought && pack.expiresSoon && pack.package.meta.allowRenew" slot="right" class="button text selected">
                                <span>Verlengen</span>
                                <span class="icon arrow-right-small" />
                            </span>

                            <span v-else-if="pack.alreadyBought" slot="right" class="button icon arrow-right-small" />
                        </STListItem>
                    </STList>
                </template>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import flagIcon from "@stamhoofd/assets/images/illustrations/package-activities.svg"
import groupIcon from "@stamhoofd/assets/images/illustrations/package-members.svg"
import experimentIcon from "@stamhoofd/assets/images/illustrations/package-trial.svg"
import cartIcon from "@stamhoofd/assets/images/illustrations/package-webshops.svg"
import { BackButton, Checkbox,ErrorBox,LoadingButton, Spinner, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { CenteredMessage } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { OrganizationType, PaymentMethod, STBillingStatus, STInvoiceResponse, STPackage, STPackageBundle, STPackageBundleHelper, STPackageType, UmbrellaOrganization } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Watch } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import ActivatedView from "../modules/members/ActivatedView.vue";
import MembersStructureSetupView from "../modules/members/MembersStructureSetupView.vue";
import PackageConfirmView from "./PackageConfirmView.vue";
import PackageDetailsView from "./PackageDetailsView.vue";

export class SelectablePackage {
    package: STPackage

    // In case of a renewal, bundle can be empty
    bundle: STPackageBundle

    alreadyBought = false
    expiresSoon = false;
    inTrial = false
    canStartTrial = true;

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
    OrganizationManager = OrganizationManager

    get organization() {
        return OrganizationManager.organization
    }

    mounted() {
        UrlHelper.setUrl("/finances/packages");
        this.reload().catch(e => {
            console.error(e)
        })
    }

    activated() {
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
            case STPackageType.SingleWebshop: return cartIcon
        }
        return null
    }

    updatePackages() {
        const packages: SelectablePackage[] = [];
        const limit = new Date();
        limit.setDate(limit.getDate() + 2 * 31);

        for (const bundle of Object.values(STPackageBundle)) {
            if (!STPackageBundleHelper.isPublic(bundle)) {
                continue
            }

            let isCombineable = true
            let isBought = false
            let isTrial = false
            let expiresSoon = false;
            let boughtPackage: null | STPackage = null;

            for (const p of this.status!.packages) {
                if (p.validUntil !== null) {
                    if (p.validUntil < new Date()) {
                        // Allow to buy this package because it is expired
                        continue;
                    }
                }
                
                if (STPackageBundleHelper.isAlreadyBought(bundle, p)) {
                    isBought = true

                    if (!boughtPackage || p.validUntil === null || (p.validUntil !== null && boughtPackage.validUntil !== null && p.validUntil > boughtPackage.validUntil)) {
                        boughtPackage = p
                    }
                }

                if (STPackageBundleHelper.isInTrial(bundle, p)) {
                    isTrial = true
                }
            }

            if (!isCombineable) {
                continue;
            }

            if (boughtPackage && boughtPackage.validUntil !== null && boughtPackage.validUntil < limit) {
                // Allow to buy this package because it expires in less than 3 months, and it doesn't allow renewing
                expiresSoon = true
            }

            try {
                const pack = boughtPackage ?? STPackageBundleHelper.getCurrentPackage(bundle, new Date())
                const pp = new SelectablePackage(pack, bundle);
                pp.alreadyBought = isBought;
                pp.inTrial = isTrial;
                pp.expiresSoon = expiresSoon;
                if (bundle === STPackageBundle.Members && !this.organization.meta.packages.canStartMembersTrial) {
                    pp.canStartTrial = false;
                }

                if (bundle === STPackageBundle.Webshops && !this.organization.meta.packages.canStartWebshopsTrial) {
                    pp.canStartTrial = false;
                }
                packages.push(pp)
            } catch (e) {
                console.error(e)
            }
        }
        this.availablePackages = packages
    }

    async reload() {
        this.loadingStatus = true

        try {
            this.status = await OrganizationManager.loadBillingStatus({
                owner: this
            })
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

    checkout(pack: SelectablePackage) {
        if (pack.alreadyBought) {
            this.show(new ComponentWithProperties(PackageDetailsView, {
                pack: pack.package
            }))
            return;
        }

        if (pack.inTrial || !pack.canStartTrial) {
            this.show(new ComponentWithProperties(PackageConfirmView, {
                bundles: [pack.bundle]
            }))
        } else {
            switch (pack.bundle) {
                case STPackageBundle.Members: {
                    if (!this.organization.meta.packages.canStartMembersTrial) {
                        new Toast("Je hebt geen recht meer om een proefperiode op te starten. Je kan wel het pakket activeren. Neem contact op met Stamhoofd als je deze toch wilt gebruiken.", "error").show()
                        this.show(new ComponentWithProperties(PackageConfirmView, {
                            bundles: [pack.bundle]
                        }))
                        return

                    }
                    // Activate trial if possible (otherwise go to confirm)
                    this.setupMemberAdministration();
                    break;
                }
                case STPackageBundle.Webshops: {
                    if (!this.organization.meta.packages.canStartWebshopsTrial) {
                        new Toast("Je hebt geen recht meer om een proefperiode op te starten. Je kan wel het pakket activeren. Neem contact op met Stamhoofd als je deze toch wilt gebruiken.", "error").show()
                        this.show(new ComponentWithProperties(PackageConfirmView, {
                            bundles: [pack.bundle]
                        }))
                        return

                    }
                    // Activate trial if possible (otherwise go to confirm)
                    this.checkoutTrial(STPackageBundle.TrialWebshops, "De proefperiode voor webshops is gestart. Neem je tijd om alles rustig uit te proberen. Als je het daarna definitief in gebruik wilt nemen, kan je het systeem activeren.")
                        .then(() => {
                            this.dismiss()
                        })
                        .catch(console.error)
                    break;
                }
            }
        }
    }

    async stopTrial(pack: SelectablePackage) {
        if (pack.alreadyBought) {
            return;
        }

        if (!pack.inTrial) {
            return;
        }
        switch (pack.bundle) {
            case STPackageBundle.Members: {
                if (!await CenteredMessage.confirm('Ben je zeker dat je de proefperiode voor de ledenadministratie wilt stopzetten?', 'Ja, stopzetten')) {
                    return;
                }
                // Activate trial if possible (otherwise go to confirm)
                this.deactivate(STPackageType.TrialMembers, "Proefperiode stopgezet").catch(console.error)
                break;
            }
            case STPackageBundle.Webshops: {
                if (!await CenteredMessage.confirm('Ben je zeker dat je de proefperiode voor webshops wilt stopzetten?', 'Ja, stopzetten')) {
                    return;
                }

                // Activate trial if possible (otherwise go to confirm)
                this.deactivate(STPackageType.TrialWebshops, "Proefperiode stopgezet").catch(console.error)
                break;
            }
        }
    }

    loadingModule: STPackageType | null = null

    setupMemberAdministration() {
        if (this.organization.groups.length === 0 && this.organization.meta.type === OrganizationType.Youth && (!this.organization.meta.umbrellaOrganization || [UmbrellaOrganization.ChiroNationaal, UmbrellaOrganization.ScoutsEnGidsenVlaanderen].includes(this.organization.meta.umbrellaOrganization))){
            // We have an automated flow for these organizations
            this.show({
                components: [
                    new ComponentWithProperties(MembersStructureSetupView, {})
                ]
            })
        } else {
            this.checkoutTrial(STPackageBundle.TrialMembers, "De proefperiode voor ledenadministratie is gestart. Neem je tijd om alles rustig uit te proberen. Als je het daarna definitief in gebruik wilt nemen, kan je het systeem activeren.").then(() => {
                // Wait for the backend to fill in all the default categories and groups
                this.show({
                    components: [
                        new ComponentWithProperties(ActivatedView, {})
                    ]
                })
            }).catch(e => console.error(e))
        }
    }

    async checkoutTrial(bundle: STPackageBundle, message: string) {
        if (this.loadingModule) {
            new Toast("Even geduld, nog bezig met laden...", "info").show()
            return
        }
        this.loadingModule = bundle as any as STPackageType

        try {
            await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/billing/activate-packages",
                body: {
                    bundles: [bundle],
                    paymentMethod: PaymentMethod.Unknown
                },
                decoder: STInvoiceResponse as Decoder<STInvoiceResponse>,
                shouldRetry: false
            })
            await SessionManager.currentSession!.fetchOrganization(false)
            await this.reload()
            new Toast(message, "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.loadingModule = null
    }

    async deactivate(type: STPackageType, message: string) {
        if (this.loadingModule) {
            return
        }
        this.loadingModule = type

        try {
            const status = await OrganizationManager.loadBillingStatus({
                shouldRetry: false,
                owner: this
            })
            const packages = status.packages
            const pack = packages.find(p => p.meta.type === type)

            if (pack) {
                await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/billing/deactivate-package/"+pack.id,
                    owner: this,
                    shouldRetry: false
                })
                await SessionManager.currentSession!.fetchOrganization(false)
                await this.reload()
                new Toast(message, "success green").show()
            } else {
                // Update out of date
                await SessionManager.currentSession!.fetchOrganization(false)
            }
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.loadingModule = null
    }
  
    shouldNavigateAway() {
        if (this.loading) {
            return false
        }
        return true
    }
}
</script>