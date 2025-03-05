<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title"/>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span>{{ title }}</span>

                <span v-if="isOpen" class="icon dot green"/>
                <span v-else-if="isArchive" class="icon archive"/>
                <span v-else class="icon dot red"/>
            </h1>

            <BillingWarningBox filter-types="webshops" class="data-table-prefix"/>

            <STList class="illustration-list">
                <STListItem v-if="hasReadPermissions" :selectable="true" class="left-center" @click="openOrders(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/cart.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('31194ed7-1f06-497b-82e8-70028b6bcd0c') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('a29a7c18-889a-4b49-85af-9390e3b855c3') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="hasSeating && hasReadPermissions" :selectable="true" class="left-center" @click="openSeating(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/seating-plan.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('274e3def-240a-465c-b2e2-7fe2edac2dc5') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('4a7a4807-6ae0-478e-b485-88393e17e8e4') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="hasTickets && hasScanPermissions" :selectable="true" class="left-center" @click="openTickets(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/scanner.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('ba6e6227-0141-45b5-87fb-139c4da0575f') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('3df80fa1-7291-4731-8688-87d89a9f56b1') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="hasReadPermissions" :selectable="true" class="left-center" @click="openStatistics(true)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/diagram.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('a1727d44-5479-48d5-8532-bef4bbc60713') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('c924679f-d7e8-4b07-b2e8-684129f87cfd') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" element-name="a" :href="'https://'+webshopUrl" target="_blank">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/earth.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('6e34c0f4-3ccf-4197-b866-e491cec17eb7') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('9f815814-a113-4c67-aeb7-32b1e220364e') }} {{ webshopUrl }}
                    </p>
                    <template #right>
                        <span class="icon external gray"/>
                    </template>
                </STListItem>
            </STList>

            <template v-if="hasFullPermissions">
                <hr><h2>{{ $t('a370eff9-c1c1-450c-8bdb-dcee89bd2f70') }}</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/flag.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('f8ce21aa-06de-4373-874c-ddad1629cad8') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('e95456b9-6bce-42cf-be50-2db317d47967') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editProducts(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-package.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('a089e85e-52e3-4d40-a87b-cfe4547ef255') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('c98cbbe3-3da8-46a7-8683-23cebd129dca') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editProducts(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/tickets.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('36df7abc-a2b3-4f5a-b96b-871097dbe9bf') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('e89cc353-5eb5-4168-b38e-4967e62bf00e') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editCheckoutMethods(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/bike.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('619e8780-d586-4be0-bc30-5a2fe8b144e2') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('0ce210ba-d725-411e-8a69-548cd62f9fe9') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPaymentMethods(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('47ffc673-424e-4be8-aa64-f01ba8581b64') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('4959d860-2b5b-46e3-8f49-655ceb00fed9') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="getFeatureFlag('webshop-discounts')" :selectable="true" class="left-center" @click="editDiscounts(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/discount.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('47931f38-0599-41aa-bc5c-0d91526017a4') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('f5c9600d-4a35-4bb0-b4cb-050d4c705532') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="preview.meta.customFields.length" :selectable="true" class="left-center" @click="editInputFields(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('c9e3d4c3-7a50-43d7-b6ed-6d7abb376a58') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('aa7bacc7-acb6-49c2-9c5f-74b99fb5d7cd') }}
                        </p>

                        <template #right>
                            <span v-tooltip="'Deze functie is verouderd. Als je alle vrije invoervelden wist, kan je gebruik maken van uitgebreidere vragenlijsten.'" class="icon error "/>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editRecordSettings(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('26f3d0e6-eeaf-447e-b537-dcf94bd5591c') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('aa7bacc7-acb6-49c2-9c5f-74b99fb5d7cd') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPermissions(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('5f64bf27-51c6-427b-b92a-8dd8d3c3cfae') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('4731f379-9b6a-408d-b882-78c8faae2f59') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editNotifications(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/notifications.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('e6151f11-801d-4289-9443-cbfbaeb002bd') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('0a3e315d-ad35-463d-864e-cc207fc02f25') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('ba0f4e0a-0e1e-4fd2-8078-2ff1956e3396') }}</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/palette.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('81510386-eaab-419e-a17a-eb94e2d7df02') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('206ad4f0-8ca5-4fec-b5f8-04ca12959738') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editLink(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/compass.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('aa3136b8-6c01-4d96-9ae9-6a23061552b3') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('ca76d9f3-e033-477c-9d78-6e5443cb778c') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editEmails(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/email.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('e4e79acd-2538-406e-927c-e18c5383a493') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('cf623b01-0a67-4255-9eec-bf18a2f9e4b3') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('8424a02d-2147-40d1-9db2-ddece074a650') }}</h2>

                <STList>
                    <STListItem v-if="isOpen" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('253d8bc7-dcdc-42b0-a065-a4a15dac2690') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('758bda1a-cdb9-45bb-8f88-ec2ab8077985') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon power"/>
                                <span>{{ $t('08919911-1157-400d-b89c-265233590019') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="openWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('46ce31fb-9dfd-4c64-b0de-dfbe33e8d426') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('4886d5c2-0bb6-4656-a80c-502802ecd10f') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary green hide-smartphone">
                                <span class="icon power"/>
                                <span>{{ $t('83e8ab51-f6b6-4ca5-8932-046a91adf1a8') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="archiveWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('d66a6b08-c204-489b-999f-7d10b02d70d7') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('d9b66375-e890-4efe-972a-09185f629410') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon archive"/>
                                <span>{{ $t('2f77b75b-02e2-472c-a494-5187d30ff9f7') }}</span>
                            </button>
                            <button type="button" class="button icon archive only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('c774a8fc-e75e-4a91-b680-984a09a1cee4') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('8377cd1c-6672-4ff0-b673-12b6253dfefb') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon undo"/>
                                <span>{{ $t('ba2daa96-55f3-476c-9d08-201b05b9d941') }}</span>
                            </button>
                            <button type="button" class="button icon undo only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" @click="duplicateWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('3fd2cf06-b5ad-40fe-a9dc-878172c951ca') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('ac0c9e44-810b-44bf-a658-d732c8774086') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon copy"/>
                                <span>{{ $t('5011cd6e-5979-4cf7-90b1-75a45ebd78e5') }}</span>
                            </button>
                            <button type="button" class="button icon copy only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="deleteWebshop()">
                        <h2 class="style-title-list">
                            {{ $t('bec97ff6-d10e-4fed-90c8-d2634ad821e1') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('c4a7d404-e887-4cbe-b716-12d6499bc32a') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash"/>
                                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                            </button>
                            <button type="button" class="button icon trash only-smartphone"/>
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
