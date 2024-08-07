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
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.General)">
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

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Personalization)">
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

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Admins)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/admin.svg">
                    </template>
                    <h2 class="style-title-list">
                        Toegangsrechten en functies
                    </h2>
                    <p class="style-description">
                        Beheer wie toegang heeft tot welk onderdeel van het beheerdersportaal
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Privacy)">
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
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.PaymentAccounts)">
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

            <template v-if="membersPackage">
                <hr>
                <h2>Ledenadministratie</h2>

                <STList class="illustration-list">    
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationPage)">
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

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.RegistrationPaymentMethods)">
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
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationGroups)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/group.svg">
                        </template>
                        <h2 class="style-title-list">
                            Inschrijvingsgroepen
                        </h2>
                        <p class="style-description">
                            Deel je leden op in groepen en categorieën
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>



                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationRecords)">
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

                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationFreeContributions)">
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
                </STList>
            </template>

            <hr>

            <h2>E-mails</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailSettings)">
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
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.EmailTemplates)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email-template.svg">
                    </template>
                    <h2 class="style-title-list">
                        Automatische e-mails
                    </h2>
                    <p class="style-description">
                        Wijzig de inhoud van automatische e-mails naar leden.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="feature('sso')">
                <hr>
                <h2>Geavanceerd</h2>
                <STList class="illustration-list">    
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.SingleSignOn)">
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

            <template v-if="!salesDisabled">
                <hr>
                <h2>{{ $t('shared.platformName') }}</h2>
                <STList class="illustration-list">    
                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Packages)">
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

                    <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Referrals)">
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

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Labs)">
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

                <template v-if="!isPlatform">
                    <hr>
                    <h2>Functies gratis uitproberen</h2>
                    <p>Je kan alle functies van Stamhoofd gratis uitproberen in een demo-versie. Je kan de demo-versie enkel gebruiken om zelf alle functies te testen, niet om extern te gebruiken. Zodra je het in gebruik wilt nemen kan je overschakelen op één van onze pakketten. We rekenen nooit kosten aan zonder dit duidelijk te communiceren en hiervoor toestemming te vragen.</p>

                    <ModuleSettingsBox />
                </template>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { AdminsView, EditEmailTemplatesView, EmailSettingsView, RecordsConfigurationView, STList, STListItem, STNavigationBar, Toast, useContext, useFeatureFlag, useMembersPackage, usePlatform, useSalesDisabled } from "@stamhoofd/components";

import { ArrayDecoder, AutoEncoderPatchType, Decoder } from "@simonbackx/simple-encoding";
import { defineRoutes, useNavigate, usePresent } from "@simonbackx/vue-app-navigation";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { useOrganizationManager, useRequestOwner } from "@stamhoofd/networking";
import { EmailTemplate, EmailTemplateType, Organization, OrganizationMetaData, OrganizationRecordsConfiguration, StripeAccount } from "@stamhoofd/structures";
import { ComponentOptions, computed, ref, Ref } from "vue";
import { buildManageGroupsComponent } from "./buildManageGroupsComponent";
import GeneralSettingsView from "./GeneralSettingsView.vue";
import LabsView from "./LabsView.vue";
import FreeContributionSettingsView from "./modules/members/FreeContributionSettingsView.vue";
import ModuleSettingsBox from './ModuleSettingsBox.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';
import PackageSettingsView from "./packages/PackageSettingsView.vue";
import PaymentSettingsView from "./PaymentSettingsView.vue";
import PersonalizeSettingsView from "./PersonalizeSettingsView.vue";
import PrivacySettingsView from "./PrivacySettingsView.vue";
import ReferralView from "./ReferralView.vue";
import RegistrationPageSettingsView from "./RegistrationPageSettingsView.vue";
import RegistrationPaymentSettingsView from "./RegistrationPaymentSettingsView.vue";
import SSOSettingsView from "./SSOSettingsView.vue";

enum Routes {
    General = 'algemeen',
    Personalization = 'personaliseren',
    Privacy = 'privacy',
    PaymentAccounts = 'betaal-accounts',
    Admins = 'beheerders',
    EmailTemplates = 'email-templates',
    EmailSettings = 'emailadressen',
    RegistrationPaymentMethods = 'inschrijvingen/betaalmethodes',
    RegistrationPage = 'inschrijvingen/pagina',
    RegistrationGroups = 'inschrijvingen/groepen',
    RegistrationRecords = 'inschrijvingen/vragenlijsten',
    RegistrationFreeContributions = 'inschrijvingen/vrije-bijdrage',
    SingleSignOn = 'sso',
    Packages = 'pakketten',
    Referrals = 'referrals',
    Labs = 'experimenten'
}

const isPlatform = STAMHOOFD.userMode === 'platform';
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const present = usePresent();

defineRoutes([
    {
        url: Routes.General,
        component: GeneralSettingsView as unknown as ComponentOptions,
        present: 'popup'
    },
    {
        url: Routes.Personalization,
        component: PersonalizeSettingsView as unknown as ComponentOptions,
        present: 'popup'
    },
    {
        url: Routes.Privacy,
        component: PrivacySettingsView as unknown as ComponentOptions,
        present: 'popup'
    },
    {
        url: Routes.PaymentAccounts,
        component: PaymentSettingsView as unknown as ComponentOptions,
        present: 'popup'
    },
    {
        url: Routes.Admins,
        component: AdminsView as ComponentOptions,
    },
    {
        url: Routes.EmailTemplates,
        present: 'popup',
        component: EditEmailTemplatesView as ComponentOptions,
        paramsToProps() {
            return {
                types: [...Object.values(EmailTemplateType)].filter(t => EmailTemplate.allowOrganizationLevel(t))
            }
        }
    },
    {
        url: Routes.EmailSettings,
        present: 'popup',
        component: EmailSettingsView as ComponentOptions,
    },
    {
        url: Routes.RegistrationPaymentMethods,
        present: 'popup',
        component: RegistrationPaymentSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.RegistrationPage,
        present: 'popup',
        component: RegistrationPageSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.RegistrationGroups,
        present: 'popup',
        handler: async (options) => {
            const component = buildManageGroupsComponent($organizationManager.value)

            await present({
                ...(options as any),
                components: [component]
            })
        }
    },
    {
        url: Routes.RegistrationRecords,
        present: 'popup',
        component: RecordsConfigurationView as ComponentOptions,
        paramsToProps() {
            return {
                inheritedRecordsConfiguration: OrganizationRecordsConfiguration.build({platform: platform.value}),
                recordsConfiguration: $organizationManager.value.organization.meta.recordsConfiguration,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                    await $organizationManager.value.patch(Organization.patch({
                        id: $organizationManager.value.organization.id,
                        meta: OrganizationMetaData.patch({
                            recordsConfiguration: patch
                        })
                    }))
                    Toast.success("De aanpassingen zijn opgeslagen").show();
                }
            }
        }
    },
    {
        url: Routes.RegistrationFreeContributions,
        present: 'popup',
        component: FreeContributionSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.SingleSignOn,
        present: 'popup',
        component: SSOSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.Packages,
        present: 'popup',
        component: PackageSettingsView as unknown as ComponentOptions,
    },
    {
        url: Routes.Referrals,
        present: 'popup',
        component: ReferralView as unknown as ComponentOptions,
    },
    {
        url: Routes.Labs,
        present: 'popup',
        component: LabsView as unknown as ComponentOptions,
    }
])
const $navigate = useNavigate()
const stripeAccounts = ref([]) as Ref<StripeAccount[]>
const loadingStripeAccounts = ref(false)
const context = useContext()
const owner = useRequestOwner()
const feature = useFeatureFlag();
const stripeWarnings = computed(() => {
    return stripeAccounts.value.flatMap(a => a.warning ? [a.warning] : [])
})
const $t = useTranslate()
const salesDisabled = useSalesDisabled()
const membersPackage = useMembersPackage()
loadStripeAccounts(null).catch(console.error)

async function loadStripeAccounts(recheckStripeAccount: string | null) {
    try {
        loadingStripeAccounts.value = true
        if (recheckStripeAccount) {
            try {
                await context.value.authenticatedServer.request({
                    method: "POST",
                    path: "/stripe/accounts/" + encodeURIComponent(recheckStripeAccount),
                    decoder: StripeAccount as Decoder<StripeAccount>,
                    owner
                })
            } catch (e) {
                console.error(e)
            }
        }
        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/stripe/accounts",
            decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
            owner
        })
        stripeAccounts.value = response.data

        if (!recheckStripeAccount) {
            for (const account of stripeAccounts.value) {
                try {
                    const response = await context.value.authenticatedServer.request({
                        method: "POST",
                        path: "/stripe/accounts/" + encodeURIComponent(account.id),
                        decoder: StripeAccount as Decoder<StripeAccount>,
                        owner
                    })
                    account.deepSet(response.data)
                } catch (e) {
                    console.error(e)
                }
            }
        }
    } catch (e) {
        console.error(e)
    }
    loadingStripeAccounts.value = false
}

</script>
