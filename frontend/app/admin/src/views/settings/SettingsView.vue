<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen" :pop="canPop" :dismiss="canDismiss" />
        <main>
            <h1>
                Instellingen
            </h1>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openEmailTemplates(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/email.svg"></template>
                    <h2 class="style-title-list">
                        Automatische e-mails
                    </h2>
                    <p class="style-description">
                        Wijzig de inhoud van e-mails.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openStripePayoutExport(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/calculator.svg"></template>
                    <h2 class="style-title-list">
                        Stripe uitbetalingen
                    </h2>
                    <p class="style-description">
                        Exporteer een lijst van alle uitbetalingen van Stripe en de daarbij horende facturen.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, STList, STListItem, STNavigationBar } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import EditEmailTemplatesView from '../email-templates/EditEmailTemplatesView.vue';
import StripePayoutExporterView from './StripePayoutExporterView.vue';

@Component({
    components: {
        STNavigationBar,
        BackButton,
        STList,
        STListItem
    }
})
export default class SettingsView extends Mixins(NavigationMixin) {
   
    openEmailTemplates(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EditEmailTemplatesView, {})
                })
            ]
        })
    }

    openStripePayoutExport(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(StripePayoutExporterView, {})
                })
            ]
        })
    }

    mounted() {
        const parts = UrlHelper.shared.getParts()
        const params = UrlHelper.shared.getSearchParams()

        console.log(parts, params)

        document.title = "Stamhoofd - Instellingen"

        // We can clear now
        UrlHelper.shared.clear()

        // First set current url already, to fix back
        UrlHelper.setUrl("/settings")

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'email-templates') {
            // Open mollie settings
            this.openEmailTemplates(false)
        }
    }

    beforeUnmount() {
        // Clear all pending requests
        Request.cancelAll(this)
    }
}
</script>