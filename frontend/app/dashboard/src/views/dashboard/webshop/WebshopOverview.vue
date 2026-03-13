<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title" />

        <main class="center">
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
                        {{ $t('%1JX') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%PX') }}
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
                        {{ $t('%uA') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%PY') }}
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
                        {{ $t('%1j') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%PZ') }}
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
                        {{ $t('%Pa') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%Pb') }}
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
                        {{ $t('%Pc') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%Pd') }} {{ webshopUrl }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="hasFullPermissions">
                <hr>
                <h2>{{ $t('%xU') }}</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%Lb') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pe') }}
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
                            {{ $t('%Pf') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pg') }}
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
                            {{ $t('%Ph') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pi') }}
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
                            {{ $t('%Pj') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pk') }}
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
                            {{ $t('%O7') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pl') }}
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
                            {{ $t('%Pm') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pn') }}
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
                            {{ $t('%Po') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pp') }}
                        </p>

                        <template #right>
                            <span class="icon error " :v-tooltip="$t('%Pq')" />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editRecordSettings(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%u1') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pp') }}
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
                            {{ $t('%Ld') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pr') }}
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
                            {{ $t('%1FR') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Ps') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('%ty') }}</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%Pt') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pu') }}
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
                            {{ $t('%2H') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pv') }}
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
                            {{ $t('%1DD') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Pw') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('%16X') }}</h2>

                <STList>
                    <STListItem v-if="isOpen" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('%Px') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Py') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon power" />
                                <span>{{ $t('%9b') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="openWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('%Pz') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Q0') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary green hide-smartphone">
                                <span class="icon power" />
                                <span>{{ $t('%Ob') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="archiveWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('%Q1') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Q2') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon archive" />
                                <span>{{ $t('%Q3') }}</span>
                            </button>
                            <button type="button" class="button icon archive only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('%Q4') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Q5') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon undo" />
                                <span>{{ $t('%KL') }}</span>
                            </button>
                            <button type="button" class="button icon undo only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" @click="duplicateWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('%Q6') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Q7') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon copy" />
                                <span>{{ $t('%KK') }}</span>
                            </button>
                            <button type="button" class="button icon copy only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem class="hoverable" :selectable="true" element-name="a" :href="webshopQrCodeUrl" target="_blank">
                        <h2 class="style-title-list">
                            {{ $t('%1Gb') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%1Gc') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon qr-code" />
                                <span>{{ $t('%1Gd') }}</span>
                            </button>
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="deleteWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('%Q8') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Q9') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash" />
                                <span>{{ $t('%CJ') }}</span>
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
import AccountSettingsView from '@stamhoofd/components/views/AccountSettingsView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import EditEmailTemplatesView from '@stamhoofd/components/email/EditEmailTemplatesView.vue';
import EditResourceRolesView from '@stamhoofd/components/admins/EditResourceRolesView.vue';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { AccessRight, EmailTemplate, EmailTemplateType, PermissionLevel, PermissionsResourceType, PrivateWebshop, WebshopMetaData, WebshopPreview, WebshopStatus, WebshopTicketType } from '@stamhoofd/structures';

import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
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
import EditWebshopRecordSettingsView from './edit/EditWebshopRecordSettingsView.vue';
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

const auth = useAuth();
const isOpen = computed(() => !webshopManager.value.preview.isClosed());
const isArchive = computed(() => webshopManager.value.preview.meta.status === WebshopStatus.Archived);
const title = computed(() => props.preview.meta.name);
const webshopUrl = computed(() => props.preview.getUrl(organization.value!));
const webshopQrCodeUrl = computed(() => {
    const link = `https://${webshopUrl.value}`;
    return `https://qrcode.stamhoofd.be?link=${encodeURIComponent(link)}`;
});

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
    displayEditComponent(EditWebshopRecordSettingsView, animated);
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
    webshopManager.value.closeDatabase();
    document.removeEventListener('visibilitychange', doRefresh);
});

function doRefresh() {
    if (document.visibilityState === 'visible') {
        webshopManager.value.backgroundReloadWebshop();
    }
}

reload();
</script>
