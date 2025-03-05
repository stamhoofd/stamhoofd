<template>
    <div class="st-view">
        <STNavigationBar :disable-pop="true" :disable-dismiss="!isPopup" :title="$t(`498b4239-0e71-45a6-9056-8dafda79e132`)"/>

        <main>
            <h1 v-if="created && type === 'order'">
                {{ $t('01cc0cb7-6fcb-41ae-9c60-b589cef92aa0') }}
            </h1>
            <h1 v-else-if="created">
                {{ $t('7d5518bc-3b61-4861-be22-f5c03ba7f006') }}
            </h1>
            <h1 v-else-if="payment.price < 0">
                {{ $t('c1435aaf-131c-4c62-bc70-922cc1715c46') }}
            </h1>
            <h1 v-else>
                {{ $t('46d114b6-1aa5-4900-a8e1-515f4ce09906') }}
            </h1>

            <p v-if="payment.price > 0 && payment.status !== 'Succeeded'">
                <template v-if="payment.transferSettings?.infoDescription">
                    {{ payment.transferSettings.infoDescription }}
                </template>
                <template v-else-if="created">
                    {{ $t('99617708-b3e5-48b5-927e-27cf3e259997') }}{{ formattedTransferDescription }}{{ $t('575f8a27-a768-4967-b90a-6210763a70d6') }}
                </template>
                <template v-else>
                    {{ $t('32505eb5-9a6b-4e48-bdd2-808fdd30e0db') }}{{ transferDescription }}{{ $t('575f8a27-a768-4967-b90a-6210763a70d6') }}
                </template>
            </p>
            <p v-else-if="payment.price < 0 && payment.status !== 'Succeeded' && !created">
                {{ $t('43757ba7-4ba4-4544-9c77-aec0a8e23aa9') }}
            </p>
            <p v-else-if="payment.price < 0 && payment.status === 'Succeeded'" class="success-box">
                {{ $t('b9b82d2d-76f9-4980-abc3-1a558e02cacd') }}
            </p>

            <div class="payment-split">
                <div class="rectangle">
                    <div v-if="payment.price > 0" class="rectangle-top hide-smartphone">
                        {{ $t('5328fb13-f277-4d65-8e11-3f0dd082f2fa') }}
                    </div>
                    <table class="payment-transfer-table rectangle">
                        <tbody>
                            <tr>
                                <td>{{ $t('ec09a8ac-1c47-4b41-b974-fbdb91bd5477') }}</td>
                                <td v-tooltip="'Klik om te kopiëren'" v-copyable="payment.price/100" class="style-copyable">
                                    {{ formatPrice(payment.price) }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td>{{ $t('f95defaa-5371-427d-9fa3-07be3e449a74') }}</td>
                                <td v-tooltip="'Klik om te kopiëren'" v-copyable="creditor" class="style-copyable">
                                    {{ creditor }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td>{{ $t('b5d2fd9c-93f2-4c6f-9a8b-48a3665b1f96') }}</td>
                                <td v-tooltip="'Klik om te kopiëren'" v-copyable="iban" class="style-copyable">
                                    {{ iban }}
                                </td>
                            </tr>
                            <tr v-if="payment.price > 0">
                                <td v-if="isStructured && isBelgium">
                                    {{ $t('fb7e4e6a-c7a6-4e1a-84ce-87bcf622f479') }}
                                </td>
                                <td v-else-if="isStructured">
                                    {{ $t('9122f96c-e520-4213-97fa-852687b5223e') }}
                                </td>
                                <td v-else>
                                    {{ $t('fb7e4e6a-c7a6-4e1a-84ce-87bcf622f479') }}
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
                        {{ $t('e10ee9b7-f09f-4bb2-9cce-cb30fe75d075') }}
                    </div>
                    <div class="rectangle-bottom">
                        <img v-if="isBelgium" src="@stamhoofd/assets/images/partners/scan-apps-belgium.svg"><img v-else src="@stamhoofd/assets/images/partners/scan-apps-nl.svg"></div>
                    <img v-if="QRCodeUrl" :src="QRCodeUrl" width="228" height="228"></div>
            </div>

            <div v-if="false && isBelgium && getOS() === 'iOS' && payment.price > 0 && payment.status !== 'Succeeded'" class="only-smartphone container">
                <hr><h2>{{ $t('9cba5ceb-fafe-4ee0-be4d-e23a7fa9acb0') }}</h2>
                <p>{{ $t('2e3b05b8-0e23-412d-8579-9a3f6316bf8b') }}</p>

                <STList>
                    <STListItem element-name="a" :href="'com.kbc.mobilesignqrcode://'+qrMessage">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/kbc/app.svg"></template>
                        <h3 class="style-title-list">
                            {{ $t('c0c93b37-b82a-4cfe-94a8-a12ea8d65541') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('3d2d4e47-e952-4717-bacf-514e6e5d4eab') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'bepingib://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/ing/app.svg"></template>
                        <h3 class="style-title-list">
                            {{ $t('08af02c9-5989-4c52-bfa7-76e7d6d449c2') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('71bb2570-cda4-428b-ad7c-c9aa7d7db5c8') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'BEPbelfius://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/belfius/app.svg"></template>
                        <h3 class="style-title-list">
                            {{ $t('8fb09e7a-de7a-43c2-9e74-9a562c06dba5') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('71bb2570-cda4-428b-ad7c-c9aa7d7db5c8') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'easybanking://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/bnp/app.png"></template>
                        <h3 class="style-title-list">
                            {{ $t('89385b6b-77cc-49ba-9294-6846e724e8c2') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('71bb2570-cda4-428b-ad7c-c9aa7d7db5c8') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'BEPargenta://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/argenta/app.png"></template>
                        <h3 class="style-title-list">
                            {{ $t('e1f08c28-731d-4ff3-9b58-c4b8bd3c25e7') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('71bb2570-cda4-428b-ad7c-c9aa7d7db5c8') }}
                        </p>
                    </STListItem>

                    <STListItem element-name="a" :href="'HBApp://'">
                        <template #left>
                            <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/hello-bank/app.png"></template>
                        <h3 class="style-title-list">
                            {{ $t('b5dc2f23-f3cc-46b4-bd01-2b6331ef3b2f') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('71bb2570-cda4-428b-ad7c-c9aa7d7db5c8') }}
                        </p>
                    </STListItem>
                </STList>

                <p class="style-description">
                    {{ $t('e6b37056-9297-4a4a-b0f5-fdac75c0515f') }}
                </p>
            </div>

            <p v-if="payment.price > 0 && payment.status === 'Succeeded'" class="success-box">
                {{ $t('a964c52b-da40-4442-9ac0-0c0c70fac585') }}
            </p>
            <template v-else-if="payment.price > 0 && created">
                <p v-if="isBelgium" class="hide-smartphone info-box">
                    <span>{{ $t('57ffb785-2dfb-45a5-a75d-26d538111170') }} <a class="inline-link" :href="$domains.getDocs('betalen-qr-code')" target="_blank">{{ $t('34099e11-aafe-435c-bd11-5b681610008e') }}</a></span>
                </p>
                <p v-else class="hide-smartphone info-box">
                    {{ $t('270601c0-b238-4140-8b02-12ed4f12fa68') }}
                </p>
            </template>
        </main>

        <STToolbar v-if="!isPopup">
            <template #right>
                <button v-if="payment.price > 0 && payment.status !== 'Succeeded'" class="button secundary hide-smartphone" type="button" @click="helpMe">
                    <span class="icon help"/>
                    <span>{{ $t('f128ae83-80bf-4050-aa1e-a22f9fd9d873') }}</span>
                </button>
                <button class="button primary" type="button" @click="goNext">
                    <span>{{ $t('458858f8-0a9a-4a3d-b4f4-a4421a48114e') }}</span>
                    <span class="icon arrow-right"/>
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
