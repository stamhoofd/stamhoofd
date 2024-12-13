<template>
    <div class="st-view payment-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar de vorige'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar de volgende'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <p v-if="payment.type !== PaymentType.Payment && payment.method !== PaymentMethod.Unknown" :class="'style-title-prefix ' + payment.theme">
                <span>{{ PaymentTypeHelper.getName(payment.type) }}</span>
                <span :class="'icon small ' + PaymentTypeHelper.getIcon(payment.type)" />
            </p>

            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ title }}</span>

                <span v-if="payment.isPending" v-tooltip="'In verwerking'" class="icon small hourglass primary" />
                <span v-if="payment.isFailed" v-tooltip="'Mislukt'" class="icon small disabled error" />
            </h1>

            <template v-if="canWrite">
                <p v-if="payment.type === PaymentType.Reallocation">
                    Een saldoverrekening kan manueel of automatisch voorkomen. Stel dat iemand betaalde voor een evenement, maar dat op tijd annuleerde, dan kan dat tegoed gebruikt worden om bijvoorbeeld iets anders volledig of gedeeltelijk te betalen voor hetzelfde bedrag. {{ platform.config.name }} maakt automatische saldoverrekeningen aan voor gelijkaardige items, bv. als je een inschrijving hebt gewijzigd.
                </p>
                <p v-if="payment.method === PaymentMethod.Transfer && payment.isFailed" class="error-box">
                    Deze overschrijving werd geannuleerd en is niet langer zichtbaar. Ontvang je toch nog de betaling? Heractiveer de overschrijving dan terug.
                </p>

                <p v-if="payment.isPending && payment.method === PaymentMethod.Transfer && payment.isOverDue && payment.type == PaymentType.Payment" class="warning-box">
                    Annuleer een betaling als je deze nog niet hebt ontvangen. Op die manier weet het systeem dat, en zullen de automatische herinneringssystemen correct werken. Het openstaande bedrag zal dan ook terug worden verhoogd waardoor een nieuwe betaalpoging mogelijk is.
                </p>

                <p v-if="payment.isPending && payment.type == PaymentType.Refund" class="warning-box">
                    Je laat een terugbetaling best niet op 'in verwerking' staan. Annuleer de terugbetaling als je deze nog niet hebt uitgevoerd.
                </p>
            </template>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList class="info">
                <STListItem v-if="payment.price">
                    <h3 class="style-definition-label">
                        Totaalbedrag
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(payment.price) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.method === 'Transfer'">
                    <h3 class="style-definition-label">
                        Mededeling
                    </h3>
                    <p class="style-definition-text">
                        {{ payment.transferDescription }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.method === 'Transfer' && payment.transferSettings">
                    <h3 v-if="payment.price >= 0" class="style-definition-label">
                        Betalen aan
                    </h3>
                    <h3 v-else class="style-definition-label">
                        Terugbetaald vanaf
                    </h3>
                    <p class="style-definition-text">
                        {{ payment.transferSettings }}
                    </p>
                </STListItem>

                <STListItem v-if="isManualMethod">
                    <h3 class="style-definition-label">
                        Aangemaakt op
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(payment.createdAt) }}
                    </p>
                    <p class="style-description-small">
                        Om {{ formatTime(payment.createdAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.paidAt">
                    <h3 v-if="payment.price == 0" class="style-definition-label">
                        Geboekt op
                    </h3>
                    <h3 v-else-if="payment.price >= 0" class="style-definition-label">
                        Betaald op
                    </h3>
                    <h3 v-else class="style-definition-label">
                        Terugbetaald op
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(payment.paidAt) }}
                    </p>
                    <p class="style-description-small">
                        Om {{ formatTime(payment.paidAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.iban">
                    <h3 class="style-definition-label">
                        Betaald via IBAN
                    </h3>

                    <p class="style-definition-text">
                        {{ payment.iban }}
                    </p>
                    <p v-if="payment.ibanName" class="style-description-small">
                        Op naam van {{ payment.ibanName }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.settlement" class="right-description right-stack">
                    <h3 class="style-definition-label">
                        Uitbetaald op
                    </h3>

                    <p class="style-definition-text">
                        {{ formatDate(payment.settlement.settledAt) }}<br>
                        Mededeling "{{ payment.settlement.reference }}"
                    </p>
                </STListItem>

                <STListItem v-if="payment.transferFee">
                    <h3 class="style-definition-label">
                        Transactiekost
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.transferFee) }}
                    </p>
                    <p class="style-description-small">
                        <template v-if="VATPercentage > 0">
                            Incl. {{ VATPercentage }}% BTW —
                        </template> <a :href="$domains.getDocs('transactiekosten-inhouding')" class="inline-link" target="_blank">Meer info</a>
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>Facturatiegegevens</h2>

            <p v-if="!payment.customer" class="info-box">
                Deze betaling heeft geen facturatiegegevens.
            </p>
            <STList v-else-if="payment.customer.company" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Bedrijfsnaam
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.name }}
                    </p>
                    <p v-if="!payment.customer.company.VATNumber && !payment.customer.company.companyNumber" class="style-description">
                        Feitelijke vereniging
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.VATNumber">
                    <h3 class="style-definition-label">
                        BTW-nummer
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.VATNumber || 'Niet BTW-plichtig' }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.companyNumber && (!payment.customer.company.VATNumber || (payment.customer.company.companyNumber !== payment.customer.company.VATNumber && payment.customer.company.companyNumber !== payment.customer.company.VATNumber.slice(2)))">
                    <h3 class="style-definition-label">
                        Ondernemingsnummer
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.companyNumber || 'Niet BTW-plichtig' }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.address">
                    <h3 class="style-definition-label">
                        Adres
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.address.toString() }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.administrationEmail">
                    <h3 class="style-definition-label">
                        E-mailadres
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.administrationEmail }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.name">
                    <h3 class="style-definition-label">
                        Contactpersoon
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.name }}
                    </p>
                    <p v-if="payment.customer.email" v-copyable class="style-description style-copyable">
                        {{ payment.customer.email }}
                    </p>
                </STListItem>
            </STList>

            <STList v-else class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Contactpersoon
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.name || 'Naamloos' }}
                    </p>
                    <p v-if="payment.customer.email" v-copyable class="style-description style-copyable">
                        {{ payment.customer.email }}
                    </p>
                </STListItem>
            </STList>

            <template v-if="isManualMethod && canWrite">
                <hr>
                <h2>Acties</h2>

                <STList>
                    <STListItem v-if="payment.isFailed" :selectable="true" @click="markPending">
                        <h2 class="style-title-list">
                            Heactiveer
                        </h2>
                        <p class="style-description">
                            Wijzig de status terug naar 'wacht op betaling'.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon clock" />
                                <span>Heractiveer</span>
                            </button>
                            <button type="button" class="button icon success only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="payment.isPending && payment.type === PaymentType.Payment" :selectable="true" @click="markPaid">
                        <h2 class="style-title-list">
                            Markeer als betaald
                        </h2>
                        <p v-if="payment.webshopIds.length" class="style-description">
                            Stuurt mogelijks een automatische e-mail ter bevestiging.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon success" />
                                <span>Betaald</span>
                            </button>
                            <button type="button" class="button icon success only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="payment.isSucceeded && payment.type === PaymentType.Payment" :selectable="true" @click="markPending">
                        <h2 class="style-title-list">
                            Toch niet betaald
                        </h2>
                        <p v-if="payment.method === 'Transfer'" class="style-description">
                            Overschrijving per ongeluk gemarkeerd als betaald? Maak dat hiermee ongedaan.
                        </p>
                        <p v-else class="style-description">
                            Betaling per ongeluk gemarkeerd als betaald? Maak dat hiermee ongedaan.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon undo" />
                                <span>Niet betaald</span>
                            </button><button type="button" class="button icon undo only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="payment.isPending || (payment.isSucceeded && payment.type !== PaymentType.Payment)" :selectable="true" @click="markFailed">
                        <h2 class="style-title-list">
                            Annuleren
                        </h2>
                        <p v-if="payment.type !== PaymentType.Payment" class="style-description">
                            Maak deze transactie ongedaan
                        </p>
                        <p v-else-if="payment.method === 'Transfer'" class="style-description">
                            Annuleer de overschrijving als deze niet op tijd betaald werd.
                        </p>
                        <p v-else class="style-description">
                            Annuleer de betaling als je denkt dat deze niet meer betaald zal worden.
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon canceled" />
                                <span>Annuleren</span>
                            </button><button type="button" class="button icon canceled only-smartphone" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="payment.balanceItemPayments.length">
                <hr>
                <h2>Overzicht</h2>
                <STList>
                    <STListItem v-for="item in sortedItems" :key="item.id">
                        <template #left>
                            <span class="style-amount min-width">
                                <figure class="style-image-with-icon gray">
                                    <figure>
                                        <span class="icon" :class="getBalanceItemTypeIcon(item.balanceItem.type)" />
                                    </figure>
                                    <aside>
                                        <span v-if="item.amount <= 0" class="icon disabled small red" />
                                        <span v-if="item.amount > 1" class="style-bubble primary">
                                            {{ item.amount }}
                                        </span>
                                    </aside>
                                </figure>
                            </span>
                        </template>

                        <p v-if="item.balanceItem.status === BalanceItemStatus.Canceled && item.price <= 0" class="style-title-prefix-list error">
                            <span>Tegoed wegens annulatie</span>
                            <span class="icon disabled small" />
                        </p>
                        <p v-else-if="item.price < 0" class="style-title-prefix-list">
                            <span>Tegoed</span>
                            <span class="icon undo small" />
                        </p>
                        <h3 class="style-title-list">
                            {{ item.itemTitle }}
                        </h3>

                        <p v-if="item.itemDescription" class="style-description-small pre-wrap" v-text="item.itemDescription" />

                        <p class="style-description-small">
                            {{ formatDate(item.balanceItem.createdAt) }}
                        </p>

                        <p v-if="item.amount !== 1" class="style-description-small">
                            {{ formatPrice(item.unitPrice) }}
                        </p>

                        <template #right>
                            <span class="style-price-base" :class="{negative: item.price < 0}">{{ item.price === 0 ? 'Gratis' : formatPrice(item.price) }}</span>
                        </template>
                    </STListItem>
                </STList>

                <PriceBreakdownBox :price-breakdown="[{name: 'Totaal', price: payment.price}]" />
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { GlobalEventBus, STErrorsDefault, STList, STListItem, STNavigationBar, Toast, useAppContext, useAuth, useBackForward, useContext, useErrors, usePlatform } from '@stamhoofd/components';
import { BalanceItemStatus, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentType, PaymentTypeHelper, PermissionLevel, getBalanceItemTypeIcon } from '@stamhoofd/structures';

import { useRequestOwner } from '@stamhoofd/networking';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import PriceBreakdownBox from '../views/PriceBreakdownBox.vue';

const props = withDefaults(
    defineProps<{
        payment: PaymentGeneral;
        getNext?: ((payment: PaymentGeneral) => PaymentGeneral | null) | null;
        getPrevious?: ((payment: PaymentGeneral) => PaymentGeneral | null) | null;
    }>(), {
        getNext: null,
        getPrevious: null,
    },
);

const { hasNext, hasPrevious, goBack, goForward } = useBackForward('payment', props);
const errors = useErrors();
const title = props.payment.title;
const isManualMethod = props.payment.method === PaymentMethod.Transfer || props.payment.method === PaymentMethod.PointOfSale || props.payment.method === PaymentMethod.Unknown;
const auth = useAuth();
const app = useAppContext();
const canWrite = computed(() => app === 'dashboard' && auth.canAccessPayment(props.payment, PermissionLevel.Write));
const VATPercentage = 21; // todo
const context = useContext();
const owner = useRequestOwner();
const markingPaid = ref(false);
const platform = usePlatform();

const sortedItems = computed(() => {
    return props.payment.balanceItemPayments.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byNumberValue(a.price, b.price),
            Sorter.byStringValue(a.itemDescription ?? a.balanceItem.description, b.itemDescription ?? b.balanceItem.description),
        );
    });
});

async function reload() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/payments/${props.payment.id}`,
            decoder: PaymentGeneral as Decoder<PaymentGeneral>,
            owner,
            shouldRetry: true,
        });
        props.payment.deepSet(response.data);
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function markPaid() {
    await mark(PaymentStatus.Succeeded);
}

async function markPending() {
    await mark(PaymentStatus.Pending);
}

async function markFailed() {
    await mark(PaymentStatus.Failed);
}

async function mark(status: PaymentStatus) {
    if (markingPaid.value) {
        return;
    }

    markingPaid.value = true;

    try {
        const data: PatchableArrayAutoEncoder<Payment> = new PatchableArray();
        data.addPatch(Payment.patch({
            id: props.payment.id,
            status,
        }));

        // Create a patch for this payment
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/payments',
            body: data,
            decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
            shouldRetry: false,
        });
        props.payment.deepSet(response.data[0]);
        GlobalEventBus.sendEvent('paymentPatch', props.payment).catch(console.error);
        new Toast('Betaalstatus gewijzigd', 'success').setHide(1000).show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    markingPaid.value = false;
}
</script>
