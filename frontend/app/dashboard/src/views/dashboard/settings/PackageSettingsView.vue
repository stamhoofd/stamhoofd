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
            <p>
                Kies de functies van Stamhoofd die je wilt gebruiken.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <Spinner v-if="loadingStatus" />

            <STList v-if="status">
                <STListItem v-for="pack of status.packages" :key="pack.id">
                    {{ pack.meta.name }}
                </STListItem>
            </STList>

            <hr>
            <h2>Nieuwe functies activeren</h2>

            <STList>
                <STListItem v-for="pack of availablePackages" :key="pack.id">
                    {{ pack.meta.name }}

                    <template slot="right">
                        {{ pack.meta.totalPrice | price }}
                    </template>
                </STListItem>
            </STList>

            
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="checkout" :disabled="true">
                        Afrekenen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { HistoryManager,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox,LoadingButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, STList, STListItem, Spinner } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { STBillingStatus, STPackage, STPackageBundle, STPackageBundleHelper } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";


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
        Spinner
    },
    filters: {
        price: Formatter.price,
    }
})
export default class PackageSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    loadingStatus = true

    status: STBillingStatus | null = null

    loading = false

    mounted() {
        HistoryManager.setUrl("/settings/packages");
        this.reload().catch(e => {
            console.error(e)
        })
    }

    get availablePackages() {
        const packages: STPackage[] = []
        for (const bundle of Object.values(STPackageBundle)) {
            try {
                const pack = STPackageBundleHelper.getCurrentPackage(bundle)
                packages.push(pack)
            } catch (e) {
                console.error(e)
            }
        }
        return packages
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
        // todo
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
