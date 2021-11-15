<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>

            <BillingWarningBox filter-types="webshops" class="data-table-prefix" />

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openOrders(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/cart.svg">
                    <h2 class="style-title-list">
                        Bestellingen
                    </h2>
                    <p class="style-description">
                        Bekijk en exporteer bestellingen, e-mail en SMS klanten.
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem v-if="hasTickets && hasWritePermissions" :selectable="true" class="left-center" @click="openTickets(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/scanner.svg">
                    <h2 class="style-title-list">
                        Scan tickets
                    </h2>
                    <p class="style-description">
                        Gebruik je camera om snel tickets te scannen en te markeren als 'gescand'
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openStatistics(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/diagram.svg">
                    <h2 class="style-title-list">
                        Statistieken
                    </h2>
                    <p class="style-description">
                        Bekijk jouw omzet en andere statistieken
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem :selectable="true" class="left-center" element-name="a" :href="'https://'+webshopUrl" target="_blank">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/earth.svg">
                    <h2 class="style-title-list">
                        Bekijk jouw webshop
                    </h2>
                    <p class="style-description">
                        Jouw webshop is bereikbaar via {{ webshopUrl }}
                    </p>
                    <span slot="right" class="icon external gray" />
                </STListItem>
            </STList>

            <template v-if="hasFullPermissions">
                <hr>
                <h2>Instellingen</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/flag.svg">
                        <h2 class="style-title-list">
                            Algemeen
                        </h2>
                        <p class="style-description">
                            Naam en beschikbaarheid
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editProducts(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/stock.svg">
                        <h2 class="style-title-list">
                            Productaanbod
                        </h2>
                        <p class="style-description">
                            Bewerk welke artikels je verkoopt in jouw webshop.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem v-else :selectable="true" class="left-center" @click="editProducts(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/tickets.svg">
                        <h2 class="style-title-list">
                            Aanbod tickets en vouchers
                        </h2>
                        <p class="style-description">
                            Bewerk en voeg nieuwe tickets en vouchers toe aan je webshop.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editCheckoutMethods(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/bike.svg">
                        <h2 class="style-title-list">
                            Afhalen, leveren, ter plaatse eten
                        </h2>
                        <p class="style-description">
                            Wijzig tijdstippen, locaties en afhaalmethodes
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPaymentMethods(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/creditcards.svg">
                        <h2 class="style-title-list">
                            Betaalmethodes
                        </h2>
                        <p class="style-description">
                            Welke betaalmethodes je wilt activeren op jouw webshop.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/palette.svg">
                        <h2 class="style-title-list">
                            Tekst, link en omslagfoto
                        </h2>
                        <p class="style-description">
                            Wijzig de teksten en uitzicht van jouw webshop.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem v-if="!isTicketsOnly" :selectable="true" class="left-center" @click="editInputFields(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                        <h2 class="style-title-list">
                            Vrije invoervelden
                        </h2>
                        <p class="style-description">
                            Verzamel extra informatie van bestellers bij het afrekenen.
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPermissions(true)">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/lock.svg">
                        <h2 class="style-title-list">
                            Toegangsbeheer
                        </h2>
                        <p class="style-description">
                            Bepaal wie bestellingen en instellingen van deze webshop kan bekijken of wijzigen
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>

                <hr>
                <h2>Gevaarlijke acties</h2>
                <p>Deze acties kan je niet meer ongedaan maken. Let heel goed op wat je doet.</p>

                <STList>
                    <STListItem :selectable="true" @click="deleteWebshop()">
                        <h2 class="style-title-list">
                            Webshop verwijderen
                        </h2>
                        <p class="style-description">
                            Verwijder deze webshop en alle daarbij horende informatie en bestellingen
                        </p>
                        <button slot="right" class="button secundary danger hide-smartphone">
                            Verwijder webshop
                        </button>
                        <button slot="right" class="button icon trash only-smartphone" />
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, LoadComponent, PromiseView, STList, STListItem, STNavigationBar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { getPermissionLevelNumber, PermissionLevel, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import BillingWarningBox from '../settings/packages/BillingWarningBox.vue';
import EditWebshopCheckoutMethodsView from './edit/EditWebshopCheckoutMethodsView.vue';
import EditWebshopGeneralView from './edit/EditWebshopGeneralView.vue';
import EditWebshopInputFieldsView from './edit/EditWebshopInputFieldsView.vue';
import EditWebshopPageView from './edit/EditWebshopPageView.vue';
import EditWebshopPaymentMethodsView from './edit/EditWebshopPaymentMethodsView.vue';
import EditWebshopPermissionsView from './edit/EditWebshopPermissionsView.vue';
import EditWebshopProductsView from './edit/EditWebshopProductsView.vue';
import EditWebshopView from './edit/EditWebshopView.vue';
import WebshopOrdersView from './orders/WebshopOrdersView.vue';
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

    webshopManager = new WebshopManager(this.preview)

    get organization() {
        return OrganizationManager.organization
    }

    get title() {
        return this.preview.meta.name
    }

    get webshopUrl() {
        return this.preview.getUrl(OrganizationManager.organization)
    }

    get hasFullPermissions() {
        if (!OrganizationManager.user.permissions) {
            return false
        }
        return this.preview.privateMeta.permissions.getPermissionLevel(OrganizationManager.user.permissions) === PermissionLevel.Full
    }

    get hasWritePermissions() {
        if (!OrganizationManager.user.permissions) {
            return false
        }
        return getPermissionLevelNumber(this.preview.privateMeta.permissions.getPermissionLevel(OrganizationManager.user.permissions)) >= getPermissionLevelNumber(PermissionLevel.Write)
    }

    get isTicketsOnly() {
        return this.webshopManager.preview.meta.ticketType === WebshopTicketType.Tickets
    }

    get hasTickets() {
        return this.webshopManager.preview.meta.ticketType !== WebshopTicketType.None
    }
   
    openOrders(animated = true) {
        this.show(new ComponentWithProperties(WebshopOrdersView, {
            webshopManager: this.webshopManager
        }).setAnimated(animated))
    }

    openStatistics(animated = true) {
        this.show(new ComponentWithProperties(WebshopStatisticsView, {
            webshopManager: this.webshopManager
        }).setAnimated(animated))
    }

    openTickets(animated = true) {
        this.show(new ComponentWithProperties(TicketScannerSetupView, {
            webshopManager: this.webshopManager
        }).setAnimated(animated))
    }

    openSettings(animated = true) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    try {
                        // Make sure we have an up to date webshop
                        await this.webshopManager.loadWebshopIfNeeded(false)
                        return new ComponentWithProperties(EditWebshopView, {
                            webshopManager: this.webshopManager
                        })
                    } catch (e) {
                        Toast.fromError(e).show()
                        throw e
                    }
                }
            })
        }).setAnimated(animated);
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    editGeneral(animated = true) {
        this.displayEditComponent(EditWebshopGeneralView, animated)
    }

    editPage(animated = true) {
        this.displayEditComponent(EditWebshopPageView, animated)
    }

    editProducts(animated = true) {
        this.displayEditComponent(EditWebshopProductsView, animated)
    }

    editPaymentMethods(animated = true) {
        this.displayEditComponent(EditWebshopPaymentMethodsView, animated)
    }

    editInputFields(animated = true) {
        this.displayEditComponent(EditWebshopInputFieldsView, animated)
    }

    editCheckoutMethods(animated = true) {
        this.displayEditComponent(EditWebshopCheckoutMethodsView, animated)
    }

    editPermissions(animated = true) {
        this.displayEditComponent(EditWebshopPermissionsView, animated)
    }

    displayEditComponent(component, animated = true) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    try {
                        // Make sure we have an up to date webshop
                        await this.webshopManager.loadWebshopIfNeeded(false)
                        return new ComponentWithProperties(component, {
                            webshopManager: this.webshopManager
                        })
                    } catch (e) {
                        Toast.fromError(e).show()
                        throw e
                    }
                }
            })
        }).setAnimated(animated);
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    mounted() {
        const parts = UrlHelper.shared.getParts()
        //const params = UrlHelper.shared.getSearchParams()

        // We can clear now
        UrlHelper.shared.clear()

        // Set url
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name))
        document.title = "Stamhoofd - " + this.preview.meta.name

        if (parts.length == 3 && parts[0] == 'webshops' && parts[2] == 'orders') {
            this.openOrders(false)
        }

        if (parts.length >= 3 && parts[0] == 'webshops' && parts[2] == 'tickets') {
            this.openTickets(false)
        }

        if (parts.length >= 3 && parts[0] == 'webshops' && parts[2] == 'statistics') {
            this.openStatistics(false)
        }
    }

    async deleteWebshop() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je de webshop '"+this.webshopManager.preview.meta.name+"' wilt verwijderen?", "Ja, verwijderen", "Alle bijhorende bestellingen worden ook definitief verwijderd. Je kan dit niet ongedaan maken.")) {
            return;
        }

        try {
            await SessionManager.currentSession!.authenticatedServer.request({
                method: "DELETE",
                path: "/webshop/"+this.webshopManager.preview.id,
                shouldRetry: false
            })
            new Toast("Webshop verwijderd", "success green").show()

            OrganizationManager.organization.webshops = OrganizationManager.organization.webshops.filter(w => w.id != this.webshopManager.preview.id)

             // Save updated organization to cache
            OrganizationManager.save().catch(console.error)

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
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#webshop-overview {
    .illustration-list img {
        @extend .style-illustration-img;
    }
}

</style>