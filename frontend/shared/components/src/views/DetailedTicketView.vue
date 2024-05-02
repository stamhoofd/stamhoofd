<template>
    <div class="st-view detailed-ticket-view">
        <STNavigationBar :title="name" :disableDismiss="!allowDismiss" :sticky="false" :large="logo">
            <template #left>
                <OrganizationLogo v-if="logo" :organization="organization" />
            </template>
            <template v-if="canShare" #right><button class="button icon share navigation" type="button" @click="share" /></template>
        </STNavigationBar>
        <main>
            <figure class="qr-box">
                <div>
                    <img v-if="QRCodeUrl" :src="QRCodeUrl" :class="{ scanned: !!ticket.scannedAt}" class="peak-brightness" width="370" height="370">
                    <div class="placeholder" />
                </div>
            </figure>

            <aside v-if="sponsors.length" class="stamhoofd-rosnops-box">
                <component :is="sponsor.url ? 'a' : 'div'" v-for="(sponsor, index) of sponsors" :key="sponsor.id" class="rosnops" :class="{visible: visibleSponsor === index, isLogo: !sponsor.banner}" :href="sponsor.url" target="_blank">
                    <ImageComponent v-if="sponsor.banner || sponsor.logo" :image="sponsor.banner || sponsor.logo" :auto-height="true" />
                </component>
            </aside>

            <p class="event-name">
                {{ webshop.meta.name }}
            </p>
            <h1>
                {{ name }}
                <span v-if="ticket.getIndexText()" class="ticket-index">{{ ticket.getIndexText() }}</span>
            </h1>
            <p v-if="isSingle && order" class="description" v-text="'Bestelling #'+order.number" />
            <p v-if="isSingle && order" class="description" v-text="order.data.customer.name" />
            <p v-if="cartItem.descriptionWithoutDate" class="description" v-text="cartItem.descriptionWithoutDate" />
            <p v-if="changedSeatString" class="warning-box">
                {{ changedSeatString }}
            </p>

            <STList>
                <STListItem v-if="cartItem.product.location">
                    <h3 class="style-definition-label">
                        Locatie
                    </h3>
                    <p class="style-definition-text">
                        {{ cartItem.product.location.name }}
                    </p>
                    <p v-if="cartItem.product.location.address" class="style-description-small">
                        {{ cartItem.product.location.address }}
                    </p>
                </STListItem>
                <STListItem v-if="indexDescription.length">
                    <div class="split-info">
                        <div v-for="(row, index) in indexDescription" :key="index">
                            <h3 class="style-definition-label">
                                {{ row.title }}
                            </h3>
                            <p class="style-definition-text">
                                {{ row.value }}
                            </p>
                        </div>
                    </div>
                    <button class="button text" type="button" @click="showSeats">
                        <span>Toon op zaalplan</span>
                        <span class="icon arrow-right-small" />
                    </button>
                </STListItem>

                <STListItem v-if="cartItem.product.dateRange">
                    <h3 class="style-definition-label">
                        Wanneer?
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateRange(cartItem.product.dateRange) }}
                    </p>
                </STListItem>
                
                <STListItem v-if="price">
                    <h3 class="style-definition-label">
                        Prijs
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(price) }}
                    </p>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right><button class="button primary" type="button" @click="download">
                <span class="icon download" />
                <span>Opslaan</span>
            </button></template>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ImageComponent, OrganizationLogo, ShowSeatsView, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Order, Organization, ProductDateRange, TicketPublic, Webshop, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from 'vue-property-decorator';


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STErrorsDefault,
        OrganizationLogo,
        STList,
        STListItem,
        ImageComponent
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class DetailedTicketView extends Mixins(NavigationMixin){
    @Prop({ default: false })
        logo: boolean

    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        organization: Organization

    @Prop({ required: true })
        ticket: TicketPublic

    @Prop({ required: false, default: null })
        order: Order | null

    @Prop({ default: true })
        allowDismiss: boolean

    QRCodeUrl: string | null = null
    visibleSponsor = 0;

    get cartItem() {
        // TODO: multiple item support needed!
        return this.ticket.items[0]
    }

    get indexDescription() {
        return this.ticket.getIndexDescription(this.webshop)
    }

    get changedSeatString() {
        return this.ticket.getChangedSeatString(this.webshop, true)
    }

    get sponsors() {
        return (this.webshop.meta.sponsors?.sponsors ?? []).filter(s => s.onTickets && (s.banner||s.logo))
    }

    get name() {
        return this.ticket.getTitle()
    }

    get canShare() {
        return !!navigator.share
    }

    get price() {
        return this.ticket.getPrice(this.order)
    }

    get isSingle() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket
    }

    share() {
        navigator.share({
            title: this.webshop.meta.name+" - "+this.name,
            text: "Bekijk en sla jouw ticket op via deze link.",
            url: this.qrMessage,
        }).catch(e => console.error(e))
    }

    showSeats() {
        this.show({
            components: [
                new ComponentWithProperties(ShowSeatsView, {
                    webshop: this.webshop,
                    ticket: this.ticket,
                    order: this.order,
                    allowDismiss: this.allowDismiss
                })
            ]
        })
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    formatDateRange(dateRange: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(dateRange.toString())
    }

    get qrMessage() {
        return "https://"+this.webshop.getUrl(this.organization) + "/tickets/"+this.ticket.secret
    }

    timer: NodeJS.Timeout;

    mounted() {
        this.generateQRCode().catch(console.error)
        this.visibleSponsor = Math.floor(Math.random() * Math.max(0, this.sponsors.length - 1))

        this.timer = setInterval(() => {
            console.log('tick')
            if (this.visibleSponsor + 1 >= this.sponsors.length) {
                this.visibleSponsor = 0;
            } else {
                this.visibleSponsor = this.visibleSponsor+1
            }
        }, 3000)
    }

    beforeUnmount() {
        clearInterval(this.timer);
    }

    async download() {
        const TicketBuilder = (await import(
            /* webpackChunkName: "TicketBuilder" */
            /* webpackPrefetch: true */
            '@stamhoofd/ticket-builder'
        )).TicketBuilder

        const builder = new TicketBuilder([this.ticket], this.webshop, this.organization, this.order ?? undefined)
        await builder.download()
    }

    async generateQRCode() {
        const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default

        // Increase scanning speed on mobile screens by adding more correction levels
        this.QRCodeUrl = await QRCode.toDataURL(this.qrMessage, { 
            margin: 0, 
            width: 370, 
            height: 370,
            dark: "#000000",
            color: "#ffffff",
        })
    }

    shouldNavigateAway() {
        return this.allowDismiss
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.detailed-ticket-view {
    main {
        --st-horizontal-padding: 30px;

        .sheet & {
            // Force extra padding on mobile devices
            --st-horizontal-padding: 40px;
        }

        > .event-name {
            @extend .style-definition-label;
            padding-top: var(--st-horizontal-padding, 30px);
        }

        .ticket-index {
            @extend .style-definition-label;
            display: inline-block;
        }

        > h1 {
            @extend .style-title-1;
        }

        > .description {
            @extend .style-description-small;
            padding-top: 10px;
            text-overflow: ellipsis;
            overflow: hidden;
            display: -webkit-box;
            white-space: pre-wrap;
            // line-clamp: 2; /* number of lines to show */
            // -webkit-line-clamp: 2; /* number of lines to show */
            // -webkit-box-orient: vertical;

            + .description {
                padding-top: 0;
            }
        }

        > .price {
            font-size: 14px;
            line-height: 1.4;
            font-weight: 600;
            padding-top: 10px;
            color: $color-primary;
            display: flex;
            flex-direction: row;

            .style-tag {
                margin-left: auto;
            }
        }
    }

    .qr-box {
        max-width: calc(100vh - 200px);
        max-width: calc(100dvh - 200px);
        margin: 0 auto;

        > div {
            position: relative;

            &:before {
                position: absolute;
                content: "";
                top: -30px;
                left: -30px;
                right: -30px;
                bottom: -30px;
                border-radius: $border-radius;
                background: white; // no variable here, because should be white (qr code)
                display: none;
            }
        }

        body.dark & {
            padding-top: 30px;
            padding-bottom: 10px;

            > div:before {
                display: block;
            }
        }

        body:not(.light) & {
            @media (prefers-color-scheme: dark) {
                padding-top: 30px;
                padding-bottom: 10px;

                > div:before {
                    display: block;
                }
            }
        }

        img, .placeholder {
            width: auto;
            height: auto;
            max-width: 100%;
            
        }

        img {
            position: absolute;
        }

        .placeholder {
            width: 100%;
            padding-bottom: 100%;
            padding-bottom: min(370px, 100%);
            max-width: 370px;
        }

        > span {
            display: block;
            color: $color-gray-text;
            font-size: 10px;
            font-weight: bold;
        }
    }

    .stamhoofd-rosnops-box {
        margin-top: 10px;
        margin-bottom: -10px;
        width: 100%;

        body.dark & {
            // We need more white space around the logo in dark mode
            margin-top: 30px;
        }

        body:not(.light) & {
            @media (prefers-color-scheme: dark) {
                // We need more white space around the logo in dark mode
                margin-top: 30px;
            }
        }

        display: grid;
        grid-template-columns: auto;
        grid-template-rows: 1fr;
    }

    .rosnops {
        grid-area: 1 / 1 / 1 / 1;
        align-self: stretch;
        opacity: 0;
        transition: opacity 0.2s;
        border-radius: $border-radius;
        pointer-events: none;

        &.visible {
            opacity: 1;
            pointer-events: auto;
        }

        > .image-component {
            max-height: 150px;
        }

        &.isLogo {
            box-shadow: 0px 1px 1px 0px rgba(0, 0, 0, 0.1);
            border: $border-width solid $color-border;
            background: white;
            display: grid;
            align-items: center;

            >.image-component {
                max-height: 80px;
                margin: 15px 50px;
                border-radius: 0;
            }
        }
    }
}
</style>