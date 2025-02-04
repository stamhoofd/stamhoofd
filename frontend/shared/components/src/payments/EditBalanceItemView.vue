<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-balance-item-view" :loading="loading" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="!hasPayments(patchedBalanceItem)" class="warning-box">
            Een afrekening (= de schuld) wijzigen die al gebruikt werd in een aangemaakte betaling (= hoe de schuld betaald werd) zal enkel het openstaande bedrag wijzigen. Een betaling is niet meer aanpasbaar na het aanmaken ervan. Indien je het bedrag van een betaling wilt wijzigen moet je ofwel een extra betaling aanmaken voor het verschil of de betaling annuleren en opnieuw aanmaken.
        </p>

        <div class="split-inputs">
            <div>
                <STInputBox title="Beschrijving" error-fields="description" :error-box="errors.errorBox">
                    <input
                        ref="firstInput"
                        v-model="description"
                        class="input"
                        type="text"
                        placeholder="Bv. Aankoop T-shirt"
                        autocomplete=""
                        :disabled="!!balanceItem.relations.size"
                    >
                </STInputBox>
                <p v-if="balanceItem.relations.size" class="style-description-small">
                    Dit is een verschuldigd bedrag dat automatisch werd aangemaakt door {{ platform.config.name }}
                </p>
            </div>
            <div>
                <STInputBox title="Verschuldigd sinds" error-fields="createdAt" :error-box="errors.errorBox">
                    <DateSelection v-model="createdAt" />
                </STInputBox>
            </div>
        </div>

        <div class="split-inputs">
            <STInputBox title="Eenheidsprijs" error-fields="unitPrice" :error-box="errors.errorBox">
                <PriceInput v-model="unitPrice" placeholder="Gratis" :min="null" />
            </STInputBox>

            <STInputBox title="Aantal" error-fields="amount" :error-box="errors.errorBox">
                <NumberInput v-model="amount" placeholder="1" :min="Math.min(1, balanceItem.amount)" :stepper="true" />
            </STInputBox>
        </div>
        <template v-if="$feature('member-trials') && (patchedBalanceItem.price >= 0 || dueAt !== null)">
            <STInputBox title="Te betalen tegen*" error-fields="dueAt" :error-box="errors.errorBox">
                <DateSelection v-model="dueAt" :required="false" placeholder="Onmiddelijk" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>
            <p class="style-description-small">
                {{ $t('*Je kan een openstaand bedrag uitstellen - bv. voor gespreid betalen of een proefperiode. Het verschijnt pas als snelle actie in het ledenportaal vanaf één week voor deze datum (samen met een eventuele automatische e-mail) en moet betaald zijn tegen de ingevulde datum. Het is mogelijk om het al vroeger te betalen, maar zeker niet verplicht.') }}
            </p>
        </template>
        <PriceBreakdownBox :price-breakdown="patchedBalanceItem.priceBreakown" />

        <template v-if="family && family.members.length >= (originalMemberId ? 2 : 1)">
            <hr>
            <h2>Lid</h2>
            <p>Selecteer welk lid het bedrag verschuldigd is.</p>

            <p v-if="!memberId" class="warning-box">
                Je koppelt een verschuldigd bedrag best aan een lid en niet aan een account. Dan kan iedereen binnen het gezin het openstaande bedrag betalen.
            </p>

            <STList>
                <STListItem v-for="m in family.members" :key="m.id" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="memberId" :value="m.id" />
                    </template>

                    <h3 class="style-title-list">
                        {{ m.patchedMember.name }}
                    </h3>
                </STListItem>

                <STListItem v-if="user" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="memberId" :value="null" />
                    </template>

                    <h3 class="style-title-list">
                        {{ user.name }} ({{ user.email }})
                    </h3>
                    <p class="style-description-small">
                        Enkel koppelen aan account, niet aan lid
                    </p>
                </STListItem>
            </STList>
        </template>

        <template v-if="!isNew && hasPayments(patchedBalanceItem)">
            <hr>
            <h2>Betalingen</h2>
            <p>Een openstaand bedrag kan door een lid betaald worden via het ledenportaal. Daar kan men via één van de ingestelde betaalmethodes afrekenen. Meerdere openstaande bedragen (ook over meerdere leden heen als een account meerdere leden beheert) kunnen in één keer betaald worden, vandaar dat het bedrag van een betaling vaak hoger is dan het bedrag van een individuele afrekening.</p>

            <p v-if="patchedBalanceItem.payments.length === 0" class="info-box">
                Er werd nog geen betaling aangemaakt voor deze afrekening
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of sortedPayments" :key="payment.id" :payment="payment.payment" :payments="patchedBalanceItem.payments.map(b => b.payment)" :price="payment.payment.isFailed ? 0 : payment.price" />
            </STList>

            <template v-if="outstanding.pending === 0 && outstanding.paid === 0">
                <hr>
                <h2>Acties</h2>

                <STList>
                    <STListItem :selectable="true" @click="doDelete">
                        <h2 class="style-title-list">
                            Verwijder deze aanrekening
                        </h2>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash" />
                                <span>Verwijderen</span>
                            </button>
                            <button type="button" class="button icon trash only-smartphone" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, NumberInput, PriceBreakdownBox, PriceInput, useContext, useErrors, useOrganization, usePatch, usePlatform, usePlatformFamilyManager } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItem, BalanceItemStatus, BalanceItemWithPayments, PlatformFamily, UserWithMembers } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import PaymentRow from './components/PaymentRow.vue';

const props = defineProps<{
    balanceItem: BalanceItemWithPayments | BalanceItem;
    isNew: boolean;
    saveHandler: ((patch: AutoEncoderPatchType<BalanceItem>) => Promise<void>);
}>();

const { hasChanges, addPatch, patch, patched: patchedBalanceItem } = usePatch(props.balanceItem);
const family = ref(null) as Ref<PlatformFamily | null>;
const platformFamilyManager = usePlatformFamilyManager();
const organization = useOrganization();
const platform = usePlatform();
const loading = ref(false);
const errors = useErrors();
const pop = usePop();
const context = useContext();
const owner = useRequestOwner();

// Load mmeber on load
loadMember().catch(console.error);
loadFamilyFromUser().catch(console.error);

const title = computed(() => {
    if (patchedBalanceItem.value.price < 0) {
        return props.isNew ? 'Terug te betalen bedrag toevoegen' : 'Terug te betalen bedrag bewerken';
    }
    return props.isNew ? 'Verschuldigd bedrag toevoegen' : 'Verschuldigd bedrag bewerken';
});

const sortedPayments = computed(() => {
    if (!hasPayments(patchedBalanceItem.value)) {
        return [];
    }
    return patchedBalanceItem.value.payments.slice().sort((a, b) => Sorter.byDateValue(a.payment.paidAt ?? a.payment.createdAt, b.payment.paidAt ?? b.payment.createdAt));
});

const description = computed({
    get: () => patchedBalanceItem.value.description,
    set: value => addPatch({ description: value }),
});

const unitPrice = computed({
    get: () => patchedBalanceItem.value.unitPrice,
    set: value => addPatch({ unitPrice: value }),
});

const amount = computed({
    get: () => patchedBalanceItem.value.amount,
    set: value => addPatch({ amount: value }),
});

const createdAt = computed({
    get: () => patchedBalanceItem.value.createdAt,
    set: value => addPatch({ createdAt: value }),
});

const dueAt = computed({
    get: () => patchedBalanceItem.value.dueAt,
    set: value => addPatch({ dueAt: value }),
});

const memberId = computed({
    get: () => patchedBalanceItem.value.memberId,
    set: value => addPatch({ memberId: value }),
});

const originalMemberId = computed(
    () => props.balanceItem.memberId,
);

const user = ref(null) as Ref<UserWithMembers | null>;

const outstanding = computed(() => {
    const paid = patchedBalanceItem.value.pricePaid;
    const pending = patchedBalanceItem.value.pricePending;
    const remaining = patchedBalanceItem.value.price - paid - pending;

    return {
        paid,
        pending,
        remaining,
    };
});

function hasPayments(balanceItem: BalanceItemWithPayments | BalanceItem): balanceItem is BalanceItemWithPayments {
    return (balanceItem instanceof BalanceItemWithPayments);
}

async function save() {
    if (loading.value) {
        return;
    }
    errors.errorBox = null;
    loading.value = true;

    try {
        const valid = await errors.validator.validate();
        if (!valid) {
            loading.value = false;
            return;
        }
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function doDelete() {
    if (loading.value) {
        return;
    }
    if (!(await CenteredMessage.confirm('Deze aanrekening verwijderen?', 'Verwijderen', 'Je kan dit niet ongedaan maken.'))) {
        return;
    }
    if (loading.value) {
        return;
    }

    errors.errorBox = null;

    try {
        loading.value = true;
        await props.saveHandler(BalanceItemWithPayments.patch({
            status: BalanceItemStatus.Hidden,
            price: 0,
        }));
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function loadMember() {
    if (!props.balanceItem.memberId) {
        return;
    }
    try {
        const familyBlob = await platformFamilyManager.loadFamilyBlob(props.balanceItem.memberId);
        family.value = PlatformFamily.create(familyBlob, {
            contextOrganization: organization.value,
            platform: platform.value,
        });
    }
    catch (e) {
        console.error(e);
        return;
    }
}

async function loadFamilyFromUser() {
    if (!props.balanceItem.userId) {
        return;
    }
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/user/' + props.balanceItem.userId,
            decoder: UserWithMembers as Decoder<UserWithMembers>,
            owner,
        });

        const blob = response.data.members;
        blob.markReceivedFromBackend();

        user.value = response.data;
        family.value = PlatformFamily.create(blob, {
            contextOrganization: organization.value,
            platform: platform.value,
        });
    }
    catch (e) {
        console.error(e);
        return;
    }
}
</script>
