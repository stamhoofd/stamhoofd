<template>
    <SaveView save-text="Bevestigen" main-class="flex" :save-badge="cartLength" :disabled="cartLength === 0" title="Inschrijvingen wijzigen" :loading="saving" @save="goToCheckout">
        <p v-if="!checkout.isAdminFromSameOrganization && checkout.singleOrganization" class="style-title-prefix">
            {{ checkout.singleOrganization.name }}
        </p>
        <h1 v-if="group && isOnlyDeleting">
            Uitschrijven voor {{ group.settings.name }}
        </h1>
        <h1 v-else-if="group">
            Inschrijvingen voor {{ group.settings.name }}
        </h1>
        <h1 v-else>
            Winkelmandje
        </h1>

        <p v-if="checkout.totalPrice && checkout.isAdminFromSameOrganization" class="info-box">
            De kosten zullen aan het openstaande bedrag van elk lid worden toegevoegd. Leden kunnen dit betalen via het ledenportaal.
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <DeleteRegistrationRow v-for="registration in checkout.cart.deleteRegistrations" :key="registration.id" class="right-stack" :registration="registration" :checkout="checkout" />
            <RegisterItemRow v-for="item in checkout.cart.items" :key="item.id" class="right-stack" :item="item" :show-group="false" />
            <BalanceItemCartItemRow v-for="item in checkout.cart.balanceItems" :key="item.id" class="right-stack" :item="item" :checkout="checkout" />
        </STList>

        <p v-if="checkout.cart.isEmpty" class="info-box">
            Voeg de leden toe die je wilt inschrijven
        </p>

        <p v-if="group && !isOnlyDeleting" class="style-button-bar">
            <button type="button" class="button text" @click="searchMembers">
                <span class="icon search" />
                <span>Zoek bestaande leden</span>
            </button>

            <button type="button" class="button text" @click="addMember">
                <span class="icon add" />
                <span>Splinternieuw lid</span>
            </button>
        </p>

        <div v-if="isOnlyDeleting && hasPaidRegistrationDelete" class="container">
            <hr>
            <h2>{{ $t('d37f0355-379d-4128-aafa-fefb201188bc') }}</h2>
            <p>{{ $t('Stamhoofd verwijdert automatisch het reeds aangerekende bedrag van het openstaande bedrag van alle leden die je uitschrijft. Als je wilt kan je wel een annuleringskost in rekening brengen, bv. als je het bedrag niet zal terugbetalen stel je dit in op 100%. Als je geen annuleringskost in rekening brengt, zal het openstaande bedrag van een lid dat al betaald had negatief worden en kan je dit terugbetalen via het tabblad "Rekening" van een lid.') }}</p>

            <p v-if="hadPaidByOrganization" class="info-box">
                {{ $t('b263fa75-5a47-43a6-94a5-95eeac94567f') }}
            </p>

            <STInputBox title="Percentage">
                <PermyriadInput v-model="checkout.cancellationFeePercentage" :min="0" :max="10000" placeholder="0" />
            </STInputBox>
            <p v-if="checkout.cancellationFeePercentage !== 0 && checkout.cancellationFeePercentage !== 10000" class="style-description-small">
                De annuleringskost wordt individueel en rekenkundig afgerond op 1 cent.
            </p>
        </div>

        <PriceBreakdownBox v-if="!checkout.isAdminFromSameOrganization" :price-breakdown="checkout.priceBreakown" />
    </SaveView>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, PermyriadInput, PriceBreakdownBox, STErrorsDefault, useErrors } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Group, Organization, PlatformFamily, PlatformMember, RegisterCheckout } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import { startCheckout, useAddMember, useCheckoutDefaultItem, useChooseGroupForMember } from '.';
import { useContext, useOrganization, usePlatform } from '../hooks';
import { NavigationActions, useNavigationActions } from '../types/NavigationActions';
import BalanceItemCartItemRow from './components/group/BalanceItemCartItemRow.vue';
import DeleteRegistrationRow from './components/group/DeleteRegistrationRow.vue';
import RegisterItemRow from './components/group/RegisterItemRow.vue';
import SearchOrganizationMembersForGroupView from './SearchOrganizationMembersForGroupView.vue';

const props = defineProps<{
    checkout: RegisterCheckout; // we should auto assign this checkout to all search results and newly created members
    group?: Group; // If you want to add new members to the cart
    groupOrganization: Organization;
    members?: PlatformMember[]; // Optional: used to update the members after the checkout
}>();

onMounted(() => {
    // Initially show errors as soon as it is possible
    try {
        props.checkout.validate({});
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
});

const context = useContext();
const contextOrganization = useOrganization();
const platform = usePlatform();
const present = usePresent();
const navigate = useNavigationActions();
const errors = useErrors();
const saving = ref(false);
const cartLength = computed(() => props.checkout.cart.count);
const $addMember = useAddMember();
const checkoutDefaultItem = useCheckoutDefaultItem();
const chooseGroupForMember = useChooseGroupForMember();
const $t = useTranslate();
const isOnlyDeleting = computed(() => props.checkout.cart.items.length === 0 && props.checkout.cart.balanceItems.length === 0 && props.checkout.cart.deleteRegistrations.length > 0);
const hasPaidRegistrationDelete = computed(() => props.checkout.cart.deleteRegistrations.some(r => r.balances.some(b => b.amountOpen > 0 || b.amountPaid > 0 || b.amountPending > 0)));
const hadPaidByOrganization = computed(() => props.checkout.cart.deleteRegistrations.some(r => r.payingOrganizationId && r.balances.some(b => b.amountOpen > 0 || b.amountPaid > 0 || b.amountPending > 0)));

async function addMember() {
    const family = new PlatformFamily({
        contextOrganization: contextOrganization.value,
        platform: platform.value,
    });
    family.checkout = props.checkout;

    await $addMember(family, {
        displayOptions: { action: 'present', modalDisplayStyle: 'popup' },
        async finishHandler(member, navigate) {
            if (!props.group) {
                await chooseGroupForMember({
                    member,
                    displayOptions: { action: 'show', replace: 100, force: true },
                    customNavigate: navigate,
                    startCheckoutFlow: false,
                });
                return;
            }

            await checkoutDefaultItem({
                member,
                group: props.group,
                groupOrganization: props.groupOrganization,
                startCheckoutFlow: false,
                displayOptions: { action: 'show', replace: 100, force: true },
                customNavigate: navigate,
            });
        },
    });
}

async function searchMembers() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(SearchOrganizationMembersForGroupView, {
                    ...props,
                    saveHandler: async (navigate: NavigationActions) => {
                        await navigate.dismiss({ force: true });
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function goToCheckout() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        await startCheckout({
            admin: true,
            checkout: props.checkout,
            context: context.value,
            members: props.members,
            displayOptions: { action: 'show' },
        }, navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
    }
}

const shouldNavigateAway = async () => {
    if (props.checkout.cart.isEmpty) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
