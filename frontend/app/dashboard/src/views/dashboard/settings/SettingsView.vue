<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Instellingen
            </h1>

            <BillingWarningBox />

            <p v-if="stripeWarning" class="error-box">
                {{ stripeWarning }}<br>Hulp nodig? Neem contact met ons op.

                <a :href="'mailto:'+$t('shared.emails.general')" class="button text">
                    E-mail
                </a>
            </p>

            <p v-if="false" class="info-box icon help with-button">
                Hulp nodig? Neem contact met ons op via {{ $t('shared.emails.general') }}

                <a :href="'mailto:'+$t('shared.emails.general')" class="button text">
                    E-mail
                </a>
            </p>

            <p v-if="false && !areSalesDisabled" class="info-box icon gift selectable with-button" @click="openReferrals(true)">
                Geef 25 euro, en krijg tot 100 euro per vereniging die via jou Stamhoofd gebruikt. Klik hier om mee te doen.

                <button class="button text" type="button">
                    Meedoen
                </button>
            </p>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openGeneral(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/flag.svg">
                    <h2 class="style-title-list">
                        Algemeen
                    </h2>
                    <p class="style-description">
                        Naam, adres en website
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openPersonalize(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/palette.svg">
                    <h2 class="style-title-list">
                        Personaliseren
                    </h2>
                    <p class="style-description">
                        Logo, kleur en domeinnaam
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="setupEmail(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/email.svg">
                    <h2 class="style-title-list">
                        E-mailadressen
                    </h2>
                    <p class="style-description">
                        Verstuur e-mails vanaf je zelf gekozen e-mailadres
                    </p>
                    <template slot="right">
                        <span v-if="!hasPolicy" v-tooltip="'We hebben zeker één e-mailadres nodig voor communicatie en indien leden antwoorden op automatische e-mails'" class="icon warning yellow" />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openAdmins(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/admin.svg">
                    <h2 class="style-title-list">
                        Beheerders
                    </h2>
                    <p class="style-description">
                        Geef anderen ook toegang tot deze vereniging
                    </p>
                    <template slot="right">
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openPrivacy(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/privacy-policy.svg">
                    <h2 class="style-title-list">
                        Privacyvoorwaarden
                    </h2>
                    <p class="style-description">
                        Stel je privacyvoorwaarden in
                    </p>
                    <template slot="right">
                        <span v-if="!hasPolicy" v-tooltip="'Voeg je privacyvoorwaarden toe om in orde te zijn met GDPR'" class="icon warning yellow" />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openPayment(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/creditcards.svg">
                    <h2 class="style-title-list">
                        {{ $t('dashboard.settings.menu.paymentAccounts.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('dashboard.settings.menu.paymentAccounts.description') }}
                    </p>
                    <template slot="right">
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="enableMemberModule">
                <hr>
                <h2>Ledenadministratie</h2>

                <STList class="illustration-list">    
                    <STListItem :selectable="true" class="left-center right-stack" @click="manageRegistrationPage(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/laptop.svg">
                        <h2 class="style-title-list">
                            Link naar ledenportaal
                        </h2>
                        <p class="style-description">
                            Via deze weg kunnen leden zelf online inschrijven
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="openRegistrationPayment(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/creditcards.svg">
                        <h2 class="style-title-list">
                            {{ $t('dashboard.settings.menu.paymentMethods.title') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('dashboard.settings.menu.paymentMethods.description') }}
                        </p>
                        <template slot="right">
                            <span v-if="!hasPaymentMethod" v-tooltip="'Je hebt nog geen bankrekeningnummer toegevoegd of andere betaalmethodes geactiveerd'" class="icon warning yellow" />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="manageGroups(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/group.svg">
                        <h2 class="style-title-list">
                            Inschrijvingsgroepen<template v-if="enableActivities">
                                en activiteiten
                            </template>
                        </h2>
                        <p v-if="enableActivities" class="style-description">
                            Deel je leden op in groepen en activiteiten, wijzig de prijs en de inschrijvingsdatum
                        </p>
                        <p v-else class="style-description">
                            Leeftijdsgroepen aanmaken en beheren
                        </p>

                        <template slot="right">
                            <span v-if="!hasGroups" v-tooltip="'Je hebt nog geen inschrijvingsgroepen ingesteld'" class="icon warning yellow" />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>



                    <STListItem :selectable="true" class="left-center right-stack" @click="manageRecords(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/health-data.svg">
                        <h2 class="style-title-list">
                            Vragenlijsten en gegevens van leden
                        </h2>
                        <p class="style-description">
                            Kies welke informatie je verzamelt van jouw leden
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="manageFinancialSupport(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/discount.svg">
                        <h2 class="style-title-list">
                            Financiële ondersteuning
                        </h2>
                        <p class="style-description">
                            Steun kwetsbare gezinnen
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="manageDataPermission(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/agreement.svg">
                        <h2 class="style-title-list">
                            Toestemming gegevensverzameling
                        </h2>
                        <p class="style-description">
                            Vaak heb je toestemming nodig om bepaalde gegevens te verzamelen. Dat stel je hier in.
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="manageFreeContribution(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/piggy-bank.svg">
                        <h2 class="style-title-list">
                            Vrije bijdrage
                        </h2>
                        <p class="style-description">
                            Maak het mogelijk dat leden een (optionele) vrije bijdrage doen bij het inschrijven
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="importMembers(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/import-excel.svg">
                        <h2 class="style-title-list">
                            Leden importeren
                        </h2>
                        <p class="style-description">
                            Importeer leden vanaf een Excel of CSV bestand
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="isSGV" :selectable="true" class="left-center right-stack" @click="openSyncScoutsEnGidsen(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/sync-scouts.svg">
                        <h2 class="style-title-list">
                            Synchroniseer met de groepsadministratie
                        </h2>
                        <p class="style-description">
                            Neem alle gegevens uit Stamhoofd over in de groepsadministratie
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="getFeatureFlag('sso')">
                <hr>
                <h2>Geavanceerd</h2>
                <STList class="illustration-list">    
                    <STListItem :selectable="true" class="left-center" @click="openSSO(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/lock.svg">
                        <h2 class="style-title-list">
                            Single-Sign-On (SSO)
                        </h2>
                        <p class="style-description">
                            Configureer een externe authenticatie server
                        </p>
                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="!areSalesDisabled">
                <hr>
                <h2>Stamhoofd</h2>
                <STList class="illustration-list">    
                    <STListItem :selectable="true" class="left-center" @click="openPackages(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/stock.svg">
                        <h2 class="style-title-list">
                            Pakketten aankopen
                        </h2>
                        <p class="style-description">
                            Wijzig je pakketten of activeer nieuwe functies
                        </p>
                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="false" :selectable="true" class="left-center" @click="openBilling(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/transfer.svg">
                        <h2 class="style-title-list">
                            Facturen en betalingen
                        </h2>
                        <p class="style-description">
                            Download jouw facturen en bekijk jouw tegoed
                        </p>
                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="openReferrals(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/credits.svg">
                        <h2 class="style-title-list">
                            Vertel Stamhoofd door aan andere verenigingen
                        </h2>
                        <p class="style-description">
                            Geef 25 euro en krijg zelf ook een tegoed
                        </p>
                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="openLabs(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/experiment.svg">
                        <h2 class="style-title-list">
                            Experimenten
                        </h2>
                        <p class="style-description">
                            Probeer als eerste nieuwe functies uit die in ontwikkeling zijn.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>

                <hr>
                <h2>Functies gratis uitproberen</h2>
                <p>Je kan alle functies van Stamhoofd gratis uitproberen in een demo-versie. Je kan de demo-versie enkel gebruiken om zelf alle functies te testen, niet om extern te gebruiken. Zodra je het in gebruik wilt nemen kan je overschakelen op één van onze pakketten. We rekenen nooit kosten aan zonder dit duidelijk te communiceren en hiervoor toestemming te vragen.</p>

                <ModuleSettingsBox />
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AsyncComponent, BackButton, CenteredMessage, LoadComponent, STList, STListItem, STNavigationBar, TooltipDirective } from "@stamhoofd/components";
import { AppManager, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { OrganizationType, PaymentMethod, StripeAccount, UmbrellaOrganization } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import AdminsView from '../admins/AdminsView.vue';
import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';
import { buildManageGroupsComponent } from './buildManageGroupsComponent';
import EmailSettingsView from './EmailSettingsView.vue';
import GeneralSettingsView from './GeneralSettingsView.vue';
import LabsView from './LabsView.vue';
import DataPermissionSettingsView from './modules/members/DataPermissionSettingsView.vue';
import FinancialSupportSettingsView from './modules/members/FinancialSupportSettingsView.vue';
import FreeContributionSettingsView from './modules/members/FreeContributionSettingsView.vue';
import RecordsSettingsView from './modules/members/RecordsSettingsView.vue';
import ModuleSettingsBox from './ModuleSettingsBox.vue';
import BillingSettingsView from './packages/BillingSettingsView.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';
import PackageSettingsView from './packages/PackageSettingsView.vue';
import PaymentSettingsView from './PaymentSettingsView.vue';
import PersonalizeSettingsView from './PersonalizeSettingsView.vue';
import PrivacySettingsView from './PrivacySettingsView.vue';
import ReferralView from './ReferralView.vue';
import RegistrationPageSettingsView from './RegistrationPageSettingsView.vue';
import RegistrationPaymentSettingsView from './RegistrationPaymentSettingsView.vue';

@Component({
    components: {
        STNavigationBar,
        BackButton,
        STList,
        STListItem,
        ModuleSettingsBox,
        BillingWarningBox
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class SettingsView extends Mixins(NavigationMixin) {
    temp_organization = OrganizationManager.organization
    loadingStripeAccounts = false;
    stripeAccounts: StripeAccount[] = []

    get organization() {
        return OrganizationManager.organization
    }

    get isSGV() {
        return this.organization.meta.type == OrganizationType.Youth && this.organization.meta.umbrellaOrganization == UmbrellaOrganization.ScoutsEnGidsenVlaanderen
    }

    get areSalesDisabled() {
        return AppManager.shared.isNative && this.organization.id === "34541097-44dd-4c68-885e-de4f42abae4c"
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }

    get stripeWarning() {
        return this.stripeAccounts.flatMap(a => a.warning ? [a.warning] : []).join("\n")
    }

    async loadStripeAccounts(recheckStripeAccount: string | null) {
        try {
            this.loadingStripeAccounts = true
            if (recheckStripeAccount) {
                try {
                    await SessionManager.currentSession!.authenticatedServer.request({
                        method: "POST",
                        path: "/stripe/accounts/" + encodeURIComponent(recheckStripeAccount),
                        decoder: StripeAccount as Decoder<StripeAccount>,
                        owner: this
                    })
                } catch (e) {
                    console.error(e)
                }
            }
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/stripe/accounts",
                decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
                owner: this
            })
            this.stripeAccounts = response.data

            if (!recheckStripeAccount) {
                for (const account of this.stripeAccounts) {
                    try {
                        const response = await SessionManager.currentSession!.authenticatedServer.request({
                            method: "POST",
                            path: "/stripe/accounts/" + encodeURIComponent(account.id),
                            decoder: StripeAccount as Decoder<StripeAccount>,
                            owner: this
                        })
                        account.set(response.data)
                    } catch (e) {
                        console.error(e)
                    }
                }
            }
        } catch (e) {
            console.error(e)
        }
        this.loadingStripeAccounts = false
    }

    openReferrals(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ReferralView, {})
                })
            ]
        })
    }

    openGeneral(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(GeneralSettingsView, {})
                })
            ]
        })
    }

    openLabs(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(LabsView, {})
                })
            ]
        })
    }

    openPersonalize(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(PersonalizeSettingsView, {})
                })
            ]
        })
    }

    openPrivacy(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(PrivacySettingsView, {})
                })
            ]
        })
    }

    openAdmins(animated = true) {
        this.show({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(AdminsView, {})
            ]
        })
    }

    async openSSO(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "SSOSettingsView" */  "./SSOSettingsView.vue"), { }, { instant: !animated })
                })
            ]
        })
    }

    setupEmail(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EmailSettingsView, {})
                })
            ]
        })
    }

    openPayment(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(PaymentSettingsView, {})
                })
            ]
        })
    }

    openRegistrationPayment(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(RegistrationPaymentSettingsView, {})
                })
            ]
        })
    }

    openPackages(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(PackageSettingsView, {})
                })
            ]
        })
    }

    openPayments(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ConfigurePaymentExportView, {})
                })
            ]
        })
    }

    openSyncScoutsEnGidsen(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: AsyncComponent(() => import(/* webpackChunkName: "SGVGroepsadministratieView" */ "./SGVGroepsadministratieView.vue"))
                })
            ]
        })
    }

    openBilling(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(BillingSettingsView, {})
                })
            ]
        })
    }

    manageRegistrationPage(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(RegistrationPageSettingsView)
                })
            ]
        })
    }

    manageGroups(animated = true) {
        const component = buildManageGroupsComponent(this.organization)
            
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: component
                })
            ]
        })
    }

    manageRecords(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(RecordsSettingsView, {})
                })
            ]
        })
    }

    manageFinancialSupport(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(FinancialSupportSettingsView, {})
                })
            ]
        })
    }

    manageDataPermission(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(DataPermissionSettingsView, {})
                })
            ]
        })
    }

    manageFreeContribution(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(FreeContributionSettingsView, {})
                })
            ]
        })
    }

    importMembers(animated = true) {
        if (this.organization.groups.length == 0) {
            new CenteredMessage("Voeg eerst inschrijvingsgroepen toe", "Je kan leden pas importeren nadat je jouw inschrijvingsgroepen hebt ingesteld.", "error").addCloseButton().show()
            return
        }

        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: AsyncComponent(() => import(/* webpackChunkName: "ImportMembersView" */ "./modules/members/ImportMembersView.vue"))
                })
            ]
        })
    }

    get hasPolicy() {
        return this.organization.meta.privacyPolicyUrl !== null || this.organization.meta.privacyPolicyFile !== null
    }

    get hasPaymentMethod() {
        return (this.organization.meta.transferSettings.iban && this.organization.meta.transferSettings.iban.length > 0) || !this.organization.meta.paymentMethods.includes(PaymentMethod.Transfer)
    } 

    get hasGroups() {
        return this.organization.groups.length > 0
    } 

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
    }

    get enableActivities() {
        return this.organization.meta.modules.useActivities
    }


    mounted() {
        const parts = UrlHelper.shared.getParts()

        // First set current url already, to fix back
        UrlHelper.setUrl("/settings")
        document.title = "Stamhoofd - Instellingen"

        if (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'mollie') {
            // Open mollie settings
            this.openPayment(false)
            return
        }

        if ((parts.length >= 1 && parts[0] == 'scouts-en-gidsen-vlaanderen') || (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'sgv')) {
            this.openSyncScoutsEnGidsen(false)
            return; // (don't clear)
        }


        if (parts.length >= 2 && parts[0] == 'settings' && parts[1] == 'admins') {
            // Open mollie settings
            this.openAdmins(false)
            return; // (don't clear)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'general') {
            // Open mollie settings
            this.openGeneral(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'payments') {
            // Open mollie settings
            this.openPayment(false)
        } else {
            // We can clear now
            UrlHelper.shared.clear()
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'labs') {
            // Open mollie settings
            this.openLabs(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'registration-payments') {
            // Open mollie settings
            this.openRegistrationPayment(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'privacy') {
            // Open mollie settings
            this.openPrivacy(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'personalize') {
            // Open mollie settings
            this.openPersonalize(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'sso') {
            // Open mollie settings
            this.openSSO(false).catch(console.error)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'records') {
            // Open mollie settings
            this.manageRecords(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'packages') {
            this.openPackages(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'referrals') {
            this.openReferrals(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'free-contribution') {
            this.manageFreeContribution(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'financial-support') {
            this.manageFinancialSupport(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'data-permission') {
            this.manageDataPermission(false)
        }

        this.loadStripeAccounts(null).catch(console.error);
    }

    beforeDestroy() {
        // Clear all pending requests
        Request.cancelAll(this)
    }
}
</script>