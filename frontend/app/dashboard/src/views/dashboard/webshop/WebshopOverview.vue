<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openOrders(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/box.svg">
                    <h2 class="style-title-list">
                        Bestellingen
                    </h2>
                    <p class="style-description">
                        Bekijk en exporteer bestellingen, e-mail en SMS klanten.
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem v-if="hasTickets && hasWritePermissions" :selectable="true" class="left-center" @click="openTickets(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/tickets.svg">
                    <h2 class="style-title-list">
                        Scan tickets
                    </h2>
                    <p class="style-description">
                        Gebruik je camera om snel tickets te scannen en te markeren als 'gescand'
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem :selectable="true" class="left-center" element-name="a" :href="'https://'+webshopUrl" target="_blank">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/earth.svg">
                    <h2 class="style-title-list">
                        Ga naar jouw webshop
                    </h2>
                    <p class="style-description">
                        Jouw webshop is bereikbaar via {{ webshopUrl }}
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

                <STListItem v-if="hasFullPermissions" :selectable="true" class="left-center" @click="openSettings(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/shop-settings.svg">
                    <h2 class="style-title-list">
                        Instellingen
                    </h2>
                    <p class="style-description">
                        Bewerk de producten in jouw webshop of andere instellingen
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, PromiseView, STList, STListItem, STNavigationBar, Toast, TooltipDirective} from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { getPermissionLevelNumber, PermissionLevel, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
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

    mounted() {
        const parts = UrlHelper.shared.getParts()
        //const params = UrlHelper.shared.getSearchParams()

        // We can clear now
        UrlHelper.shared.clear()

        // Set url
        HistoryManager.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name))
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

    beforeDestroy() {
        // Clear all pending requests
        Request.cancelAll(this)
        this.webshopManager.close()
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#webshop-overview {
    .illustration-list img {
        @extend .style-illustration-img;
    }
}

</style>