<template>
    <SaveView :save-text="checkout.isAdminFromSameOrganization ? $t('%X9') : $t('%16p')" main-class="flex" :save-badge="cartLength" :disabled="cartLength === 0" :loading="saving" :title="$t(`%du`)" @save="goToCheckout">
        <p v-if="!checkout.isAdminFromSameOrganization && checkout.singleOrganization" class="style-title-prefix">
            {{ checkout.singleOrganization.name }}
        </p>
        <h1 v-if="group && isOnlyDeleting">
            {{ $t('%dm') }} {{ group.settings.name }}
        </h1>
        <h1 v-else-if="group">
            {{ $t('%dn') }} {{ group.settings.name }}
        </h1>
        <h1 v-else>
            {{ $t('%1DQ') }}
        </h1>

        <p v-if="checkout.totalPrice && checkout.isAdminFromSameOrganization" class="info-box">
            {{ $t('%do') }}
        </p>

        <p v-if="checkout.totalPrice && contextOrganization && checkout.asOrganizationId && !checkout.isAdminFromSameOrganization && checkout.cart.items.length" class="warning-box">
            {{ $t('%dp', {organization: contextOrganization.name}) }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <SendConfirmationEmailBox v-if="checkout.cart.items.length" :checkout="checkout" :group="group" :group-organization="props.groupOrganization" :validator="errors.validator" />

        <STList>
            <DeleteRegistrationRow v-for="registration in checkout.cart.deleteRegistrations" :key="registration.registration.id" class="right-stack" :registration="registration" :checkout="checkout" />
            <RegisterItemRow v-for="item in checkout.cart.items" :key="item.id" class="right-stack" :item="item" :show-group="false" />
            <BalanceItemCartItemRow v-for="item in checkout.cart.balanceItems" :key="item.id" class="right-stack" :item="item" :checkout="checkout" />
        </STList>

        <p v-if="checkout.cart.isEmpty" class="info-box">
            {{ $t('%dq') }}
        </p>

        <p v-if="group && !isOnlyDeleting" class="style-button-bar">
            <button type="button" class="button text" @click="searchMembers">
                <span class="icon search" />
                <span>{{ $t('%dr') }}</span>
            </button>

            <button type="button" class="button text" @click="addMember">
                <span class="icon add" />
                <span>{{ $t('%ds') }}</span>
            </button>
        </p>

        <div v-if="isOnlyDeleting && hasPaidRegistrationDelete" class="container">
            <hr><h2>{{ $t('%8q') }}</h2>
            <p>{{ $t('%8x') }}</p>

            <p v-if="hadPaidByOrganization" class="info-box">
                {{ $t('%8r') }}
            </p>

            <STInputBox :title="$t(`%2I`)">
                <PermyriadInput v-model="checkout.cancellationFeePercentage" :min="0" :max="10000" :placeholder="$t(`%L`)" />
            </STInputBox>
            <p v-if="checkout.cancellationFeePercentage !== 0 && checkout.cancellationFeePercentage !== 10000" class="style-description-small">
                {{ $t('%dt') }}
            </p>
        </div>

        <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />
    </SaveView>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import PermyriadInput from '#inputs/PermyriadInput.vue';
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { Toast } from '#overlays/Toast.ts';
import { useErrors } from '#errors/useErrors.ts';
import type { Group, Organization, PlatformMember, RegisterCheckout } from '@stamhoofd/structures';
import { PlatformFamily } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import { startCheckout, useAddMember, useCheckoutRegisterItem, useChooseGroupForMember, useEditMember, useGetDefaultItem } from '.';
import { useContext, useOrganization, usePlatform } from '../hooks';
import type { NavigationActions} from '../types/NavigationActions';
import { useNavigationActions } from '../types/NavigationActions';
import BalanceItemCartItemRow from './components/group/BalanceItemCartItemRow.vue';
import DeleteRegistrationRow from './components/group/DeleteRegistrationRow.vue';
import RegisterItemRow from './components/group/RegisterItemRow.vue';
import SearchOrganizationMembersForGroupView from './SearchOrganizationMembersForGroupView.vue';
import SendConfirmationEmailBox from './SendConfirmationEmailBox.vue';

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
    props.checkout.cart.calculatePrices();
});

const context = useContext();
const contextOrganization = useOrganization();
const platform = usePlatform();
const present = usePresent();
const navigate = useNavigationActions();
const errors = useErrors();
const saving = ref(false);
const cartLength = computed(() => props.checkout.cart.count);
const doAddMember = useAddMember();
const editMember = useEditMember();
const checkoutRegisterItem = useCheckoutRegisterItem();
const getDefaultItem = useGetDefaultItem();
const chooseGroupForMember = useChooseGroupForMember();

const isOnlyDeleting = computed(() => props.checkout.cart.items.length === 0 && props.checkout.cart.balanceItems.length === 0 && props.checkout.cart.deleteRegistrations.length > 0);
const hasPaidRegistrationDelete = computed(() => props.checkout.cart.deleteRegistrations.some(r => r.registration.balances.some(b => b.amountOpen > 0 || b.amountPaid > 0 || b.amountPending > 0)));
const hadPaidByOrganization = computed(() => props.checkout.cart.deleteRegistrations.some(r => r.registration.payingOrganizationId && r.registration.balances.some(b => b.amountOpen > 0 || b.amountPaid > 0 || b.amountPending > 0)));

async function addMember() {
    const family = new PlatformFamily({
        contextOrganization: contextOrganization.value,
        platform: platform.value,
    });
    family._isSingle = true;
    family.checkout = props.checkout;

    await doAddMember(family, {
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

            const item = await getDefaultItem({
                member,
                group: props.group,
            });

            if (!item) {
                // Something went wrong (toast already shown in getDefaultItem)
                return;
            }

            const isExistingMember = member.patchedMember.details.oldIds.length > 0;

            if (isExistingMember) {
                Toast.warning($t(`%16q`, { name: member.patchedMember.name })).show();
            }

            // Make sure record questions for this item are included in the edit dialog;
            member.family.pendingRegisterItems = [item];

            // First ask the user to complete or verify the member details
            await editMember(member, {
                title: !isExistingMember ? $t('%16n') : $t('%16o'),
                saveText: $t('%16p'),

                // We'll replace the previous steps, you can't go back to the previous step
                displayOptions: { action: 'show', replace: 100, force: true },
                navigate,
                finishHandler: async (navigate: NavigationActions) => {
                    await checkoutRegisterItem({
                        item,
                        startCheckoutFlow: false,

                        // Here you'll still be able to go back
                        displayOptions: { action: 'show' },
                        customNavigate: navigate,
                    });
                },
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
        const ok = await errors.validator.validate();
        if (!ok) {
            saving.value = false;
            return; // Errors, don't continue
        }
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
