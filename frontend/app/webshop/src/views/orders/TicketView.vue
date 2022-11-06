<template>
    <LoadingView v-if="loading" />
    <div v-else class="st-view boxed ticket-view">
        <STNavigationBar v-if="!$isMobile" :large="!true" :sticky="false">
            <OrganizationLogo slot="left" :organization="organization" />
        </STNavigationBar>

        <div v-for="ticket in tickets" :key="ticket.id" class="box">
            <DetailedTicketView :ticket="ticket" :webshop="webshop" :logo="$isMobile" />
        </div>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton, LoadingView, OrganizationLogo, Radio, Spinner, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { TicketPublic } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { WebshopManager } from '../../classes/WebshopManager';
import DetailedTicketView from './DetailedTicketView.vue';


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        LoadingView,
        BackButton,
        OrganizationLogo,
        Spinner,
        DetailedTicketView
    }
})
export default class TicketView extends Mixins(NavigationMixin){
    loading = true
    
    @Prop({ required: true })
    secret: string 

    tickets: TicketPublic[] = []

    get organization() {
        return WebshopManager.organization
    }

    get webshop() {
        return WebshopManager.webshop
    }

    async downloadTickets() {
        this.loading = true

        try {
            const response = await WebshopManager.server.request({
                method: "GET",
                path: "/webshop/" +WebshopManager.webshop.id + "/tickets",
                query: {
                    // Required because we don't need to repeat item information (network + database impact)
                    secret: this.secret
                },
                decoder: new ArrayDecoder(TicketPublic as Decoder<TicketPublic>)
            })
            this.tickets = response.data
        } catch (e) {
            Toast.fromError(e).show()
        }        

        this.loading = false
    }

    created() {
        this.downloadTickets().catch(console.error)
    }

    mounted() {
        UrlHelper.setUrl("/tickets/"+this.secret)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.ticket-view {
    --box-width: 400px;
}
</style>