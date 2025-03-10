<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title" />

        <main>
            <h1 class="style-navigation-title with-icons">
                <span>{{ title }}</span>

                <span v-if="isOpen" class="icon dot green" />
                <span v-else-if="isArchive" class="icon archive" />
                <span v-else class="icon dot red" />
            </h1>

            <BillingWarningBox filter-types="webshops" class="data-table-prefix" />

            <STList class="illustration-list">
                <STListItem v-if="hasReadPermissions" :selectable="true" class="left-center" @click="openOrders(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/cart.svg">
                    </template>
                    <h2 class="style-title-list">
                        Bestellingen
                    </h2>
                    <p class="style-description">
                        Bekijk en exporteer bestellingen, e-mail en SMS klanten.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="hasSeating && hasReadPermissions" :selectable="true" class="left-center" @click="openSeating(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/seating-plan.svg">
                    </template>
                    <h2 class="style-title-list">
                        Zaaloverzicht
                    </h2>
                    <p class="style-description">
                        Bekijk welke plaatsen door welke personen zijn ingenomen.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="hasTickets && hasScanPermissions" :selectable="true" class="left-center" @click="openTickets(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/scanner.svg">
                    </template>
                    <h2 class="style-title-list">
                        Scan tickets
                    </h2>
                    <p class="style-description">
                        Gebruik je camera om snel tickets te scannen.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="hasReadPermissions" :selectable="true" class="left-center" @click="openStatistics(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/diagram.svg">
                    </template>
                    <h2 class="style-title-list">
                        Statistieken
                    </h2>
                    <p class="style-description">
                        Bekijk jouw omzet en andere statistieken.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" element-name="a" :href="'https://'+webshopUrl" target="_blank">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/earth.svg">
                    </template>
                    <h2 class="style-title-list">
                        Bekijk jouw webshop
                    </h2>
                    <p class="style-description">
                        Jouw webshop is bereikbaar via {{ webshopUrl }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="hasFullPermissions">
                <hr>
                <h2>Instellingen</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                        </template>
                        <h2 class="style-title-list">
                            Algemeen
                        </h2>
                        <p class="style-description">
                            Naam, type en beschikbaarheid.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editProducts(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-package.svg">
                        </template>
                        <h2 class="style-title-list">
                            Productaanbod
                        </h2>
                        <p class="style-description">
                            Bewerk welke artikels je verkoopt in jouw webshop.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editProducts(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/tickets.svg">
                        </template>
                        <h2 class="style-title-list">
                            Aanbod tickets en vouchers
                        </h2>
                        <p class="style-description">
                            Bewerk en voeg nieuwe tickets en vouchers toe aan je webshop.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editCheckoutMethods(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/bike.svg">
                        </template>
                        <h2 class="style-title-list">
                            Afhalen, leveren, ter plaatse eten
                        </h2>
                        <p class="style-description">
                            Wijzig tijdstippen, locaties en afhaalmethodes.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPaymentMethods(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg">
                        </template>
                        <h2 class="style-title-list">
                            Betaalmethodes
                        </h2>
                        <p class="style-description">
                            Kies welke betaalmethodes je wilt activeren, en stel eventueel administratiekosten in.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editDiscounts(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/discount.svg">
                        </template>
                        <h2 class="style-title-list">
                            Kortingen
                        </h2>
                        <p class="style-description">
                            Voeg kortingen toe aan je webshop.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="preview.meta.customFields.length" :selectable="true" class="left-center" @click="editInputFields(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
                        </template>
                        <h2 class="style-title-list">
                            Vrije invoervelden
                        </h2>
                        <p class="style-description">
                            Verzamel extra informatie van bestellers bij het afrekenen.
                        </p>

                        <template #right>
                            <span v-tooltip="'Deze functie is verouderd. Als je alle vrije invoervelden wist, kan je gebruik maken van uitgebreidere vragenlijsten.'" class="icon error " />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editRecordSettings(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
                        </template>
                        <h2 class="style-title-list">
                            Vragenlijsten en gegevens
                        </h2>
                        <p class="style-description">
                            Verzamel extra informatie van bestellers bij het afrekenen.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPermissions(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                        </template>
                        <h2 class="style-title-list">
                            Toegangsbeheer
                        </h2>
                        <p class="style-description">
                            Bepaal wie bestellingen en instellingen van deze webshop kan bekijken of wijzigen.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editNotifications(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/notifications.svg">
                        </template>
                        <h2 class="style-title-list">
                            Meldingen
                        </h2>
                        <p class="style-description">
                            Blijf zelf op de hoogte van nieuwe bestellingen.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr>
                <h2>Personaliseren</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                        </template>
                        <h2 class="style-title-list">
                            Tekst, uiterlijk, en externe links
                        </h2>
                        <p class="style-description">
                            Wijzig de teksten en uitzicht van jouw webshop.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editLink(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/compass.svg">
                        </template>
                        <h2 class="style-title-list">
                            Link
                        </h2>
                        <p class="style-description">
                            Wijzig de link van jouw webshop.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editEmails(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/email.svg">
                        </template>
                        <h2 class="style-title-list">
                            E-mailsjablonen
                        </h2>
                        <p class="style-description">
                            Wijzig de inhoud van automatische e-mails naar bestellers.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr>
                <h2>Acties</h2>

                <STList>
                    <STListItem v-if="isOpen" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            Webshop sluiten
                        </h2>
                        <p class="style-description">
                            Sluit de webshop, zodat geen nieuwe bestellingen meer mogelijk zijn.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon power" />
                                <span>Sluiten</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="openWebshop()">
                        <h2 class="style-title-list">
                            Webshop terug openen
                        </h2>
                        <p class="style-description">
                            Open de webshop opnieuw.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary green hide-smartphone">
                                <span class="icon power" />
                                <span>Openen</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="archiveWebshop()">
                        <h2 class="style-title-list">
                            Webshop archiveren
                        </h2>
                        <p class="style-description">
                            Verplaats de webshop naar het archief, maar behoud alle gegevens. De webshop is dan niet meer zo prominent zichtbaar in het menu.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon archive" />
                                <span>Archiveren</span>
                            </button>
                            <button type="button" class="button icon archive only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            Webshop uit archief halen
                        </h2>
                        <p class="style-description">
                            Verplaats de webshop terug naar het hoofdmenu.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon undo" />
                                <span>Terugzetten</span>
                            </button>
                            <button type="button" class="button icon undo only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" @click="duplicateWebshop()">
                        <h2 class="style-title-list">
                            Webshop dupliceren
                        </h2>
                        <p class="style-description">
                            Maak een nieuwe webshop met dezelfde instellingen, maar met een andere naam en link.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon copy" />
                                <span>Dupliceren</span>
                            </button>
                            <button type="button" class="button icon copy only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="deleteWebshop()">
                        <h2 class="style-title-list">
                            Webshop definitief verwijderen
                        </h2>
                        <p class="style-description">
                            Verwijder deze webshop en alle daarbij horende informatie en bestellingen. Dit is meestal niet nodig.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash" />
                                <span>Verwijderen</span>
                            </button>
                            <button type="button" class="button icon trash only-smartphone" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, useCanPop, usePop, usePresent, useShow, useSplitViewController } from '@simonbackx/vue-app-navigation';
import { AccountSettingsView, CenteredMessage, EditEmailTemplatesView, EditResourceRolesView, PromiseView, STList, STListItem, STNavigationBar, Toast, useAuth, useContext, useOrganization } from '@stamhoofd/components';
import { AccessRight, EmailTemplate, EmailTemplateType, PermissionLevel, PermissionsResourceType, PrivateWebshop, WebshopMetaData, WebshopPreview, WebshopStatus, WebshopTicketType } from '@stamhoofd/structures';

import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { computed, onBeforeUnmount, ref } from 'vue';
import BillingWarningBox from '../settings/packages/BillingWarningBox.vue';
import EditWebshopCheckoutMethodsView from './edit/EditWebshopCheckoutMethodsView.vue';
import EditWebshopDiscountsView from './edit/EditWebshopDiscountsView.vue';
import EditWebshopGeneralView from './edit/EditWebshopGeneralView.vue';
import EditWebshopInputFieldsView from './edit/EditWebshopInputFieldsView.vue';
import EditWebshopLinkView from './edit/EditWebshopLinkView.vue';
import EditWebshopNotificationsView from './edit/EditWebshopNotificationsView.vue';
import EditWebshopPageView from './edit/EditWebshopPageView.vue';
import EditWebshopPaymentMethodsView from './edit/EditWebshopPaymentMethodsView.vue';
import EditWebshopProductsView from './edit/EditWebshopProductsView.vue';
import EditWebshopRecordSettings from './edit/EditWebshopRecordSettings.vue';
import WebshopOrdersView from './orders/WebshopOrdersView.vue';
import WebshopSeatingView from './orders/WebshopSeatingView.vue';
import WebshopStatisticsView from './statistics/WebshopStatisticsView.vue';
import TicketScannerSetupView from './tickets/TicketScannerSetupView.vue';
import { WebshopManager } from './WebshopManager';

const props = defineProps<{ preview: WebshopPreview }>();
const context = useContext();
const organizationManager = useOrganizationManager();
const organization = useOrganization();
const show = useShow();
const present = usePresent();
const pop = usePop();
const canPop = useCanPop();
const splitViewController = useSplitViewController();
const owner = useRequestOwner();

const loading = ref(false);
const webshopManager = ref(new WebshopManager(context.value, props.preview));
const webshop = computed(() => webshopManager.value.webshop);

function reload() {
    loading.value = true;

    webshopManager.value.loadWebshopIfNeeded().catch((e) => {
        console.error(e);
        Toast.fromError(e).show();
    }).finally(() => {
        loading.value = false;
    });
}

function getFeatureFlag(flag: string) {
    return organization.value?.privateMeta?.featureFlags.includes(flag) ?? false;
}

const auth = useAuth();
const isOpen = computed(() => !webshopManager.value.preview.isClosed());
const isArchive = computed(() => webshopManager.value.preview.meta.status === WebshopStatus.Archived);
const title = computed(() => props.preview.meta.name);
const webshopUrl = computed(() => props.preview.getUrl(organization.value!));
const hasFullPermissions = computed(() => auth.canAccessWebshop(props.preview, PermissionLevel.Full));
const hasReadPermissions = computed(() => auth.canAccessWebshop(props.preview, PermissionLevel.Read, false));

const hasScanPermissions = computed(() => auth.canAccessWebshopTickets(props.preview, PermissionLevel.Write));
const isTicketsOnly = computed(() => webshopManager.value.preview.meta.ticketType === WebshopTicketType.Tickets);
const hasTickets = computed(() => webshopManager.value.preview.meta.ticketType !== WebshopTicketType.None);
const hasSeating = computed(() => webshopManager.value.preview.meta.seatingPlans.length > 0 && (!webshop.value || !!webshop.value?.products?.find(p => p.seatingPlanId !== null)));

function openOrders(animated = true) {
    show({
        animated,
        adjustHistory: animated,
        components: [
            new ComponentWithProperties(WebshopOrdersView, {
                webshopManager: webshopManager.value,
            }),
        ],
    }).catch(console.error);
}

function openSeating(animated = true) {
    show({
        animated,
        adjustHistory: animated,
        components: [
            new ComponentWithProperties(WebshopSeatingView, {
                webshopManager: webshopManager.value,
            }),
        ],
    }).catch(console.error);
}

function openStatistics(animated = true) {
    show({
        animated,
        adjustHistory: animated,
        components: [
            new ComponentWithProperties(WebshopStatisticsView, {
                webshopManager: webshopManager.value,
            }),
        ],
    }).catch(console.error);
}

function openTickets(animated = true) {
    show({
        animated,
        adjustHistory: animated,
        components: [
            new ComponentWithProperties(TicketScannerSetupView, {
                webshopManager: webshopManager.value,
            }),
        ],
    }).catch(console.error);
}

function editGeneral(animated = true) {
    displayEditComponent(EditWebshopGeneralView, animated);
}

function editPage(animated = true) {
    displayEditComponent(EditWebshopPageView, animated);
}

function editLink(animated = true) {
    displayEditComponent(EditWebshopLinkView, animated);
}

function editProducts(animated = true) {
    displayEditComponent(EditWebshopProductsView, animated);
}

function editDiscounts(animated = true) {
    displayEditComponent(EditWebshopDiscountsView, animated);
}

function editPaymentMethods(animated = true) {
    displayEditComponent(EditWebshopPaymentMethodsView, animated);
}

function editInputFields(animated = true) {
    displayEditComponent(EditWebshopInputFieldsView, animated);
}

function editRecordSettings(animated = true) {
    displayEditComponent(EditWebshopRecordSettings, animated);
}

function editCheckoutMethods(animated = true) {
    displayEditComponent(EditWebshopCheckoutMethodsView, animated);
}

function editPermissions(animated = true) {
    present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditResourceRolesView, {
                description: 'Kies hier welke beheerdersrollen deze webshop kunnen bekijken, bewerken of beheren.',
                resource: {
                    id: props.preview.id,
                    name: props.preview.meta.name,
                    type: PermissionsResourceType.Webshops,
                },
                configurableAccessRights: props.preview.hasTickets ? [AccessRight.WebshopScanTickets] : [],
            }),
        ],
    }).catch(console.error);
}

async function editEmails(animated = true) {
    await present({
        components: [
            new ComponentWithProperties(EditEmailTemplatesView, {
                groups: null,
                webshopId: props.preview.id,
                allowEditGenerated: false,
                types: [
                    EmailTemplateType.OrderConfirmationOnline,
                    EmailTemplateType.OrderConfirmationTransfer,
                    EmailTemplateType.OrderConfirmationPOS,
                    EmailTemplateType.OrderReceivedTransfer,
                    EmailTemplateType.TicketsConfirmation,
                    EmailTemplateType.TicketsConfirmationTransfer,
                    EmailTemplateType.TicketsConfirmationPOS,
                    EmailTemplateType.TicketsReceivedTransfer,
                ].filter(t => EmailTemplate.allowOrganizationLevel(t)),
            }),
        ],
        modalDisplayStyle: 'popup',
        animated,
    });
}

function editNotifications(animated = true) {
    displayEditComponent(EditWebshopNotificationsView, animated);
}

function displayEditComponent(component: any, animated = true) {
    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date webshop
                    await webshopManager.value.loadWebshopIfNeeded(false, true);
                    return new ComponentWithProperties(component, {
                        webshopManager: webshopManager.value,
                    });
                }
                catch (e) {
                    Toast.fromError(e).show();
                    throw e;
                }
            },
        }),
    });

    present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            displayedComponent,
        ],
    }).catch(console.error);
}

const canCreateWebshops = computed(() => context.value.organizationAuth.hasAccessRight(AccessRight.OrganizationCreateWebshops));

function duplicateWebshop() {
    if (!canCreateWebshops.value) {
        new Toast('Je hebt geen toegang om nieuwe webshops te maken. Vraag toegang aan een hoofdbeheerder van je vereniging.').show();
        return;
    }

    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date webshop
                    const webshop = await webshopManager.value.loadWebshopIfNeeded(false);
                    const duplicate = PrivateWebshop.create({
                        ...webshop.clone(),
                        id: undefined,
                    }).patch({
                        meta: WebshopMetaData.patch({
                            status: WebshopStatus.Open,
                        }),
                    });

                    // Set usedStock to 0
                    duplicate.clearStock();

                    const response = await context.value.authenticatedServer.request({
                        method: 'GET',
                        path: '/email-templates',
                        query: { webshopId: webshop.id },
                        shouldRetry: false,
                        owner,
                        decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>),
                    });
                    const templates = response.data;

                    return new ComponentWithProperties(EditWebshopGeneralView, {
                        initialWebshop: duplicate,
                        savedHandler: async (duplicateWebshop: PrivateWebshop) => {
                            // Copy over the templates
                            try {
                                const patchedArray: PatchableArrayAutoEncoder<EmailTemplate> = new PatchableArray();
                                for (const t of templates) {
                                    if (t.webshopId !== webshop.id) {
                                        // Skip default templates
                                        continue;
                                    }

                                    // Create a new duplicate
                                    const template = EmailTemplate.create({
                                        ...t,
                                        webshopId: duplicateWebshop.id,
                                        id: undefined,
                                    });
                                    patchedArray.addPut(template);
                                }

                                if (patchedArray.getPuts().length > 0) {
                                    await context.value.authenticatedServer.request({
                                        method: 'PATCH',
                                        path: '/email-templates',
                                        body: patchedArray,
                                        shouldRetry: false,
                                        owner,
                                    });
                                }
                            }
                            catch (e) {
                                console.error(e);
                                new Toast('Er ging iets mis bij het overnemen van de e-mails in de nieuwe webshop', 'warning').show();
                            }
                        },
                    });
                }
                catch (e) {
                    Toast.fromError(e).show();
                    throw e;
                }
            },
        }),
    });

    present({
        animated: true,
        adjustHistory: true,
        modalDisplayStyle: 'popup',
        components: [
            displayedComponent,
        ],
    }).catch(console.error);
}

async function closeWebshop() {
    if (isArchive.value) {
        if (!await CenteredMessage.confirm('Ben je zeker dat je de webshop wilt terugzetten?', 'Ja, terugzetten', 'Je kan daarna de webshop eventueel terug openen.')) {
            return;
        }
    }
    else {
        if (!await CenteredMessage.confirm("Ben je zeker dat je de webshop '" + webshopManager.value.preview.meta.name + "' wilt sluiten?", 'Ja, sluiten', 'Er kunnen daarna geen nieuwe bestellingen worden gemaakt. Je kan de webshop later terug openen.')) {
            return;
        }
    }

    try {
        await webshopManager.value.patchWebshop(
            PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    status: WebshopStatus.Closed,
                }),
            }),
        );
        new Toast('De webshop is gesloten', 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function openWebshop() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je de webshop terug wilt openen?', 'Ja, openen')) {
        return;
    }

    try {
        await webshopManager.value.patchWebshop(
            PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    status: WebshopStatus.Open,
                    availableUntil: null,
                }),
            }),
        );
        new Toast('De webshop is terug open', 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function archiveWebshop() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je de webshop wilt archiveren?', 'Ja, archiveren', 'De gegevens van de webshop blijven daarna nog bereikbaar, maar de webshop wordt niet meer zo prominent in het menu weergegeven.')) {
        return;
    }

    try {
        await webshopManager.value.patchWebshop(
            PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    status: WebshopStatus.Archived,
                }),
            }),
        );
        new Toast('De webshop is gearchiveerd', 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function deleteWebshop() {
    if (!await CenteredMessage.confirm("Ben je zeker dat je de webshop '" + webshopManager.value.preview.meta.name + "' wilt verwijderen?", 'Ja, verwijderen', 'Alle bijhorende bestellingen worden ook definitief verwijderd. Je kan dit niet ongedaan maken.')) {
        return;
    }

    try {
        await context.value.authenticatedServer.request({
            method: 'DELETE',
            path: '/webshop/' + webshopManager.value.preview.id,
            shouldRetry: false,
        });
        new Toast('Webshop verwijderd', 'success green').show();

        if (organization.value) {
            organization.value.webshops = organization.value.webshops.filter(w => w.id !== webshopManager.value.preview.id);
        }

        // Save updated organization to cache
        organizationManager.value.save().catch(console.error);

        if (canPop.value) {
            await pop({ force: true });
        }
        else {
            await splitViewController.value.showDetail({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(AccountSettingsView, {}),
                    }),
                ],
                animated: false,
            });
        }
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

onBeforeUnmount(() => {
    // Clear all pending requests
    Request.cancelAll(this);
    webshopManager.value.close();
    document.removeEventListener('visibilitychange', doRefresh);
});

function doRefresh() {
    if (document.visibilityState === 'visible') {
        webshopManager.value.backgroundReloadWebshop();
    }
}

reload();
</script>
