<template>
    <div class="st-view detailed-ticket-view">
        <STNavigationBar :title="name" :disable-dismiss="!allowDismiss" :sticky="false" :large="logo">
            <template #left>
                <OrganizationLogo v-if="logo" :organization="organization" />
            </template>
            <template v-if="canShare" #right>
                <button class="button icon share" type="button" @click="share" />
            </template>
        </STNavigationBar>
        <main>
            <figure class="qr-box">
                <div>
                    <img v-if="QRCodeUrl" :src="QRCodeUrl" :class="{ scanned: !!ticket.scannedAt}" class="peak-brightness" width="370" height="370"><div class="placeholder" />
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
            <p v-if="isSingle && order" class="description" v-text="$t('1a2a842e-4f98-4818-911b-c9634aca4214')+order.number" />
            <p v-if="isSingle && order" class="description" v-text="order.data.customer.name" />
            <p v-if="cartItem.descriptionWithoutDate" class="description" v-text="cartItem.descriptionWithoutDate" />
            <p v-if="changedSeatString" class="warning-box">
                {{ changedSeatString }}
            </p>

            <STList>
                <STListItem v-if="cartItem.product.location">
                    <h3 class="style-definition-label">
                        {{ $t('7eec15d0-4d60-423f-b860-4f3824271578') }}
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
                        <span>{{ $t('cf0f413b-04c9-458a-b33d-12a72f6f24a6') }}</span>
                        <span class="icon arrow-right-small" />
                    </button>
                </STListItem>

                <STListItem v-if="cartItem.product.dateRange">
                    <h3 class="style-definition-label">
                        {{ $t('13081716-3941-44b8-87b4-398ab2288419') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateRange(cartItem.product.dateRange) }}
                    </p>
                </STListItem>

                <STListItem v-if="price">
                    <h3 class="style-definition-label">
                        {{ $t('52bff8d2-52af-4d3f-b092-96bcfa4c0d03') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(price) }}
                    </p>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="download">
                    <span class="icon download" />
                    <span>{{ $t('a103aa7c-4693-4bd2-b903-d14b70bfd602') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { ImageComponent, OrganizationLogo, ShowSeatsView, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Order, Organization, ProductDateRange, TicketPublic, Webshop, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{
    logo?: boolean;
    webshop: Webshop;
    organization: Organization;
    ticket: TicketPublic;
    order?: Order | null;
    allowDismiss?: boolean;
}>(), {
    logo: false,
    order: null,
    allowDismiss: true,
});

const show = useShow();
const QRCodeUrl = ref<string | null>(null);
const visibleSponsor = ref(0);

// TODO: multiple item support needed!
const cartItem = computed(() => props.ticket.items[0]);
const indexDescription = computed(() => props.ticket.getIndexDescription(props.webshop));
const changedSeatString = computed(() => props.ticket.getChangedSeatString(props.webshop, true));
const sponsors = computed(() => (props.webshop.meta.sponsors?.sponsors ?? []).filter(s => s.onTickets && (s.banner || s.logo)));
const name = computed(() => props.ticket.getTitle());
const canShare = computed(() => !!navigator.share);
const price = computed(() => props.ticket.getPrice(props.order));
const isSingle = computed(() => props.webshop.meta.ticketType === WebshopTicketType.SingleTicket);

function share() {
    navigator.share({
        title: props.webshop.meta.name + ' - ' + name.value,
        text: $t(`ed42a654-193c-4d1b-8f5b-a98bed2b575d`),
        url: qrMessage.value,
    }).catch(e => console.error(e));
}

function showSeats() {
    show({
        components: [
            new ComponentWithProperties(ShowSeatsView, {
                webshop: props.webshop,
                ticket: props.ticket,
                order: props.order,
                allowDismiss: props.allowDismiss,
            }),
        ],
    }).catch(console.error);
}

function formatPrice(price: number) {
    return Formatter.price(price);
}

function formatDateRange(dateRange: ProductDateRange) {
    return Formatter.capitalizeFirstLetter(dateRange.toString());
}

const qrMessage = computed(() => 'https://' + props.webshop.getUrl(props.organization) + '/tickets/' + props.ticket.secret);

let timer: NodeJS.Timeout;

onMounted(() => {
    generateQRCode().catch(console.error);
    visibleSponsor.value = Math.floor(Math.random() * Math.max(0, sponsors.value.length - 1));

    timer = setInterval(() => {
        console.log('tick');
        if (visibleSponsor.value + 1 >= sponsors.value.length) {
            visibleSponsor.value = 0;
        }
        else {
            visibleSponsor.value = visibleSponsor.value + 1;
        }
    }, 3000);
});

onBeforeUnmount(() => {
    clearInterval(timer);
});

async function download() {
    const TicketBuilder = (await import(
        /* webpackChunkName: "TicketBuilder" */
        /* webpackPrefetch: true */
        '@stamhoofd/ticket-builder',
    )).TicketBuilder;

    const builder = new TicketBuilder([props.ticket], props.webshop, props.organization, props.order ?? undefined);
    await builder.download();
}

async function generateQRCode() {
    const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default;

    // Increase scanning speed on mobile screens by adding more correction levels
    QRCodeUrl.value = await QRCode.toDataURL(qrMessage.value, {
        margin: 0,
        width: 370,
        color: {
            light: '#ffffff',
            dark: '#000000',
        },
    });
}

function shouldNavigateAway() {
    return props.allowDismiss;
}

defineExpose({
    shouldNavigateAway,
});
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
