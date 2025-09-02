<template>
    <div id="sgv-groepsadministratie-view" class="st-view background">
        <STNavigationBar title="Groepsadministratie" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1 v-if="isLoggedIn">
                Start synchronisatie
            </h1>
            <h1 v-else>
                Groepsadministratie synchroniseren
            </h1>

            <p>
                Via deze koppeling zet je alle gegevens van Stamhoofd automatisch over naar de groepsadministratie van Scouts & Gidsen Vlaanderen. <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/groepsadministratie-scouts-en-gidsen-vlaanderen/'" target="_blank">Lees eerst de documentatie</a> voor je begint.
            </p>

            <p v-if="isTemporaryDisabled" class="error-box">
                Door een aanpassing in de groepsadministratie (waarschijnlijk een klein foutje), is het tijdelijk niet mogelijk om te synchroniseren (lidfuncties zijn onzichtbaar waardoor je ook manueel geen lid meer kan inschrijven).
            </p>

            <p v-if="isLoggedIn" class="success-box">
                Je bent ingelogd in de groepsadministratie. Je kan nu beginnen met synchroniseren.
            </p>
            <template v-else>
                <p v-if="organization.privateMeta?.externalSyncData?.lastExternalSync" :class="isToday(organization.privateMeta.externalSyncData.lastExternalSync) ? 'success-box' : 'info-box'">
                    Laatst gesynchroniseerd op {{ organization.privateMeta.externalSyncData.lastExternalSync | date }} door {{ organization.privateMeta?.externalSyncData?.lastSyncedBy || '?' }}
                </p>
                <p v-else class="warning-box">
                    Nog nooit gesynchroniseerd
                </p>
            </template>

            <p class="info-box">
                Gaat er iets mis of heb je problemen bij de synchronisatie? Laat ons dan zeker iets weten via {{ $t('shared.emails.general') }}
            </p>

            <STList v-if="organization.privateMeta?.externalGroupNumber" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Groepsnummer
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.privateMeta?.externalGroupNumber }}
                    </p>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template slot="right">
                <a v-if="!isLoggedIn" href="https://groepsadmin.scoutsengidsenvlaanderen.be" target="_blank" class="button secundary">
                    Naar groepsadministratie
                </a>
                <LoadingButton :loading="loading">
                    <button v-if="isLoggedIn" key="syncButton" class="button primary" type="button" :disabled="!isStamhoofd && isTemporaryDisabled" @click="sync">
                        <span class="icon sync" />
                        <span>Starten</span>
                    </button>
                    <button v-else key="loginButton" class="button primary" type="button" :disabled="!isStamhoofd && isTemporaryDisabled" @click="login">
                        Inloggen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Organization, OrganizationPrivateMetaData } from "@stamhoofd/structures";
import { SGVSyncReport } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import { SGVGroepsadministratie } from "../../../classes/SGVGroepsadministratie";
import SGVReportView from "../scouts-en-gidsen/SGVReportView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        STListItem,
        STList,
        Spinner,
        LoadingButton
    },
    directives: {
        tooltip: TooltipDirective
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter)
    }
})
export default class SGVGroepsadministratieView extends Mixins(NavigationMixin) {
    loading = false;
    SGVGroepsadministratie = SGVGroepsadministratie

    mounted() {
        SGVGroepsadministratie.checkUrl();

        UrlHelper.setUrl("/scouts-en-gidsen-vlaanderen")
    }

    get isTemporaryDisabled() {
        return false
    }

    get isLoggedIn() {
        return SGVGroepsadministratie.hasToken
    }

    get isStamhoofd() {
        return OrganizationManager.user.email.endsWith("@stamhoofd.be") || OrganizationManager.user.email.endsWith("@stamhoofd.nl")
    }

    get organization() {
        return OrganizationManager.organization
    }

    isToday(date: Date) {
        return Formatter.dateIso(date) === Formatter.dateIso(new Date())
    }

    async sync() {
        if (this.loading) {
            return;
        }
        this.loading = true
        const toast = new Toast("Synchroniseren voorbereiden...", "spinner").setHide(null).show()

        try {
            const report = new SGVSyncReport()
            this.setLeave()
            await SGVGroepsadministratie.downloadAll()
            const { matchedMembers, newMembers } = await SGVGroepsadministratie.matchAndSync(this, () => {
                toast.hide()
            })
            toast.hide();

            const { oldMembers, action } = await SGVGroepsadministratie.prepareSync(this, report, matchedMembers, newMembers)
            const toast2 = new Toast("Synchroniseren...", "spinner").setProgress(0).setHide(null).show()

            try {
                await SGVGroepsadministratie.sync(this, report, matchedMembers, newMembers, oldMembers, action, (status, progress) => {
                    toast2.message = status
                    toast2.setProgress(progress)
                })
                toast2.hide()
            } catch (e) {
                toast2.hide()
                throw e
            }
            new Toast("Synchronisatie voltooid", "success green").show()

            // Show report
            this.present(new ComponentWithProperties(SGVReportView, {
                report
            }).setDisplayStyle("popup"))

            const data = report.createExternalSyncData(OrganizationManager.organization.privateMeta?.externalSyncData ?? null, OrganizationManager.user)

            // Save sync to database
            await OrganizationManager.patch(Organization.patch({
                id: OrganizationManager.organization.id,
                privateMeta: OrganizationPrivateMetaData.patch({
                    externalSyncData: data
                })
            }), true)

        } catch (e) {
            toast.hide()
            console.error(e)

            Toast.fromError(e).setHide(null).show()
        }
        this.removeLeave()
        this.loading = false
    }

    login() {
        console.log("Login, start OAuth")
        SGVGroepsadministratie.startOAuth()
    }

    beforeDestroy() {
        console.log("destroy")
        this.removeLeave()
    }

    leaveSet = false

    removeLeave() {
        if (!this.leaveSet) {
            return
        }
        console.log("removeLeave")
        window.removeEventListener("beforeunload", this.preventLeave);
        this.leaveSet = false
    }

    setLeave() {
        if (this.leaveSet) {
            return
        }
        console.log("set leave")
        this.leaveSet = true
        window.addEventListener("beforeunload", this.preventLeave);
    }

    preventLeave(event) {
        // Cancel the event
        event.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
        // Chrome requires returnValue to be set
        event.returnValue = 'De synchronisatie is nog bezig. Wacht tot de synchronisatie is voltooid voor je de pagina verlaat';

        // This message is not visible on most browsers
        return "De synchronisatie is nog bezig. Wacht tot de synchronisatie is voltooid voor je de pagina verlaat"
    }

    shouldNavigateAway() {
        if (this.leaveSet) {
            new CenteredMessage("De synchronisatie is nog bezig", "Wacht tot de synchronisatie is voltooid voor je de pagina verlaat").addCloseButton().show()
            return false;
        }
        return true;
    }
}
</script>

<style lang="scss">
    @use "@stamhoofd/scss/base/text-styles.scss" as *;
    @use "@stamhoofd/scss/base/variables.scss" as *;

    #sgv-groepsadministratie-view {

        ul {
            list-style: none; 
            @extend .style-normal;
            padding-left: 30px;

            li {
                padding: 8px 0;
            }

            li::before {
                content: ""; 
                background: $color-primary;
                display: inline-block; 
                vertical-align: middle;
                width: 5px;
                height: 5px;
                margin-right: 15px;
                border-radius: 2.5px;
                margin-left: -20px;
            }
        }
    }
</style>
