<template>
    <STListItem :selectable="!disabled" :disabled="disabled" class="right-stack" @click="toggleRow">
        <template #left>
            <Checkbox v-model="checked" :disabled="disabled" @click.stop />
        </template>

        <h3 class="style-title-list ">
            {{ member.patchedMember.name }}
        </h3>

        <template v-if="app !== 'registration'">
            <p v-if="member.patchedMember.details.birthDay" class="style-description-small">
                {{ formatDate(member.patchedMember.details.birthDay, true) }}
            </p>
            <p class="style-description-small" v-if="!checked">
                {{ member.registrationDescription }}
            </p>
        </template>

        <p v-if="!checked && validationError" class="style-description-small">
            {{ validationError }}
        </p>

        <p v-if="!checked && validationWarning" class="style-description-small">
            {{ validationWarning }}
        </p>

        <p v-if="checked && registerItem && registerItem.description" class="style-description-small pre-wrap" v-text="registerItem.description" />

        <template #right>
            <span v-if="(registerItem?.group.type === GroupType.WaitingList) || (!disabled && validationError)" class="icon tiny clock gray" />
            <button v-if="checked && registerItem?.showItemView" type="button" class="button icon edit gray" @click.stop="editRegisterItem" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import type { Group, Organization, PlatformMember, RegisterCheckout } from '@stamhoofd/structures';
import { GroupType, RegisterItem } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useCheckoutRegisterItem } from '#members/checkout/useCheckoutRegisterItem.ts';
import { useAppContext } from '#context/appContext.ts';

const props = defineProps<{
    group: Group;
    member: PlatformMember;
    groupOrganization: Organization;
    checkout: RegisterCheckout;
}>();

const app = useAppContext();

// We do some caching here to prevent too many calculations on cart changes
const inCartRegisterItem = computed(() => props.member.family.checkout.cart.getMemberAndGroup(props.member.id, props.group.id));
const inCartRegisterWaitingListItem = computed(() => props.group.waitingList ? props.member.family.checkout.cart.getMemberAndGroup(props.member.id, props.group.waitingList.id) : null);

// If the system decides that you should register for the waiting list, we should still show the correct error messages from the original register item
const validateRegisterItem = computed(() => inCartRegisterItem.value ?? RegisterItem.defaultFor(props.member, props.group, props.groupOrganization));

const registerItem = computed(() => {
    if (inCartRegisterItem.value) {
        return inCartRegisterItem.value;
    }
    if (inCartRegisterWaitingListItem.value) {
        return inCartRegisterWaitingListItem.value;
    }

    if (!!validateRegisterItem.value.validationError && !validateRegisterItem.value.validationErrorForWaitingList && !!props.group.waitingList) {
        return RegisterItem.defaultFor(props.member, props.group.waitingList, props.groupOrganization);
    }
    return RegisterItem.defaultFor(props.member, props.group, props.groupOrganization);
});

const validationError = computed(() => inCartRegisterItem.value ? null : (registerItem.value.validationError ?? validateRegisterItem.value.validationError));
const canRegister = computed(() => inCartRegisterItem.value || inCartRegisterWaitingListItem.value ? true : (!registerItem.value.validationError));
const validationWarning = computed(() => validationError.value ? null : registerItem.value.validationWarning);

const disabled = computed(() => {
    return !canRegister.value;
});
const checkoutRegisterItem = useCheckoutRegisterItem();

const checked = computed({
    get: () => !!inCartRegisterItem.value || !!inCartRegisterWaitingListItem.value,
    set: (value: boolean) => {
        if (!value) {
            props.member.family.checkout.removeMemberAndGroup(props.member.id, props.group.id);
            if (props.group.waitingList) {
                props.member.family.checkout.removeMemberAndGroup(props.member.id, props.group.waitingList.id);
            }
        } else {
            const item = registerItem.value;
            if (app === 'registration' || item.validationError) {
                editRegisterItem().catch(console.error);
                return;
            }
            props.checkout.add(item);
        }
    },
});

async function toggleRow() {
    if (checked.value) {
        // Deselect
        checked.value = false;
        return;
    }

    if (disabled.value) {
        return;
    }

    checked.value = true;
}

async function editRegisterItem() {
    if (disabled.value) {
        return;
    }

    await checkoutRegisterItem({
        item: registerItem.value,
        startCheckoutFlow: false,
        displayOptions: { action: 'present', modalDisplayStyle: 'popup' },
    });
}

</script>
