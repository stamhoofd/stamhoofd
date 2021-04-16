<template>
    <div class="st-view background">
        <STNavigationBar title="Mijn paketten">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else class="button icon close gray" @click="pop" slot="right" />
        </STNavigationBar>

        <main>
            <h1>
                Mijn pakketten
            </h1>
            <STErrorsDefault :error-box="errorBox" />

            <Spinner v-if="loadingStatus" />

            <STList v-if="status && status.packages.length > 0">
                <STListItem v-for="pack of status.packages" :key="pack.id">
                    {{ pack.meta.name }}
                </STListItem>
            </STList>

            <p class="info-box" v-if="status && status.packages.length == 0">Je hebt momenteel nog geen pakketten geactiveerd</p>

            <hr>
            <h2>Nieuwe functies activeren</h2>

            <p>Selecteer de functies die je wilt activeren en klik op 'afrekenen'. Meer info over alle pakketten kan je terugvinden op <a href="https://www.stamhoofd.be/pricing" class="inline-link">onze website</a>. Neem gerust contact op via hallo@stamhoofd.be als je bijkomende vragen zou hebben.</p>

            <STList>
                <STListItem v-for="pack of availablePackages" :key="pack.bundle" element-name="label" :selectable="true">
                    <Checkbox v-model="pack.selected" slot="left" :disabled="!pack.canSelect(availablePackages)" />
                    <h3 class="style-title-list">{{ pack.title }}</h3>
                    <p class="style-description">{{ pack.description }}</p>

                    <p slot="right" v-if="!pack.canSelect(availablePackages)" class="style-description">
                        Niet combineerbaar
                    </p>
                    <p slot="right" v-else class="style-description">
                        Vanaf {{ pack.package.meta.totalPrice | price}}
                    </p>
                </STListItem>
            </STList>

            
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="checkout" :disabled="!hasSelected">
                        Afrekenen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, HistoryManager,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox,LoadingButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, STList, STListItem, Spinner, Checkbox } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { STBillingStatus, STPackage, STPackageBundle, STPackageBundleHelper } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Watch } from "vue-property-decorator";
import PackageConfirmView from "./PackageConfirmView.vue";

export class SelectablePackage {
    package: STPackage
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

    updatePackages() {
        const packages: SelectablePackage[] = []
        for (const bundle of Object.values(STPackageBundle)) {
            if (!STPackageBundleHelper.isPublic(bundle)) {
                continue
            }

            let isCombineable = true
            for (const p of this.status!.packages) {
                if (!STPackageBundleHelper.isCombineable(bundle, p)) {
                    isCombineable = false
                    break;
                }
            }

            if (!isCombineable) {
                continue;
            }

            try {
                const pack = STPackageBundleHelper.getCurrentPackage(bundle)
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
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/billing/status",
                decoder: STBillingStatus as Decoder<STBillingStatus>
            })
            this.status = response.data
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.loadingStatus = false
    }

    async checkout() {
        if (!this.hasSelected) {
            return
        }
        
        this.show(new ComponentWithProperties(PackageConfirmView, {
            selectedPackages: this.availablePackages.filter(p => p.selected)
        }))
    }
  
    async shouldNavigateAway() {
        if (this.loading) {
            return false
        }
        return true
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
