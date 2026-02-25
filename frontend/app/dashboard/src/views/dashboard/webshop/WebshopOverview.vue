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
                        {{ $t('fc1cc5ad-1590-422d-96a5-4523f10fcab1') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('30a87df1-5f18-4639-8f00-6b333f84d87f') }}
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
                        {{ $t('6a49e896-3491-4f6e-a947-d180fce6c6e8') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('558631c2-ee72-4b1e-a8d8-b58a3f863f3f') }}
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
                        {{ $t('a4919b04-c7de-4c7b-96ac-e18acc476ad7') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('b0b16292-fad7-4cc2-82ee-46155a484192') }}
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
                        {{ $t('121c350e-012c-4bf7-a2bc-2c07b7c433c8') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('9351f351-ef7a-4d6b-bfb4-ed0366ab8938') }}
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
                        {{ $t('c176d890-8c08-4db1-9ce7-592c1e21818e') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('1add9f17-2138-461d-8198-2b7bfde90407') }} {{ webshopUrl }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="hasFullPermissions">
                <hr>
                <h2>{{ $t('bab38c80-8ab6-4cb7-80c3-1f607057e45d') }}</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('35757756-d817-419d-82dd-1ba14128af30') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('7a8c848b-8ffe-488f-9635-43a2c2b10a9f') }}
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
                            {{ $t('14875409-7141-445f-b172-05762077d1dc') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('bc25fc1d-ee53-4200-a41e-2ec52bd9292b') }}
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
                            {{ $t('778d329e-b646-4cb4-87ac-f6ab1661c359') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('636f72d4-77f9-423d-b0f8-82a4fb594e11') }}
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
                            {{ $t('0474147e-6756-45a7-a687-04812bcef086') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('03142327-65eb-4694-986f-ee6ff25c2998') }}
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
                            {{ $t('12b644c9-c1a7-4930-afb2-79f62648d243') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('95aafd31-ffd2-44c1-b90c-58a5281af1f0') }}
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
                            {{ $t('2173a56e-ee80-4e8d-9551-20f061fff7b9') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('4881e4b6-2160-4f29-8e09-1fde96d8240a') }}
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
                            {{ $t('e98f3227-23ff-4db5-9326-10bc43548738') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('baad0752-43d1-4bea-9e39-3a9f4b518723') }}
                        </p>

                        <template #right>
                            <span class="icon error " :v-tooltip="$t('75c82427-9666-4de0-8a79-2a8851b44a88')" />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editRecordSettings(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('da5f0578-ebf9-40e1-8caf-baa3a7970b28') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('baad0752-43d1-4bea-9e39-3a9f4b518723') }}
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
                            {{ $t('70c5edd2-3550-447e-8a36-b43d7833fe1c') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('c653d048-3431-417a-b333-dc0af28113a3') }}
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
                            {{ $t('d5bbcc81-57e1-4941-a70b-7b63e39c8916') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('74c25692-65bf-4e25-ae9c-0e8363c0e738') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('f45871aa-7723-42c3-9781-f4f9b8d7250a') }}</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('a67ca3cc-ed24-43a4-91d6-ef9c8324b30e') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('6d8e8e50-5e72-4e00-b074-c046f4069dd6') }}
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
                            {{ $t('d703d8bc-b08f-4b4d-9c26-f255edd70f56') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('c3c001fa-1c57-4aed-aa19-4bfa48736bac') }}
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
                            {{ $t('f0b50a39-d4fd-4f97-802d-a599b00030fd') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('d2387560-b2ae-4e44-931b-d3fb20c63563') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('dc052084-eea5-407e-8775-237bf550895a') }}</h2>

                <STList>
                    <STListItem v-if="isOpen" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('8514f479-c987-46c1-aa4b-8abc14164538') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('445bf25f-4661-4155-a255-4f15cbf13f34') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon power" />
                                <span>{{ $t('bef7a2f9-129a-4e1c-b8d2-9003ff0a1f8b') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="openWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('333b4c3f-a575-43e8-acad-754453b253e1') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('07956e16-efc0-4ce6-b5ba-57342ef567b9') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary green hide-smartphone">
                                <span class="icon power" />
                                <span>{{ $t('9e85b407-6e12-4003-9847-5b7d277b87ff') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="archiveWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('1a3767f2-5b48-4d33-959f-08b114d1559b') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('944f3bbb-b537-48ba-b27f-227e152c658c') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon archive" />
                                <span>{{ $t('fbeb1597-d56c-4f8b-8220-d2005a6f4310') }}</span>
                            </button>
                            <button type="button" class="button icon archive only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('5c7e1652-c21d-4746-84a3-3d09c7e0c8d9') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('2cb036c9-52fd-4044-b1e2-91d4b22d580e') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon undo" />
                                <span>{{ $t('574829bb-6ffc-489b-bc83-f3439dc62ffa') }}</span>
                            </button>
                            <button type="button" class="button icon undo only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" @click="duplicateWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('cfc3fc8b-6b17-4289-b87f-c85e38002795') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('1e3f3637-e390-44f2-9bb3-8e75ec2aa634') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon copy" />
                                <span>{{ $t('1c8e7100-b4ac-4c22-8e22-a19d3c039f74') }}</span>
                            </button>
                            <button type="button" class="button icon copy only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem class="hoverable" :selectable="true" element-name="a" :href="webshopQrCodeUrl" target="_blank">
                        <h2 class="style-title-list">
                            {{ $t('8ee5ee3f-abb7-4120-a817-a81ff4935a73') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('a45d87bc-1abd-461d-bd9a-01eed92c3073') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon qr-code" />
                                <span>{{ $t('2875962d-b4fb-4542-af69-4f26472459f2') }}</span>
                            </button>
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="deleteWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('ebd0428a-b614-4eaa-a939-69a1e1392054') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('769c03b9-36d0-461d-afe9-10afa2402417') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash" />
                                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
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
