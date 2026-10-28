<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :title="title" data-testid="customer-step" @save="goNext">
        <h1 class="larger">
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-if="showContactPersonList" class="customer-selection-list" data-testid="main-customer-list">
            <template v-for="item of itemsWithCustomer" :key="item.id">
                <STListItem :selectable="true" element-name="label" class="left-center" :class="{ 'no-border': selectedItemId === item.id && asksDetails }">
                    <template #left>
                        <Radio :model-value="selectedItemId" :value="item.id" name="main-customer" @update:model-value="selectItemCustomer(item)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ item.customer!.name }}
                    </h3>
                    <p v-if="item.customer!.email" class="style-description-small">
                        {{ item.customer!.email }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ item.product.name }}
                    </p>
                </STListItem>
                <div v-if="selectedItemId === item.id && asksDetails" class="contact-person-details">
                    <STCard>
                        <CustomerDetailsInputs v-bind="detailsProps" />
                    </STCard>
                </div>
            </template>
            <STListItem :selectable="true" element-name="label" class="left-center" :class="{ 'no-border': selectedItemId === '' && asksDetails }">
                <template #left>
                    <Radio :model-value="selectedItemId" value="" name="main-customer" @update:model-value="selectOtherCustomer" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%a0G') }}
                </h3>
            </STListItem>
            <div v-if="selectedItemId === '' && asksDetails" class="contact-person-details">
                <STCard>
                    <CustomerDetailsInputs v-bind="detailsProps" />
                </STCard>
            </div>
        </STList>

        <CustomerDetailsInputs v-else v-bind="detailsProps" />
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STCard from '@stamhoofd/components/layout/STCard.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { CartItem } from '@stamhoofd/structures';
import { Checkout, WebshopTicketType } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { customerFieldKeys } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { computed, ref } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useCheckoutContinue } from '../../composables/useCheckoutContinue';
import { useWebshopManager } from '../../composables/useWebshopManager';
import CustomerDetailsInputs from './CustomerDetailsInputs.vue';

const props = defineProps<{
    continueCheckout: (navigate: NavigationActions) => Promise<void>;
}>();

const loading = ref(false);
const errors = useErrors();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const context = useContext();
const webshop = computed(() => webshopManager.webshop);
const navigationActions = useNavigationActions();
const isLoggedIn = computed(() => context.value.isComplete() ?? false);

const title = computed(() => {
    if (showContactPersonList.value) {
        return $t('%1Kl');
    }
    return $t('%uE');
});

// When a delivery method is chosen, its address is already collected in a separate step
// and stored on the customer, so we don't ask for the address a second time.
const hasDeliveryAddress = computed(() => checkoutManager.checkout.deliveryMethod !== null);

const fieldSettings = computed((): CustomerSettings => {
    const settings = webshop.value.meta.customerSettings;
    const patched = settings.patch({
        // A logged in user's name and email address come from their account, unless the account has no name yet
        name: isLoggedIn.value && context.value.user?.firstName && context.value.user.lastName ? CustomerFieldRequirement.Disabled : settings.name,
        email: isLoggedIn.value ? CustomerFieldRequirement.Disabled : settings.email,
        // The delivery address is collected in its own step
        address: hasDeliveryAddress.value ? CustomerFieldRequirement.Disabled : settings.address,
    });
    // Details already collected for the selected participant are copied, not asked again
    for (const key of checkoutManager.checkout.customerFieldsFromCartItem) {
        patched[key] = CustomerFieldRequirement.Disabled;
    }
    return patched;
});

const emailPlaceholder = computed(() => {
    if (webshop.value.meta.ticketType !== WebshopTicketType.None) {
        return $t('%1Dk');
    }
    return $t('%1Dl');
});

const emailDescription = computed(() => {
    if (webshop.value.meta.ticketType !== WebshopTicketType.None) {
        return $t('%1Dm');
    }
    return null;
});

const detailsProps = computed(() => ({
    settings: fieldSettings.value,
    errorBox: errors.errorBox,
    validator: errors.validator,
    emailPlaceholder: emailPlaceholder.value,
    emailDescription: emailDescription.value,
}));

// Nothing left to fill in when the chosen participant already provided everything the order asks
const asksDetails = computed(() => {
    const meta = webshop.value.meta;
    return customerFieldKeys.some(key => fieldSettings.value[key] !== CustomerFieldRequirement.Disabled)
        || (meta.customerSettings.recordCategory?.isEnabled(checkoutManager.checkout) ?? false)
        || meta.customFields.length > 0;
});

const itemsWithCustomer = computed(() => checkoutManager.checkout.contactPersonCandidates);
// The only participant became the contact person without asking: there is nobody to choose between
const isAutomaticContactPerson = computed(() => {
    const [onlyCandidate] = itemsWithCustomer.value;
    return itemsWithCustomer.value.length === 1 && onlyCandidate.id === checkoutManager.checkout.customerCartItemId && Checkout.canBeAutomaticContactPerson(onlyCandidate);
});
const showContactPersonList = computed(() => itemsWithCustomer.value.length > 0 && !isAutomaticContactPerson.value && !isLoggedIn.value);
const selectedItemId = computed(() => checkoutManager.checkout.customerCartItem?.id ?? '');

// The participant may have been edited or removed since the selection was made
checkoutManager.checkout.syncCustomerFromCartItem();

// A logged in user is the contact person: their account fills in the details
if (isLoggedIn.value) {
    checkoutManager.checkout.forgetContactPerson();
} else {
    checkoutManager.checkout.selectDefaultContactPerson();
}
checkoutManager.saveCheckout();

function selectItemCustomer(item: CartItem) {
    checkoutManager.checkout.setContactPerson(item.id);
    checkoutManager.saveCheckout();
}

function selectOtherCustomer() {
    checkoutManager.checkout.setContactPerson(null);
    checkoutManager.saveCheckout();
}

useCheckoutContinue(goNext);

async function goNext() {
    if (loading.value) {
        return;
    }

    // Inputs may throw their validation error instead of returning false
    try {
        if (!await errors.validator.validate()) {
            return;
        }
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
        return;
    }
    loading.value = true;
    errors.errorBox = null;

    try {
        await props.continueCheckout(navigationActions);
    } catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>

<style lang="scss" scoped>
// Lines up with the text of the list items, after the radio button
.contact-person-details {
    padding: 0 var(--st-horizontal-padding, 15px) 15px calc(var(--st-horizontal-padding, 15px) + 33px);
}
</style>
