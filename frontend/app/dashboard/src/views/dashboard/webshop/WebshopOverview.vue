<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop" />

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
                    <template #left><img src="@stamhoofd/assets/images/illustrations/cart.svg"></template>
                    <h2 class="style-title-list">
                        Bestellingen
                    </h2>
                    <p class="style-description">
                        Bekijk en exporteer bestellingen, e-mail en SMS klanten.
                    </p>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>

                <STListItem v-if="hasSeating && hasReadPermissions" :selectable="true" class="left-center" @click="openSeating(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/seating-plan.svg"></template>
                    <h2 class="style-title-list">
                        Zaaloverzicht
                    </h2>
                    <p class="style-description">
                        Bekijk welke plaatsen door welke personen zijn ingenomen.
                    </p>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>

                <STListItem v-if="hasTickets && hasScanPermissions" :selectable="true" class="left-center" @click="openTickets(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/scanner.svg"></template>
                    <h2 class="style-title-list">
                        Scan tickets
                    </h2>
                    <p class="style-description">
                        Gebruik je camera om snel tickets te scannen.
                    </p>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>

                <STListItem v-if="hasReadPermissions" :selectable="true" class="left-center" @click="openStatistics(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/diagram.svg"></template>
                    <h2 class="style-title-list">
                        Statistieken
                    </h2>
                    <p class="style-description">
                        Bekijk jouw omzet en andere statistieken.
                    </p>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" element-name="a" :href="'https://'+webshopUrl" target="_blank">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/earth.svg"></template>
                    <h2 class="style-title-list">
                        Bekijk jouw webshop
                    </h2>
                    <p class="style-description">
                        Jouw webshop is bereikbaar via {{ webshopUrl }}
                    </p>
                    <template #right><span class="icon external gray" /></template>
                </STListItem>
            </STList>

            <template v-if="hasFullPermissions">
                <hr>
                <h2>Instellingen</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/flag.svg"></template>
                        <h2 class="style-title-list">
                            Algemeen
                        </h2>
                        <p class="style-description">
                            Naam, type en beschikbaarheid.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editProducts(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/edit-package.svg"></template>
                        <h2 class="style-title-list">
                            Productaanbod
                        </h2>
                        <p class="style-description">
                            Bewerk welke artikels je verkoopt in jouw webshop.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editProducts(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/tickets.svg"></template>
                        <h2 class="style-title-list">
                            Aanbod tickets en vouchers
                        </h2>
                        <p class="style-description">
                            Bewerk en voeg nieuwe tickets en vouchers toe aan je webshop.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editCheckoutMethods(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/bike.svg"></template>
                        <h2 class="style-title-list">
                            Afhalen, leveren, ter plaatse eten
                        </h2>
                        <p class="style-description">
                            Wijzig tijdstippen, locaties en afhaalmethodes.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPaymentMethods(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/creditcards.svg"></template>
                        <h2 class="style-title-list">
                            Betaalmethodes
                        </h2>
                        <p class="style-description">
                            Kies welke betaalmethodes je wilt activeren, en stel eventueel administratiekosten in.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-if="getFeatureFlag('webshop-discounts')" :selectable="true" class="left-center" @click="editDiscounts(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/discount.svg"></template>
                        <h2 class="style-title-list">
                            Kortingen
                        </h2>
                        <p class="style-description">
                            Voeg kortingen toe aan je webshop.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-if="preview.meta.customFields.length" :selectable="true" class="left-center" @click="editInputFields(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/edit-data.svg"></template>
                        <h2 class="style-title-list">
                            Vrije invoervelden
                        </h2>
                        <p class="style-description">
                            Verzamel extra informatie van bestellers bij het afrekenen.
                        </p>

                        <template #right><span v-tooltip="'Deze functie is verouderd. Als je alle vrije invoervelden wist, kan je gebruik maken van uitgebreidere vragenlijsten.'" class="icon error " /></template>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editRecordSettings(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/edit-data.svg"></template>
                        <h2 class="style-title-list">
                            Vragenlijsten en gegevens
                        </h2>
                        <p class="style-description">
                            Verzamel extra informatie van bestellers bij het afrekenen.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPermissions(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/lock.svg"></template>
                        <h2 class="style-title-list">
                            Toegangsbeheer
                        </h2>
                        <p class="style-description">
                            Bepaal wie bestellingen en instellingen van deze webshop kan bekijken of wijzigen.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editNotifications(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/notifications.svg"></template>
                        <h2 class="style-title-list">
                            Meldingen
                        </h2>
                        <p class="style-description">
                            Blijf zelf op de hoogte van nieuwe bestellingen.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>
                </STList>

                <hr>
                <h2>Personaliseren</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/palette.svg"></template>
                        <h2 class="style-title-list">
                            Tekst, uiterlijk, en externe links
                        </h2>
                        <p class="style-description">
                            Wijzig de teksten en uitzicht van jouw webshop.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editLink(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/compass.svg"></template>
                        <h2 class="style-title-list">
                            Link
                        </h2>
                        <p class="style-description">
                            Wijzig de link van jouw webshop.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editEmails(true)">
                        <template #left><img src="@stamhoofd/assets/images/illustrations/email.svg"></template>
                        <h2 class="style-title-list">
                            E-mails
                        </h2>
                        <p class="style-description">
                            Wijzig de inhoud van automatische e-mails naar bestellers.
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
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
                        <button slot="right" type="button" class="button secundary danger hide-smartphone">
                            <span class="icon power" />
                            <span>Sluiten</span>
                        </button>
                        <template #right><button type="button" class="button icon power only-smartphone" /></template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="openWebshop()">
                        <h2 class="style-title-list">
                            Webshop terug openen
                        </h2>
                        <p class="style-description">
                            Open de webshop opnieuw.
                        </p>
                        <button slot="right" type="button" class="button secundary green hide-smartphone">
                            <span class="icon power" />
                            <span>Openen</span>
                        </button>
                        <template #right><button type="button" class="button icon power only-smartphone" /></template>
                    </STListItem>

                    <STListItem v-if="!isOpen && !isArchive" :selectable="true" @click="archiveWebshop()">
                        <h2 class="style-title-list">
                            Webshop archiveren
                        </h2>
                        <p class="style-description">
                            Verplaats de webshop naar het archief, maar behoud alle gegevens. De webshop is dan niet meer zo prominent zichtbaar in het menu.
                        </p>
                        <button slot="right" type="button" class="button secundary hide-smartphone">
                            <span class="icon archive" />
                            <span>Archiveren</span>
                        </button>
                        <template #right><button type="button" class="button icon archive only-smartphone" /></template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="closeWebshop()">
                        <h2 class="style-title-list">
                            Webshop uit archief halen
                        </h2>
                        <p class="style-description">
                            Verplaats de webshop terug naar het hoofdmenu.
                        </p>
                        <button slot="right" type="button" class="button secundary hide-smartphone">
                            <span class="icon undo" />
                            <span>Terugzetten</span>
                        </button>
                        <template #right><button type="button" class="button icon undo only-smartphone" /></template>
                    </STListItem>

                    <STListItem :selectable="true" @click="duplicateWebshop()">
                        <h2 class="style-title-list">
                            Webshop dupliceren
                        </h2>
                        <p class="style-description">
                            Maak een nieuwe webshop met dezelfde instellingen, maar met een andere naam en link.
                        </p>
                        <button slot="right" type="button" class="button secundary hide-smartphone">
                            <span class="icon copy" />
                            <span>Dupliceren</span>
                        </button>
                        <template #right><button type="button" class="button icon copy only-smartphone" /></template>
                    </STListItem>

                    <STListItem v-if="isArchive" :selectable="true" @click="deleteWebshop()">
                        <h2 class="style-title-list">
                            Webshop definitief verwijderen
                        </h2>
                        <p class="style-description">
                            Verwijder deze webshop en alle daarbij horende informatie en bestellingen. Dit is meestal niet nodig.
                        </p>
                        <button slot="right" type="button" class="button secundary danger hide-smartphone">
                            <span class="icon trash" />
                            <span>Verwijderen</span>
                        </button>
                        <template #right><button type="button" class="button icon trash only-smartphone" /></template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, LoadComponent, PromiseView, STList, STListItem, STNavigationBar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { EmailTemplate, PrivateWebshop, WebshopMetaData, WebshopPreview, WebshopStatus, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import BillingWarningBox from '../settings/packages/BillingWarningBox.vue';
import EditWebshopCheckoutMethodsView from './edit/EditWebshopCheckoutMethodsView.vue';
import EditWebshopDiscountsView from './edit/EditWebshopDiscountsView.vue';
import EditWebshopEmailsView from './edit/EditWebshopEmailsView.vue';
import EditWebshopGeneralView from './edit/EditWebshopGeneralView.vue';
import EditWebshopInputFieldsView from './edit/EditWebshopInputFieldsView.vue';
import EditWebshopLinkView from './edit/EditWebshopLinkView.vue';
import EditWebshopNotificationsView from './edit/EditWebshopNotificationsView.vue';
import EditWebshopPageView from './edit/EditWebshopPageView.vue';
import EditWebshopPaymentMethodsView from './edit/EditWebshopPaymentMethodsView.vue';
import EditWebshopPermissionsView from './edit/EditWebshopPermissionsView.vue';
import EditWebshopProductsView from './edit/EditWebshopProductsView.vue';
import EditWebshopRecordSettings from './edit/EditWebshopRecordSettings.vue';
import WebshopOrdersView from './orders/WebshopOrdersView.vue';
import WebshopSeatingView from './orders/WebshopSeatingView.vue';
import WebshopStatisticsView from './statistics/WebshopStatisticsView.vue';
import TicketScannerSetupView from './tickets/TicketScannerSetupView.vue';
import { WebshopManager } from './WebshopManager';

@Component({
    components: {
        STNavigationBar,
        BackButton,
        STList,
        STListItem,
        BillingWarningBox
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class WebshopOverview extends Mixins(NavigationMixin) {
    @Prop()
        preview!: WebshopPreview;

    loading = false

    webshopManager = new WebshopManager(this.$context, (this.$props! as unknown as any).preview)

    constructor() {
        super()
        console.log('Constructed new WebshopOverview', (this as any).$options.props)

        // Fix
        // proxy to actual vm
        const keys = Object.getOwnPropertyNames(this)
        // 2.2.0 compat (props are no longer exposed as self properties)
        if (this.$options.props) {
            for (const key in this.$options.props) {
                if (!Object.prototype.hasOwnProperty.call(this, key)) {
                    console.log('does not has own property', key)
                    keys.push(key)
                } else {
                    console.log('has own property', key)
                }
            }
        }
        console.log('keys', keys)
        // keys.forEach(key => {
        //     Object.defineProperty(this, key, {
        //         get: () => this[key],
        //         set: value => { this[key] = value },
        //         configurable: true
        //     })
        // })
    }

    reload() {
        this.loading = true;

        this.webshopManager.loadWebshopIfNeeded().catch((e) => {
            console.error(e)
            Toast.fromError(e).show()
        }).finally(() => {
            this.loading = false
        })
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }

    get webshop() {
        return this.webshopManager.webshop
    }

    get isOpen() {
        return !this.webshopManager.preview.isClosed()
    }

    get isArchive() {
        return this.webshopManager.preview.meta.status == WebshopStatus.Archived
    }

    get organization() {
        return this.$organization
    }

    get title() {
        return this.preview.meta.name
    }

    get webshopUrl() {
        return this.preview.getUrl(this.$organization)
    }

    get hasFullPermissions() {
        if (!this.$organizationManager.user.permissions) {
            return false
        }
        return this.preview.privateMeta.permissions.hasFullAccess(this.$organizationManager.user.permissions, this.$organization.privateMeta?.roles ?? [])
    }

    get hasWritePermissions() {
        if (!this.$organizationManager.user.permissions) {
            return false
        }
        return this.preview.privateMeta.permissions.hasWriteAccess(this.$organizationManager.user.permissions, this.$organization.privateMeta?.roles ?? [])
    }

    get hasReadPermissions() {
        if (!this.$organizationManager.user.permissions) {
            return false
        }
        return this.preview.privateMeta.permissions.hasReadAccess(this.$organizationManager.user.permissions, this.$organization.privateMeta?.roles ?? [])
    }

    get hasScanPermissions() {
        if (!this.$organizationManager.user.permissions) {
            return false
        }
        return this.hasWritePermissions || this.preview.privateMeta.scanPermissions.hasWriteAccess(this.$organizationManager.user.permissions, this.$organization.privateMeta?.roles ?? [])
    }

    get isTicketsOnly() {
        return this.webshopManager.preview.meta.ticketType === WebshopTicketType.Tickets
    }

    get hasTickets() {
        return this.webshopManager.preview.meta.ticketType !== WebshopTicketType.None
    }

    get hasSeating() {
        return this.webshopManager.preview.meta.seatingPlans.length > 0 && (!this.webshop || !!this.webshop?.products?.find(p => p.seatingPlanId !== null))
    }
   
    openOrders(animated = true) {
        this.show({
            animated,
            adjustHistory: animated,
            components: [
                new ComponentWithProperties(WebshopOrdersView, {
                    webshopManager: this.webshopManager
                })
            ]
        })
    }

    openSeating(animated = true) {
        this.show({
            animated,
            adjustHistory: animated,
            components: [
                new ComponentWithProperties(WebshopSeatingView, {
                    webshopManager: this.webshopManager
                })
            ]
        })
    }

    openStatistics(animated = true) {
        this.show({
            animated,
            adjustHistory: animated,
            components: [
                new ComponentWithProperties(WebshopStatisticsView, {
                    webshopManager: this.webshopManager
                })
            ]
        })
    }

    openTickets(animated = true) {
        this.show({
            animated,
            adjustHistory: animated,
            components: [
                new ComponentWithProperties(TicketScannerSetupView, {
                    webshopManager: this.webshopManager
                })
            ]
        })
    }

    editGeneral(animated = true) {
        this.displayEditComponent(EditWebshopGeneralView, animated)
    }

    editPage(animated = true) {
        this.displayEditComponent(EditWebshopPageView, animated)
    }

    editLink(animated = true) {
        this.displayEditComponent(EditWebshopLinkView, animated)
    }

    editProducts(animated = true) {
        this.displayEditComponent(EditWebshopProductsView, animated)
    }

    editDiscounts(animated = true) {
        this.displayEditComponent(EditWebshopDiscountsView, animated)
    }

    editPaymentMethods(animated = true) {
        this.displayEditComponent(EditWebshopPaymentMethodsView, animated)
    }

    editInputFields(animated = true) {
        this.displayEditComponent(EditWebshopInputFieldsView, animated)
    }

    editRecordSettings(animated = true) {
        this.displayEditComponent(EditWebshopRecordSettings, animated)
    }

    editCheckoutMethods(animated = true) {
        this.displayEditComponent(EditWebshopCheckoutMethodsView, animated)
    }

    editPermissions(animated = true) {
        this.displayEditComponent(EditWebshopPermissionsView, animated)
    }

    editEmails(animated = true) {
        this.displayEditComponent(EditWebshopEmailsView, animated)
    }

    editNotifications(animated = true) {
        this.displayEditComponent(EditWebshopNotificationsView, animated)
    }

    displayEditComponent(component, animated = true) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    try {
                        // Make sure we have an up to date webshop
                        await this.webshopManager.loadWebshopIfNeeded(false, true)
                        return new ComponentWithProperties(component, {
                            webshopManager: this.webshopManager
                        })
                    } catch (e) {
                        Toast.fromError(e).show()
                        throw e
                    }
                }
            })
        })

        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                displayedComponent
            ]
        });
    }

    mounted() {
        const parts = UrlHelper.shared.getParts()
        //const params = UrlHelper.shared.getSearchParams()

        // We can clear now
        UrlHelper.shared.clear()

        // Set url
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name))
        document.title = "Stamhoofd - " + this.preview.meta.name
        this.refreshOnReturn()

        if (parts.length == 3 && parts[0] == 'webshops' && parts[2] == 'orders') {
            this.openOrders(false)
        }

        if (parts.length == 3 && parts[0] == 'webshops' && parts[2] == 'seating') {
            this.openSeating(false)
        }

        if (parts.length >= 3 && parts[0] == 'webshops' && parts[2] == 'tickets') {
            this.openTickets(false)
        }

        if (parts.length >= 3 && parts[0] == 'webshops' && parts[2] == 'statistics') {
            this.openStatistics(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'general') {
            this.editGeneral(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && (parts[3] == 'products' || parts[3] == 'tickets')) {
            this.editProducts(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'checkout-methods' && !this.isTicketsOnly) {
            this.editCheckoutMethods(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'payments') {
            this.editPaymentMethods(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'discounts') {
            this.editDiscounts(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'records') {
            this.editRecordSettings(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'permissions') {
            this.editPermissions(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'notifications') {
            this.editNotifications(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'page') {
            this.editPage(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'link') {
            this.editLink(false)
        }

        if (parts.length >= 4 && parts[0] == 'webshops' && parts[2] == 'settings' && parts[3] == 'emails') {
            this.editEmails(false)
        }
    }

    created() {
        this.reload();
    }

    get canCreateWebshops() {
        const result = this.$user!.permissions!.canCreateWebshops(this.organization.privateMeta?.roles ?? [])
        return result
    }

    duplicateWebshop() {
        if (!this.canCreateWebshops) {
            return;
        }

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    try {
                        // Make sure we have an up to date webshop
                        const webshop = await this.webshopManager.loadWebshopIfNeeded(false)
                        const duplicate = PrivateWebshop.create({
                            ...webshop.clone(),
                            id: undefined, 
                        }).patch({
                            meta: WebshopMetaData.patch({
                                status: WebshopStatus.Open,
                            })
                        })

                        // Set usedStock to 0
                        duplicate.clearStock();

                        const response = await this.$context.authenticatedServer.request({
                            method: "GET",
                            path: "/email-templates",
                            query: { webshopId: webshop.id },
                            shouldRetry: false,
                            owner: this,
                            decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>)
                        })
                        const templates = response.data;

                        return new ComponentWithProperties(EditWebshopGeneralView, {
                            initialWebshop: duplicate,
                            savedHandler: async (duplicateWebshop: PrivateWebshop) => {
                                // Copy over the templates
                                try {
                                    const patchedArray: PatchableArrayAutoEncoder<EmailTemplate> = new PatchableArray()
                                    for (const t of templates) {
                                        if (t.webshopId !== webshop.id) {
                                            // Skip default templates
                                            continue;
                                        }

                                        // Create a new duplicate
                                        const template = EmailTemplate.create({
                                            ...t,
                                            webshopId: duplicateWebshop.id,
                                            id: undefined
                                        })
                                        patchedArray.addPut(template)
                                    }

                                    if (patchedArray.getPuts().length > 0) {
                                        await this.$context.authenticatedServer.request({
                                            method: "PATCH",
                                            path: "/email-templates",
                                            body: patchedArray,
                                            shouldRetry: false,
                                            owner: this
                                        })
                                    }
                                } catch (e) {
                                    console.error(e);
                                    new Toast('Er ging iets mis bij het overnemen van de e-mails in de nieuwe webshop', 'warning').show()
                                }
                            }
                        })
                    } catch (e) {
                        Toast.fromError(e).show()
                        throw e
                    }
                }
            })
        })

        this.present({
            animated: true,
            adjustHistory: true,
            modalDisplayStyle: "popup",
            components: [
                displayedComponent
            ]
        });
    }

    async closeWebshop() {
        if (this.isArchive) {
            if (!await CenteredMessage.confirm("Ben je zeker dat je de webshop wilt terugzetten?", "Ja, terugzetten", "Je kan daarna de webshop eventueel terug openen.")) {
                return;
            }
        } else {
            if (!await CenteredMessage.confirm("Ben je zeker dat je de webshop '"+this.webshopManager.preview.meta.name+"' wilt sluiten?", "Ja, sluiten", "Er kunnen daarna geen nieuwe bestellingen worden gemaakt. Je kan de webshop later terug openen.")) {
                return;
            }
        }

        try {
            await this.webshopManager.patchWebshop(
                PrivateWebshop.patch({
                    meta: WebshopMetaData.patch({
                        status: WebshopStatus.Closed
                    })
                })
            )
            new Toast("De webshop is gesloten", "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async openWebshop() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je de webshop terug wilt openen?", "Ja, openen")) {
            return;
        }

        try {
            await this.webshopManager.patchWebshop(
                PrivateWebshop.patch({
                    meta: WebshopMetaData.patch({
                        status: WebshopStatus.Open,
                        availableUntil: null
                    })
                })
            )
            new Toast("De webshop is terug open", "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async archiveWebshop() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je de webshop wilt archiveren?", "Ja, archiveren", "De gegevens van de webshop blijven daarna nog bereikbaar, maar de webshop wordt niet meer zo prominent in het menu weergegeven.")) {
            return;
        }

        try {
            await this.webshopManager.patchWebshop(
                PrivateWebshop.patch({
                    meta: WebshopMetaData.patch({
                        status: WebshopStatus.Archived
                    })
                })
            )
            new Toast("De webshop is gearchiveerd", "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async deleteWebshop() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je de webshop '"+this.webshopManager.preview.meta.name+"' wilt verwijderen?", "Ja, verwijderen", "Alle bijhorende bestellingen worden ook definitief verwijderd. Je kan dit niet ongedaan maken.")) {
            return;
        }

        try {
            await this.$context.authenticatedServer.request({
                method: "DELETE",
                path: "/webshop/"+this.webshopManager.preview.id,
                shouldRetry: false
            })
            new Toast("Webshop verwijderd", "success green").show()

            this.$organization.webshops = this.$organization.webshops.filter(w => w.id != this.webshopManager.preview.id)

            // Save updated organization to cache
            this.$organizationManager.save().catch(console.error)

            if (this.canPop) {
                this.pop({ force: true })
            } else {
                await this.splitViewController!.showDetail({
                    components: [
                        new ComponentWithProperties(NavigationController, { 
                            root: await LoadComponent(() => import(/* webpackChunkName: "AccountSettingsView" */ '../account/AccountSettingsView.vue'), {}, { instant: false })
                        })
                    ],
                    animated: false
                });
            }
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    beforeDestroy() {
        // Clear all pending requests
        Request.cancelAll(this)
        this.webshopManager.close()
        document.removeEventListener("visibilitychange", this.doRefresh)
    }

    refreshOnReturn() {
        document.addEventListener("visibilitychange", this.doRefresh);
    }

    doRefresh() {
        if (document.visibilityState === 'visible') {
            this.webshopManager.backgroundReloadWebshop()
        }
    }
}
</script>