<template>
    <SaveView :save-text="checkout.isAdminFromSameOrganization ? $t('7de2e636-dcec-44b1-a681-daeb9cd85316') : $t('a2ca0160-2d94-45f8-a96a-3e02a43b17d8')" main-class="flex" :save-badge="cartLength" :disabled="cartLength === 0" :loading="saving" :title="$t(`809b158a-2a1f-459f-a60c-4ae5c69fbe8e`)" @save="goToCheckout">
        <p v-if="!checkout.isAdminFromSameOrganization && checkout.singleOrganization" class="style-title-prefix">
            {{ checkout.singleOrganization.name }}
        </p>
        <h1 v-if="group && isOnlyDeleting">
            {{ $t('3b62fa55-becc-4ffb-b15d-f64528033953') }} {{ group.settings.name }}
        </h1>
        <h1 v-else-if="group">
            {{ $t('f640fb74-eee1-43cf-8b28-0c6ff17da4d2') }} {{ group.settings.name }}
        </h1>
        <h1 v-else>
            {{ $t('5e2654f2-6423-47bc-b7e7-054e41bf287f') }}
        </h1>

        <p v-if="checkout.totalPrice && checkout.isAdminFromSameOrganization" class="info-box">
            {{ $t('8fa09d5b-957e-49c0-b02f-2aca8e17eb24') }}
        </p>

        <p v-if="checkout.totalPrice && contextOrganization && checkout.asOrganizationId && !checkout.isAdminFromSameOrganization && checkout.cart.items.length" class="warning-box">
            {{ $t('0696b0bc-d2e2-4dc5-88d3-7ee188953cdf', {organization: contextOrganization.name}) }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <SendConfirmationEmailBox v-if="checkout.cart.items.length" :checkout="checkout" :group="group" :group-organization="props.groupOrganization" :validator="errors.validator" />

        <STList>
            <DeleteRegistrationRow v-for="registration in checkout.cart.deleteRegistrations" :key="registration.registration.id" class="right-stack" :registration="registration" :checkout="checkout" />
            <RegisterItemRow v-for="item in checkout.cart.items" :key="item.id" class="right-stack" :item="item" :show-group="false" />
            <BalanceItemCartItemRow v-for="item in checkout.cart.balanceItems" :key="item.id" class="right-stack" :item="item" :checkout="checkout" />
        </STList>

        <p v-if="checkout.cart.isEmpty" class="info-box">
            {{ $t('7a4b32f3-2459-4dde-aad7-12a9e1349ae0') }}
        </p>

        <p v-if="group && !isOnlyDeleting" class="style-button-bar">
            <button type="button" class="button text" @click="searchMembers">
                <span class="icon search" />
                <span>{{ $t('9ef4a12d-ad85-4ee4-8604-c8a07d4e37f3') }}</span>
            </button>

            <button type="button" class="button text" @click="addMember">
                <span class="icon add" />
                <span>{{ $t('ea4f66eb-cabd-466d-80a6-a7019d8137dc') }}</span>
            </button>
        </p>

        <div v-if="isOnlyDeleting && hasPaidRegistrationDelete" class="container">
            <hr><h2>{{ $t('d37f0355-379d-4128-aafa-fefb201188bc') }}</h2>
            <p>{{ $t('11ffdf3a-dd66-49ec-b092-c7f3063e19f3') }}</p>

            <p v-if="hadPaidByOrganization" class="info-box">
                {{ $t('b263fa75-5a47-43a6-94a5-95eeac94567f') }}
            </p>

            <STInputBox :title="$t(`dd61d33b-367e-4e40-8ac6-84c286b931bc`)">
                <PermyriadInput v-model="checkout.cancellationFeePercentage" :min="0" :max="10000" :placeholder="$t(`085e5b60-8c26-49b2-bba3-04dd38b3a891`)" />
            </STInputBox>
            <p v-if="checkout.cancellationFeePercentage !== 0 && checkout.cancellationFeePercentage !== 10000" class="style-description-small">
                {{ $t('13978903-0724-4935-a004-b9dbd4fe1ab1') }}
            </p>
        </div>

        <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />
    </SaveView>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, PermyriadInput, PriceBreakdownBox, STErrorsDefault, Toast, useErrors } from '@stamhoofd/components';
import { Group, Organization, PlatformFamily, PlatformMember, RegisterCheckout } from '@stamhoofd/structures';
import { computed, onBeforeMount, onMounted, ref } from 'vue';
import { startCheckout, useAddMember, useCheckoutRegisterItem, useChooseGroupForMember, useEditMember, useGetDefaultItem, usePlatformFamilyManager } from '.';
import { useContext, useOrganization, usePlatform } from '../hooks';
import { NavigationActions, useNavigationActions } from '../types/NavigationActions';
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
    updateCheckout();
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
const platformFamilyManager = usePlatformFamilyManager();

function updateCheckout() {
    // Initially show errors as soon as it is possible
    try {
        props.checkout.validate({});
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    props.checkout.cart.calculatePrices();
}

onBeforeMount(async () => {
    console.error('start save...');
    if (await platformFamilyManager.forceUpdateUitpasSocialTarrif(props.members ?? [])) {
        console.error('start update checkout...');
        updateCheckout();
    }
});

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
                Toast.warning($t(`eb3037bc-a195-41a8-ad30-947dce3ed73c`, { name: member.patchedMember.name })).show();
            }

            // Make sure record questions for this item are included in the edit dialog;
            member.family.pendingRegisterItems = [item];

            // First ask the user to complete or verify the member details
            await editMember(member, {
                title: !isExistingMember ? $t('2a44031f-dfa5-45df-824e-ba107d311c13') : $t('733d4169-a86f-425e-bb4b-15ce3af5aa60'),
                saveText: $t('2a9075bb-a743-411e-8a3d-94e5e57363f0'),

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
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
