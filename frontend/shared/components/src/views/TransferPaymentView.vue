<template>
    <div class="st-view">
        <STNavigationBar :disable-pop="true" :disable-dismiss="!isPopup" :title="$t(`53a090af-f09b-4f12-885e-de93a00d9278`)" />

        <main>
            <h1 v-if="created && type === 'order'">
                {{ $t('66268088-4ab1-4ace-b4fa-bb04abb383a1') }}
            </h1>
            <h1 v-else-if="created">
                {{ $t('fc18da3f-8c6a-4a86-9de5-08c56fbf7ede') }}
            </h1>
            <h1 v-else-if="payment.price < 0">
                {{ $t('447d1679-8b5c-4bce-8398-9df88cdae1a1') }}
            </h1>
            <h1 v-else>
                {{ $t('f0188924-973f-4b4e-a644-0bdb2f43ce75') }}
            </h1>

            <p v-if="payment.price > 0 && payment.status !== 'Succeeded'">
                <template v-if="payment.transferSettings?.infoDescription">
                    {{ payment.transferSettings.infoDescription }}
                </template>
                <template v-else-if="created">
                    {{ $t('0dee04b6-4e22-4fbf-af88-09c067bf9ebd', {description: formattedTransferDescription ?? ''}) }}
                </template>
                <template v-else>
                    {{ $t('eaccc532-f920-49d6-8eb9-08d43f24b1fd', {description: transferDescription ?? ''}) }}
                </template>
            </p>
            <p v-else-if="payment.price < 0 && payment.status !== 'Succeeded' && !created">
                {{ $t('6f258e1c-997c-461b-99ca-e9cc0020579d') }}
            </p>
            <p v-else-if="payment.price < 0 && payment.status === 'Succeeded'" class="success-box">
                {{ $t('6511bf8a-b374-4dd1-8048-03f7f22d8067') }}
            </p>

            <div class="payment-split">
                <div class="rectangle">
                    <div v-if="payment.price > 0" class="rectangle-top hide-smartphone">
                        {{ $t('75e4605c-cfa2-4906-a922-fffe2af099db') }}
                    </div>
                    <table class="payment-transfer-table rectangle">
                        <tbody>
                            <tr>
                                <td>{{ $t('a023893e-ab2c-4215-9981-76ec16336911') }}</td>
                                <td v-copyable="payment.price/100" class="style-copyable" :v-tooltip="$t('6b0bca07-3cba-45cf-bc94-e3217e59a69f')">
                                    {{ formatPrice(payment.price) }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td>{{ $t('31c28f13-d3b8-42ee-8979-c8224633237e') }}</td>
                                <td v-copyable="creditor" class="style-copyable" :v-tooltip="$t('6b0bca07-3cba-45cf-bc94-e3217e59a69f')">
                                    {{ creditor }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td>{{ $t('1fbed7d4-9e6e-4c87-b7fe-a9059aef2492') }}</td>
                                <td v-copyable="iban" class="style-copyable" :v-tooltip="$t('6b0bca07-3cba-45cf-bc94-e3217e59a69f')">
                                    {{ iban }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td v-if="isStructured && isBelgium">
                                    {{ $t('136b7ba4-7611-4ee4-a46d-60758869210f') }}
                                </td>
                                <td v-else-if="isStructured">
                                    {{ $t('013baf49-0ed9-4d41-8d3c-509897a2890a') }}
                                </td>
                                <td v-else>
                                    {{ $t('136b7ba4-7611-4ee4-a46d-60758869210f') }}
                                </td>
                                <td v-copyable="transferDescription" class="style-copyable" :v-tooltip="$t('6b0bca07-3cba-45cf-bc94-e3217e59a69f')">
                                    {{ formattedTransferDescription }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-if="payment.price > 0" class="hide-smartphone rectangle">
                    <div class="rectangle-top">
                        {{ $t('dd954163-a042-412a-acb3-49a55d3864b4') }}
                    </div>
                    <div class="rectangle-bottom">
                        <img v-if="isBelgium" src="@stamhoofd/assets/images/partners/scan-apps-belgium.svg"><img v-else src="@stamhoofd/assets/images/partners/scan-apps-nl.svg">
                    </div>
                    <img v-if="QRCodeUrl" :src="QRCodeUrl" width="228" height="228">
                </div>
            </div>

            <div v-if="false && isBelgium && getOS() === 'iOS' && payment.price > 0 && payment.status !== 'Succeeded'" class="only-smartphone container">
                <hr><h2>{{ $t('a0c9ef06-4f8e-4fa0-b94b-c1e612b390dc') }}</h2>
                <p>{{ $t('7e08e7df-a19c-486d-9ab4-e892762c0913') }}</p>

                <STList>
                    <STListItem element-name="a" :href="'com.kbc.mobilesignqrcode://'+qrMessage">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/kbc/app.svg">
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('a2f52798-c27f-4904-b651-2bec3aeebf21') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('e340ffec-98ed-4951-a5e0-dd98f2949229') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'bepingib://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/ing/app.svg">
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('9f6b5880-d02b-46a8-9b83-fc1e5320defe') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('d8a84fa6-ddc2-4518-8d12-3608ab830a15') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'BEPbelfius://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/belfius/app.svg">
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('0b894cff-2ae3-4954-a71c-7ccd1280668a') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('d8a84fa6-ddc2-4518-8d12-3608ab830a15') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'easybanking://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/bnp/app.png">
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('21b523b8-b6f1-4b21-ba56-0f9640670339') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('d8a84fa6-ddc2-4518-8d12-3608ab830a15') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'BEPargenta://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/argenta/app.png">
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('5b576dbc-9ed9-4faf-8bf7-9cf95c2b6dbe') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('d8a84fa6-ddc2-4518-8d12-3608ab830a15') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'HBApp://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/hello-bank/app.png">
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('131fbe93-acac-497e-a768-bbfccf3425f0') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('d8a84fa6-ddc2-4518-8d12-3608ab830a15') }}
                        </p>
                    </STListItem>
                </STList>

                <p class="style-description">
                    {{ $t('a69c9d5b-7191-49d8-b21a-f196547dfc0e') }}
                </p>
            </div>

            <p v-if="payment.price > 0 && payment.status === 'Succeeded'" class="success-box">
                {{ $t('5a4e3984-d134-42c0-abbd-d97ea48a6a11') }}
            </p>
            <template v-else-if="payment.price > 0 && created">
                <p v-if="isBelgium" class="hide-smartphone info-box">
                    <span>*{{ $t('a9a8348c-369e-4a06-8fcd-00da473238bc') }} <a class="inline-link" :href="$domains.getDocs('betalen-qr-code')" target="_blank">{{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}</a></span>
                </p>
                <p v-else class="hide-smartphone info-box">
                    {{ $t('3ae15f2e-b4fb-43dd-9dc6-1c388a9dc062') }}
                </p>
            </template>
        </main>

        <STToolbar v-if="!isPopup">
            <template #right>
                <button v-if="payment.price > 0 && payment.status !== 'Succeeded'" class="button secundary hide-smartphone" type="button" @click="helpMe">
                    <span class="icon help" />
                    <span>{{ $t('809b7c07-e6fb-4d65-806d-7ec52cc8b3b8') }}</span>
                </button>
                <button class="button primary" type="button" @click="goNext">
                    <span>{{ $t('c72a9ab2-98a0-4176-ba9b-86fe009fa755') }}</span>
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
        event.returnValue = $t(`Jouw inschrijving is al bevestigd! Je kan niet meer van betaalmethode veranderen.`);

        // This message is not visible on most browsers
        return $t(`Jouw inschrijving is al bevestigd! Je kan niet meer van betaalmethode veranderen.`);
    }
    // Chrome requires returnValue to be set
    event.returnValue = $t(`Jouw bestelling is al geplaatst! Als je je bestelling gaat aanpassen zal je een tweede bestelling plaatsen!`);

    // This message is not visible on most browsers
    return $t(`Jouw bestelling is al geplaatst! Als je je bestelling gaat aanpassen zal je een tweede bestelling plaatsen!`);
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
        new CenteredMessage($t(`Het lukt niet`), $t(`Jouw bestelling is al geplaatst, probeer dus zeker niet opnieuw! Als het scannen niet lukt, kan je gewoon de overschrijving manueel uitvoeren via de vermelde gegevens. Het scannen van de QR-code is niet noodzakelijk, en werkt niet in elke bankapp. Dit is niet te verwarren met een online betaling, de QR-code neemt enkel de gegevens over in je app zodat je sneller zonder typefouten kan overschrijven.`)).addCloseButton().show();
    }
    else {
        new CenteredMessage($t(`Het lukt niet`), $t(`Jouw inschrijving is al in orde, probeer dus zeker niet opnieuw! Als het scannen niet lukt, kan je gewoon de overschrijving manueel uitvoeren via de vermelde gegevens. Het scannen van de QR-code is niet noodzakelijk, en werkt niet in elke bankapp. Dit is niet te verwarren met een online betaling, de QR-code neemt enkel de gegevens over in je app zodat je sneller zonder typefouten kan overschrijven.`)).addCloseButton().show();
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
