<template>
    <div class="st-view">
        <STNavigationBar title="Overschrijven" :disable-pop="true" :disable-dismiss="!isPopup" />

        <main>
            <h1 v-if="created && type === 'order'">
                Bestelling geplaatst! Schrijf nu over.
            </h1>
            <h1 v-else-if="created">
                Gelukt! Schrijf nu het bedrag over
            </h1>
            <h1 v-else-if="payment.price < 0">
                Terugbetaling via overschrijving
            </h1>
            <h1 v-else>
                Bedrag overschrijven
            </h1>

            <p v-if="payment.price > 0 && payment.status !== 'Succeeded'">
                <template v-if="payment.transferSettings?.infoDescription">
                    {{ payment.transferSettings.infoDescription }}
                </template>
                <template v-else-if="created">
                    Voer de overschrijving meteen uit. Vermeld zeker “{{ formattedTransferDescription }}” in je overschrijving.
                </template>
                <template v-else>
                    We kijken de betaalstatus van jouw overschrijving manueel na. Het kan dus even duren voor je hier ziet staan dat we de betaling hebben ontvangen. Vermeld zeker “{{ transferDescription }}” in je overschrijving.
                </template>
            </p>
            <p v-else-if="payment.price < 0 && payment.status !== 'Succeeded' && !created">
                Je ontvangt dit bedrag binnenkort terug op jouw rekening.
            </p>
            <p v-else-if="payment.price < 0 && payment.status === 'Succeeded'" class="success-box">
                We hebben dit bedrag terug op jouw rekening gestort.
            </p>

            <div class="payment-split">
                <div class="rectangle">
                    <div v-if="payment.price > 0" class="rectangle-top hide-smartphone">
                        Typ het over
                    </div>
                    <table class="payment-transfer-table rectangle">
                        <tbody>
                            <tr>
                                <td>Bedrag</td>
                                <td v-tooltip="'Klik om te kopiëren'" v-copyable="payment.price/100" class="style-copyable">
                                    {{ formatPrice(payment.price) }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td>Begunstigde</td>
                                <td v-tooltip="'Klik om te kopiëren'" v-copyable="creditor" class="style-copyable">
                                    {{ creditor }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td>Rekeningnummer</td>
                                <td v-tooltip="'Klik om te kopiëren'" v-copyable="iban" class="style-copyable">
                                    {{ iban }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td v-if="isStructured && isBelgium">
                                    Mededeling
                                </td>
                                <td v-else-if="isStructured">
                                    Betalingskenmerk
                                </td>
                                <td v-else>
                                    Mededeling
                                </td>
                                <td v-tooltip="'Klik om te kopiëren'" v-copyable="transferDescription" class="style-copyable">
                                    {{ formattedTransferDescription }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-if="payment.price > 0" class="hide-smartphone rectangle">
                    <div class="rectangle-top">
                        Kopieer in app
                    </div>
                    <div class="rectangle-bottom">
                        <img v-if="isBelgium" src="@stamhoofd/assets/images/partners/scan-apps-belgium.svg">
                        <img v-else src="@stamhoofd/assets/images/partners/scan-apps-nl.svg">
                    </div>
                    <img v-if="QRCodeUrl" :src="QRCodeUrl" width="228" height="228">
                </div>
            </div>

            <div v-if="false && isBelgium && getOS() === 'iOS' && payment.price > 0 && payment.status !== 'Succeeded'" class="only-smartphone container">
                <hr>
                <h2>Snel app openen</h2>
                <p>Je moet niet noodzakelijk overschrijven via een app of één van deze apps. Dit is puur voor het gemak, het gaat hier om een gewone overschrijving.</p>

                <STList>
                    <STListItem element-name="a" :href="'com.kbc.mobilesignqrcode://'+qrMessage">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/kbc/app.svg">
                        </template>
                        <h3 class="style-title-list">
                            KBC Mobile
                        </h3>
                        <p class="style-description">
                            Gegevens worden automatisch ingevuld
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'bepingib://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/ing/app.svg">
                        </template>
                        <h3 class="style-title-list">
                            ING Banking
                        </h3>
                        <p class="style-description">
                            Kopieer zelf manueel de gegevens bovenaan
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'BEPbelfius://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/belfius/app.svg">
                        </template>
                        <h3 class="style-title-list">
                            Belfius Mobile
                        </h3>
                        <p class="style-description">
                            Kopieer zelf manueel de gegevens bovenaan
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'easybanking://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/bnp/app.png">
                        </template>
                        <h3 class="style-title-list">
                            Easy Banking App (BNP Paribas Fortis)
                        </h3>
                        <p class="style-description">
                            Kopieer zelf manueel de gegevens bovenaan
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'BEPargenta://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/argenta/app.png">
                        </template>
                        <h3 class="style-title-list">
                            Argenta-app
                        </h3>
                        <p class="style-description">
                            Kopieer zelf manueel de gegevens bovenaan
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'HBApp://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/hello-bank/app.png">
                        </template>
                        <h3 class="style-title-list">
                            Hello Bank! app
                        </h3>
                        <p class="style-description">
                            Kopieer zelf manueel de gegevens bovenaan
                        </p>
                    </STListItem>
                </STList>

                <p class="style-description">
                    Of open zelf een andere app. Je kan de gegevens makkelijk kopiëren hierboven door erop te klikken.
                </p>
            </div>

            <p v-if="payment.price > 0 && payment.status === 'Succeeded'" class="success-box">
                We hebben de betaling ontvangen.
            </p>
            <template v-else-if="payment.price > 0 && created">
                <p v-if="isBelgium" class="hide-smartphone info-box">
                    <span>*De QR-code kan je enkel scannen met een beperkt aantal bankapps, niet met je ingebouwde QR-scanner en ook niet met Payconiq/Bancontact. De QR-code scannen is optioneel, voer de overschrijving gewoon uit zonder QR-code als het niet lukt (dat is net hetzelfde). Dit is een overschrijving, niet te verwarren met een online betaling. <a class="inline-link" :href="$domains.getDocs('betalen-qr-code')" target="_blank">Meer info</a></span>
                </p>
                <p v-else class="hide-smartphone info-box">
                    De QR-code scannen is optioneel, voer de overschrijving gewoon uit zonder QR-code als het niet lukt (dat is net hetzelfde). De QR-code kan je enkel scannen met een beperkt aantal bankapps, niet met je ingebouwde QR-scanner.
                </p>
            </template>
        </main>

        <STToolbar v-if="!isPopup">
            <template #right>
                <button v-if="payment.price > 0 && payment.status !== 'Succeeded'" class="button secundary hide-smartphone" type="button" @click="helpMe">
                    <span class="icon help" />
                    <span>Het lukt niet</span>
                </button>
                <button class="button primary" type="button" @click="goNext">
                    <span>Doorgaan</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { useCanDismiss, useDismiss, usePop } from '@simonbackx/vue-app-navigation';
import { NavigationActions } from '@stamhoofd/components';
import { Country, Organization, Payment, TransferDescriptionType, TransferSettings } from '@stamhoofd/structures';

import { useTranslate } from '@stamhoofd/frontend-i18n';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { useNavigationActions } from '../types/NavigationActions';

const props = withDefaults(defineProps<{
    payment: Payment;
    created?: boolean;
    type: 'registration' | 'order';
    organization: Organization;
    settings?: TransferSettings | null;
    isPopup?: boolean;
    finishedHandler?: ((payment: Payment | null, navigate: NavigationActions) => void) | null;
}>(), {
    created: false,
    settings: null,
    isPopup: false,
    finishedHandler: null,
});

const QRCodeUrl = ref<string | null>(null);
const canDismiss = useCanDismiss();
const dismiss = useDismiss();
const pop = usePop();
const $t = useTranslate();
const navigate = useNavigationActions();

onMounted(() => {
    generateQRCode().catch(e => console.error(e));
    setLeave();
});

function getOS(): string {
    var userAgent = navigator.userAgent || navigator.vendor;

    if (/android/i.test(userAgent)) {
        return 'android';
    }

    if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
        // Different sms protocol
        return 'macOS-old';
    }

    // iOS detection from: http://stackoverflow.com/a/9039885/177710
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
        return 'iOS';
    }

    // iPad on iOS 13 detection
    if (navigator.userAgent.includes('Mac') && 'ontouchend' in document) {
        return 'iOS';
    }

    if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
        return 'macOS';
    }

    if (navigator.platform.toUpperCase().indexOf('WIN') >= 0) {
        return 'windows';
    }

    if (navigator.platform.toUpperCase().indexOf('IPHONE') >= 0) {
        return 'iOS';
    }

    if (navigator.platform.toUpperCase().indexOf('ANDROID') >= 0) {
        return 'android';
    }

    return 'unknown';
}

const preventLeave = (event: BeforeUnloadEvent) => {
    // Cancel the event
    event.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown

    if (props.type === 'registration') {
        // Chrome requires returnValue to be set
        event.returnValue = 'Jouw inschrijving is al bevestigd! Je kan niet meer van betaalmethode veranderen.';

        // This message is not visible on most browsers
        return 'Jouw inschrijving is al bevestigd! Je kan niet meer van betaalmethode veranderen.';
    }
    // Chrome requires returnValue to be set
    event.returnValue = 'Jouw bestelling is al geplaatst! Als je je bestelling gaat aanpassen zal je een tweede bestelling plaatsen!';

    // This message is not visible on most browsers
    return 'Jouw bestelling is al geplaatst! Als je je bestelling gaat aanpassen zal je een tweede bestelling plaatsen!';
};

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', preventLeave);
});

function setLeave() {
    if (!props.created) {
        return;
    }
    window.addEventListener('beforeunload', preventLeave);
}

function shouldNavigateAway() {
    if (!props.created) {
        return true;
    }
    return false;
}

const isBelgium = computed(() => props.organization.address.country === Country.Belgium);
const isStructured = computed(() => props.settings?.type === TransferDescriptionType.Structured);
const iban = computed(() => props.settings?.iban ?? props.organization.meta.transferSettings.iban ?? '');
const creditor = computed(() => props.settings?.creditor ?? props.organization.name);
const transferDescription = computed(() => props.payment.transferDescription);
const formattedTransferDescription = computed(() => {
    if (isStructured.value && !isBelgium.value && transferDescription.value) {
        return transferDescription.value.match(/.{1,4}/g)?.join(' ') ?? transferDescription.value;
    }
    return transferDescription.value;
});

const qrMessage = computed(() => {
    const ibanValue = iban.value;
    const creditorValue = creditor.value;

    // BUG in Fortis app -> need to fill in at least one character for the BIC/SWIFT field, otherwise it won't work
    const bic = '_';

    // Note: structured reference still as normal description (the structured reference ISO is not supported)
    return 'BCD\n001\n1\nSCT\n' + bic + '\n' + creditorValue + '\n' + ibanValue + '\nEUR' + (props.payment.price / 100).toFixed(2) + '\n\n\n' + transferDescription.value?.substring(0, 140) + '\nhttps://' + $t('ccfc0566-2fc4-4c0a-b1da-c3059cad6586') + '/docs/betalen-qr-code';
});

async function generateQRCode() {
    try {
        const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default;
        QRCodeUrl.value = await QRCode.toDataURL(qrMessage.value);
    }
    catch (e) {
        console.error(e);
        return;
    }
}

function helpMe() {
    if (props.type === 'order') {
        new CenteredMessage('Het lukt niet', 'Jouw bestelling is al geplaatst, probeer dus zeker niet opnieuw! Als het scannen niet lukt, kan je gewoon de overschrijving manueel uitvoeren via de vermelde gegevens. Het scannen van de QR-code is niet noodzakelijk, en werkt niet in elke bankapp. Dit is niet te verwarren met een online betaling, de QR-code neemt enkel de gegevens over in je app zodat je sneller zonder typefouten kan overschrijven.').addCloseButton().show();
    }
    else {
        new CenteredMessage('Het lukt niet', 'Jouw inschrijving is al in orde, probeer dus zeker niet opnieuw! Als het scannen niet lukt, kan je gewoon de overschrijving manueel uitvoeren via de vermelde gegevens. Het scannen van de QR-code is niet noodzakelijk, en werkt niet in elke bankapp. Dit is niet te verwarren met een online betaling, de QR-code neemt enkel de gegevens over in je app zodat je sneller zonder typefouten kan overschrijven.').addCloseButton().show();
    }
}

function goNext() {
    if (props.finishedHandler) {
        props.finishedHandler(props.payment, navigate);
        return;
    }

    if (canDismiss.value) {
        dismiss({ force: true })?.catch(console.error);
        return;
    }
    pop({ force: true })?.catch(console.error);
}

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.payment-split {
    display: flex;
    flex-direction: row;
    padding: 15px 0;

    @media (max-width: 800px) {
        padding: 0;
        flex-direction: column;
    }

    > .rectangle {
        border: 2px solid $color-border;
        border-radius: 8px;
        padding: 20px;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        > table {
            align-self: flex-start;
            margin-left: 10px;

            @media (max-width: 800px) {
                margin-left: 0px;
            }
        }

        @media (max-width: 800px) {
            padding: 0;
            border: 0;
        }

        >.rectangle-top {
            position: absolute;
            top: 0;
            transform: translate(-50%, -50%);
            background: $color-background;
            text-align: center;
            left: 50%;
            max-width: 90%;
            padding: 0 15px;
            box-sizing: border-box;
            line-height: 1.4;

            @extend .style-interactive-small;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        >.rectangle-bottom {
            position: absolute;
            bottom: 0;
            transform: translate(-50%, 50%);
            background: $color-background;
            text-align: center;
            left: 50%;
            max-width: 90%;
            padding: 0 15px;
            box-sizing: border-box;

            @extend .style-interactive-small;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        &:first-child {
            flex-grow: 1;
            margin-right: 15px;;
            padding: 15px 15px;

            @media (max-width: 800px) {
                margin-right: 0px;
                margin-bottom: 30px;
                padding: 0;
            }
        }
    }

    @media (max-width: 800px) {
        .hide-smartphone {
            display: none;
        }
    }
}
.payment-transfer-table {
    td {
        vertical-align: baseline;
        touch-action: manipulation;
        cursor: pointer;

        &:focus {
            color: $color-primary;
            outline: none;
        }
    }
    td:first-child {
        @extend .style-title-small;
        padding: 7px 15px 7px 0;
        white-space: nowrap;

        @media (max-width: 400px) {
            font-size: 12px;
        }
    }

    td:last-child {
        @extend .style-description;

        @media (max-width: 400px) {
            font-size: 12px;
        }
    }
}
.payment-app-logo {
    height: 35px;
}
</style>
