<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen" />

        <main class="center">
            <h1>
                Instellingen
            </h1>

            <BillingWarningBox />

            <p v-for="(stripeWarning, index) of stripeWarnings" :key="'stripe-warning-'+index" :class="stripeWarning.type + '-box'">
                {{ stripeWarning.text }}

                <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/documenten-stripe-afgekeurd/'" target="_blank" class="button text">
                    Meer info
                </a>
            </p>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openGeneral(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                    </template>
                    <h2 class="style-title-list">
                        Algemeen
                    </h2>
                    <p class="style-description">
                        Naam, adres en website
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openPersonalize(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                    </template>
                    <h2 class="style-title-list">
                        Personaliseren
                    </h2>
                    <p class="style-description">
                        Logo, kleur en domeinnaam
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="setupEmail(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email.svg">
                    </template>
                    <h2 class="style-title-list">
                        E-mailadressen
                    </h2>
                    <p class="style-description">
                        Verstuur e-mails vanaf je zelf gekozen e-mailadres
                    </p>
                    <template #right>
                        <span v-if="!hasPolicy" v-tooltip="'We hebben zeker één e-mailadres nodig voor communicatie en indien leden antwoorden op automatische e-mails'" class="icon warning yellow" />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openAdmins(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/admin.svg">
                    </template>
                    <h2 class="style-title-list">
                        Beheerders
                    </h2>
                    <p class="style-description">
                        Geef anderen ook toegang tot deze vereniging
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openPrivacy(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/privacy-policy.svg">
                    </template>
                    <h2 class="style-title-list">
                        Privacyvoorwaarden
                    </h2>
                    <p class="style-description">
                        Stel je privacyvoorwaarden in
                    </p>
                    <template #right>
                        <span v-if="!hasPolicy" v-tooltip="'Voeg je privacyvoorwaarden toe om in orde te zijn met GDPR'" class="icon warning yellow" />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openPayment(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/creditcards.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('dashboard.settings.menu.paymentAccounts.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('dashboard.settings.menu.paymentAccounts.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="enableMemberModule">
                <hr>
                <h2>Ledenadministratie</h2>

                <STList class="illustration-list">    
                    <STListItem :selectable="true" class="left-center right-stack" @click="manageRegistrationPage(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/laptop.svg">
                        </template>
                        <h2 class="style-title-list">
                            Link naar ledenportaal
                        </h2>
                        <p class="style-description">
                            Via deze weg kunnen leden zelf online inschrijven
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="openRegistrationPayment(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('dashboard.settings.menu.paymentMethods.title') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('dashboard.settings.menu.paymentMethods.description') }}
                        </p>
                        <template #right>
                            <span v-if="!hasPaymentMethod" v-tooltip="'Je hebt nog geen bankrekeningnummer toegevoegd of andere betaalmethodes geactiveerd'" class="icon warning yellow" />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="manageGroups(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/group.svg">
                        </template>
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

                        <template #right>
                            <span v-if="!hasGroups" v-tooltip="'Je hebt nog geen inschrijvingsgroepen ingesteld'" class="icon warning yellow" />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>



                    <STListItem :selectable="true" class="left-center right-stack" @click="manageRecords(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/health-data.svg">
                        </template>
                        <h2 class="style-title-list">
                            Vragenlijsten en gegevens van leden
                        </h2>
                        <p class="style-description">
                            Kies welke informatie je verzamelt van jouw leden
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="manageFinancialSupport(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/discount.svg">
                        </template>
                        <h2 class="style-title-list">
                            Financiële ondersteuning
                        </h2>
                        <p class="style-description">
                            Steun kwetsbare gezinnen
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="manageDataPermission(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/agreement.svg">
                        </template>
                        <h2 class="style-title-list">
                            Toestemming gegevensverzameling
                        </h2>
                        <p class="style-description">
                            Vaak heb je toestemming nodig om bepaalde gegevens te verzamelen. Dat stel je hier in.
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="manageFreeContribution(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/piggy-bank.svg">
                        </template>
                        <h2 class="style-title-list">
                            Vrije bijdrage
                        </h2>
                        <p class="style-description">
                            Maak het mogelijk dat leden een (optionele) vrije bijdrage doen bij het inschrijven
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="importMembers(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/import-excel.svg">
                        </template>
                        <h2 class="style-title-list">
                            Leden importeren
                        </h2>
                        <p class="style-description">
                            Importeer leden vanaf een Excel of CSV bestand
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="isSGV" :selectable="true" class="left-center right-stack" @click="openSyncScoutsEnGidsen(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/sync-scouts.svg">
                        </template>
                        <h2 class="style-title-list">
                            Synchroniseer met de groepsadministratie
                        </h2>
                        <p class="style-description">
                            Neem alle gegevens uit Stamhoofd over in de groepsadministratie
                        </p>

                        <template #right>
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
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                        </template>
                        <h2 class="style-title-list">
                            Single-Sign-On (SSO)
                        </h2>
                        <p class="style-description">
                            Configureer een externe authenticatie server
                        </p>
                        <template #right>
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
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/stock.svg">
                        </template>
                        <h2 class="style-title-list">
                            Pakketten aankopen
                        </h2>
                        <p class="style-description">
                            Wijzig je pakketten of activeer nieuwe functies
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="false" :selectable="true" class="left-center" @click="openBilling(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/transfer.svg">
                        </template>
                        <h2 class="style-title-list">
                            Facturen en betalingen
                        </h2>
                        <p class="style-description">
                            Download jouw facturen en bekijk jouw tegoed
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="openReferrals(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/credits.svg">
                        </template>
                        <h2 class="style-title-list">
                            Vertel Stamhoofd door aan andere verenigingen
                        </h2>
                        <p class="style-description">
                            Geef 25 euro en krijg zelf ook een tegoed
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="openLabs(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/experiment.svg">
                        </template>
                        <h2 class="style-title-list">
                            Experimenten
                        </h2>
                        <p class="style-description">
                            Probeer als eerste nieuwe functies uit die in ontwikkeling zijn.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
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
import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { AdminsView, AsyncComponent, BackButton, CenteredMessage, LoadComponent, RecordsConfigurationView, STList, STListItem, STNavigationBar, Toast, TooltipDirective } from "@stamhoofd/components";
import { AppManager, UrlHelper } from '@stamhoofd/networking';
import { Organization, OrganizationMetaData, OrganizationRecordsConfiguration, OrganizationType, PaymentMethod, Platform, StripeAccount, UmbrellaOrganization } from "@stamhoofd/structures";

import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';
import { buildManageGroupsComponent } from './buildManageGroupsComponent';
import EmailSettingsView from './EmailSettingsView.vue';
import GeneralSettingsView from './GeneralSettingsView.vue';
import LabsView from './LabsView.vue';
import DataPermissionSettingsView from './modules/members/DataPermissionSettingsView.vue';
import FinancialSupportSettingsView from './modules/members/FinancialSupportSettingsView.vue';
import FreeContributionSettingsView from './modules/members/FreeContributionSettingsView.vue';
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
    temp_organization = this.$organization
    loadingStripeAccounts = false;
    stripeAccounts: StripeAccount[] = []

    get organization() {
        return this.$organization
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

    get stripeWarnings() {
        return this.stripeAccounts.flatMap(a => a.warning ? [a.warning] : [])
    }

    async loadStripeAccounts(recheckStripeAccount: string | null) {
        try {
            this.loadingStripeAccounts = true
            if (recheckStripeAccount) {
                try {
                    await this.$context.authenticatedServer.request({
                        method: "POST",
                        path: "/stripe/accounts/" + encodeURIComponent(recheckStripeAccount),
                        decoder: StripeAccount as Decoder<StripeAccount>,
                        owner: this
                    })
                } catch (e) {
                    console.error(e)
                }
            }
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/stripe/accounts",
                decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
                owner: this
            })
            this.stripeAccounts = response.data

            if (!recheckStripeAccount) {
                for (const account of this.stripeAccounts) {
                    try {
                        const response = await this.$context.authenticatedServer.request({
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
            ],
            url: 'general'
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
            ],
            url: 'labs'
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
            ],
            url: 'personalize'
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
            ],
            url: 'privacy'
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
            ],
            url: 'packages'
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
        const component = buildManageGroupsComponent(this.$organizationManager)
            
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
                    root: new ComponentWithProperties(RecordsConfigurationView, {
                        inheritedRecordsConfiguration: Platform.shared.config.recordsConfiguration,
                        recordsConfiguration: this.$organization.meta.recordsConfiguration,
                        saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                            await this.$organizationManager.patch(Organization.patch({
                                id: this.$organization.id,
                                meta: OrganizationMetaData.patch({
                                    recordsConfiguration: patch
                                })
                            }))
                            Toast.success("De aanpassingen zijn opgeslagen").show();
                        }
                    })
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

    activated() {
        this.$url.setTitle("Instellingen")
    }

    mounted() {
        // First set current url already, to fix back
        if (this.$url.match('oauth/mollie')) {
            // Open mollie settings
            this.openPayment(false)
            return
        }

        if (this.$url.match('scouts-en-gidsen-vlaanderen') || this.$url.match('oauth/sgv')) {
            this.openSyncScoutsEnGidsen(false)
            return; // (don't clear)
        }

        if (this.$url.match('admins')) {
            // Open mollie settings
            this.openAdmins(false)
            return; // (don't clear)
        }

        if (this.$url.match('general')) {
            // Open mollie settings
            this.openGeneral(false)
        }

        if (this.$url.match('payments')) {
            // Open mollie settings
            this.openPayment(false)
        }

        if (this.$url.match('labs')) {
            // Open mollie settings
            this.openLabs(false)
        }

        if (this.$url.match('registration-payments')) {
            // Open mollie settings
            this.openRegistrationPayment(false)
        }

        if (this.$url.match('privacy')) {
            // Open mollie settings
            this.openPrivacy(false)
        }

        if (this.$url.match('personalize')) {
            // Open mollie settings
            this.openPersonalize(false)
        }

        if (this.$url.match('sso')) {
            // Open mollie settings
            this.openSSO(false).catch(console.error)
        }

        if (this.$url.match('records')) {
            // Open mollie settings
            this.manageRecords(false)
        }

        if (this.$url.match('packages')) {
            this.openPackages(false)
        }

        if (this.$url.match('referrals')) {
            this.openReferrals(false)
        }

        if (this.$url.match('free-contribution')) {
            this.manageFreeContribution(false)
        }

        if (this.$url.match('financial-support')) {
            this.manageFinancialSupport(false)
        }

        if (this.$url.match('data-permission')) {
            this.manageDataPermission(false)
        }
        UrlHelper.shared.clear()
        this.loadStripeAccounts(null).catch(console.error);
    }

    beforeUnmount() {
        // Clear all pending requests
        Request.cancelAll(this)
    }
}
</script>
