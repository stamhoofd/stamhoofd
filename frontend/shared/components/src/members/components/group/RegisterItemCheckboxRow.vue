<template>
    <STListItem :selectable="!disabled" :disabled="disabled" class="right-stack" @click="editRegisterItem">
        <template #left>
            <Checkbox v-model="checked" :disabled="disabled" @click.stop />
        </template>

        <h3 class="style-title-list ">
            {{ member.patchedMember.name }}
        </h3>

        <p v-if="validationError" class="style-description-small">
            {{ validationError }}
        </p>

        <p v-if="validationWarning" class="style-description-small">
            {{ validationWarning }}
        </p>

        <p v-if="checked && registerItem && registerItem.description" class="style-description-small pre-wrap" v-text="registerItem.description" />
        <template #right>
            <span v-if="(checked && registerItem?.group.type === GroupType.WaitingList) || (!disabled && validationError)" class="icon clock gray" />
            <span v-if="checked && registerItem?.showItemView" class="button icon edit gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { Group, GroupType, Organization, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useCheckoutRegisterItem } from '../../checkout';

const props = defineProps<{
    group: Group;
    member: PlatformMember,
    groupOrganization: Organization
}>()

// We do some caching here to prevent too many calculations on cart changes
const inCartRegisterItem = computed(() => props.member.family.checkout.cart.getMemberAndGroup(props.member.id, props.group.id))
const inCartRegisterWaitingListItem = computed(() => props.group.waitingList ? props.member.family.checkout.cart.getMemberAndGroup(props.member.id, props.group.waitingList.id) : null)

// If the system decides that you should register for the waiting list, we should still show the correct error messages from the original register item
const validateRegisterItem = computed(() => inCartRegisterItem.value ?? RegisterItem.defaultFor(props.member, props.group, props.groupOrganization))

const registerItem = computed(() => {
    if (inCartRegisterItem.value) {
        return inCartRegisterItem.value
    }
    if (inCartRegisterWaitingListItem.value) {
        return inCartRegisterWaitingListItem.value
    }

    if (!!validationError.value && canRegister.value && !!props.group.waitingList) {
        return RegisterItem.defaultFor(props.member, props.group.waitingList, props.groupOrganization)
    }
    return RegisterItem.defaultFor(props.member, props.group, props.groupOrganization)
})

const validationError = computed(() => inCartRegisterItem.value ? null : validateRegisterItem.value.validationError)
const canRegister = computed(() => inCartRegisterItem.value || inCartRegisterWaitingListItem.value ? true : !validateRegisterItem.value.validationErrorWithoutWaitingList)
const validationWarning = computed(() => validationError.value ? null : validateRegisterItem.value.validationWarning)

const disabled = computed(() => {
    return !canRegister.value
})
const checkoutRegisterItem = useCheckoutRegisterItem();

const checked = computed({
    get: () => !!inCartRegisterItem.value || !!inCartRegisterWaitingListItem.value,
    set: (value: boolean) => {
        if (!value) {
            props.member.family.checkout.removeMemberAndGroup(props.member.id, props.group.id)
            if (props.group.waitingList) {
                props.member.family.checkout.removeMemberAndGroup(props.member.id, props.group.waitingList.id)
            }
        } else {
            editRegisterItem().catch(console.error)
        }
    }
})


async function editRegisterItem() {
    if (checked.value && !registerItem.value?.showItemView) {
        // Deselect
        checked.value = false
        return;
    }

    await checkoutRegisterItem({
        item: registerItem.value,
        startCheckoutFlow: false,
        displayOptions: {action: 'present', modalDisplayStyle: 'popup'}
    })
}

</script>
