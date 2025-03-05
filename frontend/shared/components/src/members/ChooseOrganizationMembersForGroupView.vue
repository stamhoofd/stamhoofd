<template>
    <SaveView save-text="Bevestigen" main-class="flex" :save-badge="cartLength" :disabled="cartLength === 0" :loading="saving" @save="goToCheckout" :title="$t(`ba23721b-4eb8-4c38-b95f-8829479973ca`)">
        <p v-if="!checkout.isAdminFromSameOrganization && checkout.singleOrganization" class="style-title-prefix">
            {{ checkout.singleOrganization.name }}
        </p>
        <h1 v-if="group && isOnlyDeleting">
            {{ $t('663f97bb-c34e-4673-8fdc-474922dd2033') }} {{ group.settings.name }}
        </h1>
        <h1 v-else-if="group">
            {{ $t('368c9314-4334-45d9-9f13-9db03372756d') }} {{ group.settings.name }}
        </h1>
        <h1 v-else>
            {{ $t('608dd4a9-dbba-4c2b-818b-5e32296e7289') }}
        </h1>

        <p v-if="checkout.totalPrice && checkout.isAdminFromSameOrganization" class="info-box">
            {{ $t('5df0d7aa-2d2e-4d51-8a70-7ee8f044d218') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STList>
            <DeleteRegistrationRow v-for="registration in checkout.cart.deleteRegistrations" :key="registration.id" class="right-stack" :registration="registration" :checkout="checkout"/>
            <RegisterItemRow v-for="item in checkout.cart.items" :key="item.id" class="right-stack" :item="item" :show-group="false"/>
            <BalanceItemCartItemRow v-for="item in checkout.cart.balanceItems" :key="item.id" class="right-stack" :item="item" :checkout="checkout"/>
        </STList>

        <p v-if="checkout.cart.isEmpty" class="info-box">
            {{ $t('69025a70-7e4d-4146-ba23-0324ac08dfb2') }}
        </p>

        <p v-if="group && !isOnlyDeleting" class="style-button-bar">
            <button type="button" class="button text" @click="searchMembers">
                <span class="icon search"/>
                <span>{{ $t('6ba20cc7-ee92-4094-9cb1-500636c1a36f') }}</span>
            </button>

            <button type="button" class="button text" @click="addMember">
                <span class="icon add"/>
                <span>{{ $t('c47cf8aa-5e7f-4201-95ed-2624704899bf') }}</span>
            </button>
        </p>

        <div v-if="isOnlyDeleting && hasPaidRegistrationDelete" class="container">
            <hr><h2>{{ $t('d37f0355-379d-4128-aafa-fefb201188bc') }}</h2>
            <p>{{ $t('11ffdf3a-dd66-49ec-b092-c7f3063e19f3') }}</p>

            <p v-if="hadPaidByOrganization" class="info-box">
                {{ $t('b263fa75-5a47-43a6-94a5-95eeac94567f') }}
            </p>

            <STInputBox :title="$t(`2041e6a0-2f90-485e-8144-4169e0f7ff31`)">
                <PermyriadInput v-model="checkout.cancellationFeePercentage" :min="0" :max="10000" :placeholder="$t(`f50cad66-b063-4336-b4ac-e2877d3f7e75`)"/>
            </STInputBox>
            <p v-if="checkout.cancellationFeePercentage !== 0 && checkout.cancellationFeePercentage !== 10000" class="style-description-small">
                {{ $t('13efcde2-2ac5-4cc9-b7ae-47c1adbc2046') }}
            </p>
        </div>

        <PriceBreakdownBox v-if="!checkout.isAdminFromSameOrganization" :price-breakdown="checkout.priceBreakown"/>
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
