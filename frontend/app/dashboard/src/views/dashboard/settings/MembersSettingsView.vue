<template>
    <div id="members-settings-view" class="st-view background">
        <STNavigationBar :title="$t(`Leden`)">
            <template #right>
                <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                    <span class="icon external" />
                    <span class="hide-small">{{ $t('Ledenportaal') }}</span>
                </a>
            </template>
        </STNavigationBar>

        <main class="center force">
            <h1>
                {{ $t('Ledenadministratie instellingen') }}
            </h1>

            <BillingWarningBox filter-types="members" />

            <template v-if="!$isPlatform">
                <STInputBox class="max" :title="$t('Link naar ledenportaal')">
                    <div v-copyable="organization.registerUrl" v-tooltip="$t('Kopiëren')" class="input-with-buttons">
                        <div>
                            <form novalidate class="input-icon-container icon earth small">
                                <input :value="organization.getRegistrationHost()" class="input" readonly="true" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
                            </form>
                        </div>
                        <div>
                            <button type="button" class="button text">
                                <span class="icon copy" />
                                <span class="hide-small">{{ $t('Kopiëren') }}</span>
                            </button>
                        </div>
                    </div>
                </STInputBox>
                <p v-if="false" class="style-description-small">
                    <I18nComponent :t="$t('Plaats een knop naar deze link op je website en deel het op je sociale media. Je kan het <button>hier</button> personaliseren.')">
                        <template #button="{content}">
                            <button type="button" class="inline-link" @click="$navigate(Routes.RegistrationPage)">
                                {{ content }}
                            </button>
                        </template>
                    </I18nComponent>
                </p>
                <hr>
            </template>

            <STList class="illustration-list">
                <STListItem v-if="!isPlatform && false" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.RegistrationPage)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/laptop.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%On') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Oo') }}
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
                        {{ $t('%41') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%2p') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
                <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.OrganizationRegistrationPeriods)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/calendar.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%3i') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%3e') }}
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
                        {{ $t('%Op') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Oq') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.BundleDiscounts)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/discount.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%15q') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%15r') }}
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
                        {{ $t('%Or') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Os') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.FinancialSupport)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/discount.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ platform.config.financialSupport?.title || FinancialSupportSettings.defaultTitle }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%1Te') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.DataPermissions)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/agreement.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%vY') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%5j') }}
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
                        {{ $t('%Ot') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%Ou') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('Acties') }}</h2>

            <STList>
                <STListItem v-if="!$isPlatform" v-copyable="organization.registerUrl" :selectable="true" class="left-center">
                    <template #left>
                        <IconContainer icon="link" />
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%az') }}
                    </h2>
                    <div class="option">
                        <input class="input" :value="organization.registerUrl" readonly>
                    </div>
                </STListItem>

                <STListItem v-copyable="organization.registerUrl" :selectable="true" class="left-center" @click="$navigate(Routes.MembersImport)">
                    <template #left>
                        <IconContainer icon="upload" />
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Leden importeren') }}
                    </h2>

                    <p class="style-description-small">
                        {{ $t('%18d') }}
                    </p>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import BundleDiscountSettingsView from '@stamhoofd/components/bundle-discounts/BundleDiscountSettingsView.vue';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import EditRegistrationPeriodsView from '@stamhoofd/components/periods/EditRegistrationPeriodsView.vue';
import RecordsConfigurationView from '@stamhoofd/components/records/RecordsConfigurationView.vue';

import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { DataPermissionSettingsView, FinancialSupportSettingsView } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import type { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { DataPermissionsSettings, FinancialSupportSettings, getDataPermissionSettingsOrDefault, getFinancialSupportSettingsOrDefault, Organization, OrganizationMetaData, OrganizationRecordsConfiguration, PaymentMethod } from '@stamhoofd/structures';
import RegistrationPageSettingsView from './RegistrationPageSettingsView.vue';
import RegistrationPaymentSettingsView from './RegistrationPaymentSettingsView.vue';
import { useEditGroupsView } from './hooks/useEditGroupsView';
import FreeContributionSettingsView from './modules/members/FreeContributionSettingsView.vue';
import ImportMembersView from './modules/members/ImportMembersView.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import { computed, onMounted, ref } from 'vue';
import PackageSettingsView from './packages/PackageSettingsView.vue';
import { Country } from '@stamhoofd/types/Country';

enum Routes {
    Privacy = 'privacy',
    PaymentAccounts = 'betaal-accounts',
    Admins = 'beheerders',
    EmailTemplates = 'email-templates',
    EmailSettings = 'emailadressen',
    RegistrationPaymentMethods = 'inschrijvingen/betaalmethodes',
    RegistrationPage = 'inschrijvingen/pagina',
    RegistrationGroups = 'inschrijvingen/groepen',
    BundleDiscounts = 'inschrijvingen/kortingen',
    RegistrationRecords = 'inschrijvingen/persoonsgegevens',
    RegistrationFreeContributions = 'inschrijvingen/vrije-bijdrage',
    SingleSignOn = 'sso',
    Packages = 'functionaliteiten',
    PaymentSettings = 'betalingen',
    Referrals = 'referrals',
    Labs = 'experimenten',
    Premises = 'lokalen',
    BalanceNotifications = 'openstaande-bedragen-notificaties',
    MembersImport = 'leden-importeren',
    Uitpas = 'uitpas',
    OrganizationRegistrationPeriods = 'werkjaren',
    FinancialSupport = 'financiele-ondersteuning',
    DataPermissions = 'toestemming-gegevensverzameling',
    Invoices = 'uitgaande-facturen',
}

const isPlatform = STAMHOOFD.userMode === 'platform';
const $organizationManager = useOrganizationManager();
const platform = usePlatform();
const present = usePresent();
const buildEditGroupsView = useEditGroupsView();
const organization = useRequiredOrganization();
const patchOrganizationPeriod = usePatchOrganizationPeriod();

defineRoutes([
    {
        url: Routes.RegistrationPaymentMethods,
        present: 'popup',
        component: RegistrationPaymentSettingsView,
    },
    {
        url: Routes.RegistrationPage,
        present: 'popup',
        component: RegistrationPageSettingsView,
    },
    {
        url: Routes.RegistrationGroups,
        present: 'popup',
        handler: async (options) => {
            const component = await buildEditGroupsView();

            await present({
                ...options,
                components: [component],
            });
        },
    },
    {
        url: Routes.BundleDiscounts,
        present: 'popup',
        component: BundleDiscountSettingsView,
        paramsToProps() {
            return {
                period: organization.value!.period,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    patch.id = organization.value!.period.id;
                    await patchOrganizationPeriod(patch);
                },
            };
        },
    },
    {
        url: Routes.RegistrationRecords,
        present: 'popup',
        component: RecordsConfigurationView,
        paramsToProps() {
            return {
                inheritedRecordsConfiguration: OrganizationRecordsConfiguration.build({ platform: platform.value }),
                recordsConfiguration: $organizationManager.value.organization.meta.recordsConfiguration,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                    await $organizationManager.value.patch(Organization.patch({
                        id: $organizationManager.value.organization.id,
                        meta: OrganizationMetaData.patch({
                            recordsConfiguration: patch,
                        }),
                    }));
                    Toast.success('De aanpassingen zijn opgeslagen').show();
                },
            };
        },
    },
    {
        url: Routes.RegistrationFreeContributions,
        present: 'popup',
        component: FreeContributionSettingsView,
    },
    {
        url: Routes.MembersImport,
        present: 'popup',
        component: ImportMembersView,
    },
    {
        url: Routes.OrganizationRegistrationPeriods,
        present: 'popup',
        component: EditRegistrationPeriodsView,
    },
    ...(!isPlatform
        ? [
                {
                    name: Routes.FinancialSupport,
                    url: 'financiele-ondersteuning',
                    component: FinancialSupportSettingsView,
                    paramsToProps() {
                        return {
                            financialSupport: getFinancialSupportSettingsOrDefault(platform.value, organization.value),
                            saveHandler: async (patch: AutoEncoderPatchType<FinancialSupportSettings>) => {
                                const isNew = !organization.value?.meta.financialSupport;
                                await $organizationManager.value.patch(Organization.patch({
                                    meta: OrganizationMetaData.patch({
                                        financialSupport: isNew ? FinancialSupportSettings.create({}).patch(patch) : patch,
                                    }),
                                }));
                                Toast.success($t(`%HU`)).show();
                            },
                        };
                    },
                    present: 'popup' as const,
                },
                {
                    name: Routes.DataPermissions,
                    url: 'toestemming-gegevensverzameling',
                    component: DataPermissionSettingsView,
                    paramsToProps() {
                        return {
                            dataPermission: getDataPermissionSettingsOrDefault(platform.value, organization.value),
                            saveHandler: async (patch: AutoEncoderPatchType<DataPermissionsSettings>) => {
                                const isNew = !organization.value?.meta.dataPermission;
                                await $organizationManager.value.patch(Organization.patch({
                                    meta: OrganizationMetaData.patch({
                                        dataPermission: isNew ? DataPermissionsSettings.create({}).patch(patch) : patch,
                                    }),
                                }));
                                Toast.success($t(`%HU`)).show();
                            },
                        };
                    },
                    present: 'popup' as const,
                },
            ]
        : []),
]);

const $navigate = useNavigate();

function openPackages() {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(PackageSettingsView),
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

const openTodoList = ref(true);

onMounted(() => {
    try {
        if (localStorage.getItem('hideMembersOnboarding') === 'true') {
            openTodoList.value = false;
        }
    } catch (e) {
        console.error('Could not read from localStorage', e);
    }
});

function toggleTodoList() {
    openTodoList.value = !openTodoList.value;
    try {
        if (!openTodoList.value) {
            localStorage.setItem('hideMembersOnboarding', 'true');
        } else {
            localStorage.removeItem('hideMembersOnboarding');
        }
    } catch (e) {
        console.error('Could not write to localStorage', e);
    }
}
const todoList = computed(() => {
    const list: {
        icon: string;
        subIcon?: string;
        title: string;
        description: string;
        action: () => Promise<void> | void;
        done: boolean;
    }[] = [];

    list.push({
        icon: 'bank',
        title: 'Stel online betalingen in',
        description: organization.value.address?.country === Country.Netherlands ? 'Zorg dat bestellers via iDEAL of creditcard kunnen betalen.' : 'Zorg dat bestellers via Bancontact, Payconiq of creditcard kunnen betalen.',
        action: () => $navigate(Routes.RegistrationPaymentMethods),
        done: organization.value.meta.registrationPaymentConfiguration.paymentMethods.includes(PaymentMethod.CreditCard)
            || organization.value.meta.registrationPaymentConfiguration.paymentMethods.includes(PaymentMethod.iDEAL)
            || organization.value.meta.registrationPaymentConfiguration.paymentMethods.includes(PaymentMethod.Bancontact)
            || organization.value.meta.registrationPaymentConfiguration.paymentMethods.includes(PaymentMethod.Payconiq)
            || organization.value.meta.registrationPaymentConfiguration.paymentMethods.includes(PaymentMethod.Transfer),
    });

    list.push({
        icon: 'calendar',
        title: 'Stel je werkjaren in',
        description: 'Stel de start en einddatum van je werkjaar, semester of kwartaal in ',
        action: () => $navigate(Routes.OrganizationRegistrationPeriods),
        done: organization.value.period.adminCategoryTree.getAllGroups().length > 0,
    });

    list.push({
        icon: 'group',
        title: 'Stel je inschrijvingsgroepen in',
        description: 'Deel je leden op in groepen en categorieën',
        action: () => $navigate(Routes.RegistrationGroups),
        done: organization.value.period.adminCategoryTree.getAllGroups().length > 0,
    });

    /* list.push({
        icon: webshopManager.value.preview.meta.ticketType === WebshopTicketType.Tickets ? 'ticket' : 'box',
        subIcon: 'add',
        title: webshopManager.value.preview.meta.ticketType === WebshopTicketType.Tickets ? 'Voeg tickets toe aan je webshop' : 'Voeg artikels toe aan je webshop',
        description: webshopManager.value.preview.meta.ticketType === WebshopTicketType.Tickets ? 'Geef al dan niet de keuze uit verschillende tickets, of voeg gewoon één ticket toe.' : 'Geef al dan niet de keuze uit verschillende artikels of voeg gewoon één artikel toe.',
        action: () => editProducts(),
        done: !!webshop.value?.products && webshop.value.products.length > 0,
    });

    if (webshopManager.value.preview.meta.type === WebshopType.Performance) {
        list.push({
            icon: 'seat',
            title: 'Koppel een zaalplan',
            description: 'Lees de gids door hoe je een zaalplan instelt.',
            action: () => openSeatDocs(),
            done: !!webshop.value?.products && webshop.value.products.some(p => p.seatingPlanId !== null),
        });
    }

    if (webshopManager.value.preview.meta.type === WebshopType.TakeawayAndDelivery) {
        list.push({
            icon: 'location',
            subIcon: 'add',
            title: 'Stel afhaal of leveringsmethodes in',
            description: 'Stel in hoe, waar en wanneer bestellers hun bestelling kunnen afhalen of geleverd krijgen.',
            action: () => editCheckoutMethods(),
            done: webshopManager.value.preview.meta.checkoutMethods.length > 0,
        });
    }

    if (webshopManager.value.preview.meta.type === WebshopType.TakeawayAndDelivery) {
        list.push({
            icon: 'image',
            title: 'Stel een omslagfoto, logo, kleur en beschrijving in',
            description: 'Maak je webshop helemaal professioneel door deze in te stellen.',
            action: () => editPage(),
            done: webshopManager.value.preview.meta.description.text.length > 0
                || !!webshopManager.value.preview.meta.useLogo
                || !!webshopManager.value.preview.meta.color
                || !!webshopManager.value.preview.meta.title,
        });
    }

    if (webshopManager.value.preview.meta.status !== WebshopStatus.Open) {
        list.push({
            icon: 'clock',
            title: 'Open je webshop als je er klaar voor bent',
            description: 'Je kan je webshop openen op een bepaald tijdstip, of manueel via de knop onderaan.',
            action: () => editGeneral(),
            done: false,
        });
    }

    if (organization.value.meta.packages.isWebshopsTrial) {
        list.push({
            icon: 'power',
            title: 'Activeer Stamhoofd als je wilt beginnen verkopen',
            description: 'Beëindig je proefperiode en ga van start',
            action: () => openPackages(),
            done: false,
        });
    } */

    if (organization.value.meta.packages.isMembersTrial) {
        list.push({
            icon: 'power',
            title: 'Activeer Stamhoofd om leden in het echt te laten inschrijven',
            description: 'Tijdens de proefperiode kan je zelf fictieve test leden naar hartelust inschrijven en daarna weer verwijderen',
            action: () => openPackages(),
            done: false,
        });
    }

    // If all done, return empty list
    if (list.every(i => i.done)) {
        return [];
    }

    // Sort by moving all done items to the end
    list.sort((a, b) => {
        if (a.done && !b.done) {
            return 1;
        }
        if (!a.done && b.done) {
            return -1;
        }
        return 0;
    });

    return list;
});

</script>
