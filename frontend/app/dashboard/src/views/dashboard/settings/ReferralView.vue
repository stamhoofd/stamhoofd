<template>
    <LoadingViewTransition>
        <div v-if="status" id="referral-view" class="st-view background">
            <STNavigationBar :title="$t('Verdien tegoed')" />

            <main>
                <h1 v-if="!status.invoiceValue">
                    {{ $t('Geef {value}, krijg tot 100 euro tegoed* per vereniging', {value: formatPrice(status.value)}) }}
                </h1>
                <h1 v-else>
                    {{ $t('Jouw doorverwijzingslink van {value}', {value: formatPrice(status.value)}) }}
                </h1>

                <p v-if="!status.invoiceValue">
                    {{ $t('Ongetwijfeld ken je nog veel andere verenigingen (of ben je er ook in actief): een sportclub, school, jeugdbeweging... Als je andere verenigingen aanbrengt, en ze minimaal 1 euro besteden ontvang je zelf ook gratis tegoed. Per vereniging die je aanbrengt ontvang je telkens iets meer (zie tabel onderaan). Doe je het dus zorgvuldig en doordacht, dan kan je echt een hoop tegoed verzamelen zonder al te veel moeite.') }}
                </p>

                <hr>
                <h2>{{ $t('Jouw doorverwijzingslink') }}</h2>

                <input v-copyable="href" v-tooltip="$t('Klik om te kopiëren')" class="input" :value="href" readonly>

                <p class="info-box">
                    {{ $t('Om andere verenigingen te motiveren om jouw link te gebruiken, krijgen ze zelf ook 25 euro tegoed.') }}
                </p>

                <STList>
                    <STListItem :selectable="true" @click="openFacebookShare">
                        <h2 class="style-title-list">
                            {{ $t('Delen op Facebook') }}
                        </h2>
                        <template #left>
                            <span class="icon share" />
                        </template>
                    </STListItem>
                    <STListItem v-if="canShare" :selectable="true" @click="share">
                        <h2 class="style-title-list">
                            {{ $t('Verstuur de link via SMS, e-mail, WhatsApp...') }}
                        </h2>
                        <template #left>
                            <span class="icon share" />
                        </template>
                    </STListItem>
                    <STListItem v-if="!isNative" :selectable="true" @click="downloadQR">
                        <h2 class="style-title-list">
                            {{ $t('Download de QR-code') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('Als je fysiek bij iemand bent, dan kan die deze QR-code scannen om de link te gebruiken.') }}
                        </p>
                        <template #left>
                            <span class="icon qr-code" />
                        </template>
                    </STListItem>
                </STList>

                <template v-if="!status.invoiceValue">
                    <hr>
                    <h2>{{ $t('Overzicht van te verdienen tegoed') }}</h2>
                    <p>{{ $t('Het bedrag dat je ontvangt stijgt per vereniging tot maximaal 100 euro per vereniging. Dus als je 6 verenigingen hebt aangebracht, verdien je in totaal € 210! Breng je er 10 aan, dan verdien je 550 euro.') }}</p>

                    <STList>
                        <STListItem v-for="n in 9" :key="n">
                            {{ $t('{n}e vereniging', {n}) }}

                            <template #right>
                                <span class="style-tag large">€ {{ n * 10 }}</span>
                            </template>
                            <template #left>
                                <span v-if="referredCount >= n" class="icon star yellow" />
                                <span v-else class="icon star-line light-gray" />
                            </template>
                        </STListItem>
                        <STListItem>
                            {{ $t('10e, 11e, 12e... vereniging') }}

                            <template #right>
                                <span class="style-tag large">€ 100</span>
                            </template>
                            <template #left>
                                <span v-if="referredCount >= 10" class="icon star yellow" />
                                <span v-else class="icon star-line light-gray" />
                            </template>
                        </STListItem>
                    </STList>
                </template>

                <hr>
                <h2>{{ $t('Geschiedenis') }}</h2>
                <p>{{ $t('Hieronder kan je zien welke verenigingen jouw link hebben gebruikt.') }}</p>

                <STList v-if="status.usedCodes.length > 0">
                    <STListItem v-for="used in status.usedCodes" :key="used.id" class="right-description">
                        <template #left>
                            <span v-if="used.creditValue !== null" class="icon success green" />
                            <span v-else class="icon clock gray" />
                        </template>
                        <h2 class="style-title-list">
                            {{ used.organizationName }}
                        </h2>
                        <p v-if="used.creditValue" class="style-description">
                            {{ $t('Je hebt jouw tegoed ontvangen!') }}
                        </p>
                        <p v-else-if="used.creditValue !== null && status.invoiceValue" class="style-description">
                            {{ $t('Aangerekend in je openstaande saldo.') }}
                        </p>
                        <p v-else-if="!status.invoiceValue" class="style-description">
                            {{ $t('Registreerde op {date}. Je ontvangt jouw tegoed zodra deze vereniging 1 euro heeft besteed.', {date: formatDate(used.createdAt)}) }}
                        </p>
                        <p v-else class="style-description">
                            {{ $t('Registreerde op {date}. Er werd nog niets aangekocht of gefactureerd.', {date: formatDate(used.createdAt)}) }}
                        </p>
                        <template #right>
                            <span v-if="used.creditValue" class="style-tag large success">{{ formatPrice(used.creditValue) }}</span>
                        </template>
                    </STListItem>
                </STList>

                <p v-else class="info-box">
                    {{ $t('Jouw link werd nog niet gebruikt') }}
                </p>

                <hr v-if="!status.invoiceValue">
                <p v-if="!status.invoiceValue" class="style-description-small">
                    {{ $t('* We betalen het tegoed nooit uit. Je kan het enkel gebruiken om pakketten in Stamhoofd aan te kopen. Je kan je tegoed niet doorgeven aan een andere vereniging. Je kan geen tegoed krijgen voor een vereniging die al Stamhoofd gebruikt of al heeft geregistreerd. Ook als die persoon al een andere vereniging heeft op Stamhoofd kan je er geen tegoed meer voor krijgen. Tegoed vervalt als het één jaar lang niet gebruikt wordt (de geldigheid wordt telkens verlengd zodra er minstens 1 cent van gebruikt wordt). Je kan het tegoed niet gebruiken voor het betalen van transactiekosten van online betalingen. Meerdere verenigingen zelf aanmaken om zo tegoed te krijgen is niet toegestaan. Als het doorverwijzen gebeurt op een manier die als spam kan worden ervaren, kunnen we beslissen om het toekennen ongedaan te maken.') }}
                </p>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { Toast } from '@stamhoofd/components';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { AppManager } from '@stamhoofd/networking';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { RegisterCodeStatus } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

const status = ref<RegisterCodeStatus | null>(null);
const context = useContext();
const owner = useRequestOwner();
const organization = useRequiredOrganization();

const isNative = AppManager.shared.isNative;
const canShare = !!navigator.share;

const referralText = $t('Op zoek naar gemakkelijke ledenadministratie of wil je geld inzamelen via een webshop voor jouw vereniging? Wij gebruiken daarvoor Stamhoofd en we mogen 25 euro tegoed uitdelen aan alle verenigingen (sportclubs, jeugdbeweging, scholen, VZW\'s...) die zich op Stamhoofd registreren via onze link.');

const href = computed(() => {
    return 'https://' + STAMHOOFD.domains.dashboard + '/aansluiten?code=' + encodeURIComponent(status.value?.code ?? '') + '&org=' + encodeURIComponent(organization.value.name);
});

const referredCount = computed(() => {
    return status.value?.usedCodes.reduce((c, code) => c + (code.creditValue !== null ? 1 : 0), 0) ?? 0;
});

function share() {
    navigator.share({
        text: referralText,
        url: href.value,
    }).catch(e => console.error(e));
}

async function downloadQR() {
    try {
        const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default;
        const url = await QRCode.toDataURL(href.value, { scale: 10 });
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'qr-code.png';
        anchor.click();
    }
    catch (e) {
        console.error(e);
    }
}

async function loadCode() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/billing/register-code',
            decoder: RegisterCodeStatus as Decoder<RegisterCodeStatus>,
            owner,
        });
        response.data.usedCodes.sort((a, b) => Sorter.byDateValue(b.createdAt, a.createdAt));
        status.value = response.data;
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
}

function openFacebookShare() {
    window.open('https://www.facebook.com/sharer/sharer.php?u=https://' + LocalizedDomains.marketing + '&quote=' + encodeURIComponent(referralText), 'pop', 'width=600, height=400, scrollbars=no');
}

loadCode().catch(console.error);
</script>
