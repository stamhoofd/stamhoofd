<template>
    <STListItem :selectable="!disabled" :disabled="disabled" element-name="label">
        <template #left>
            <Checkbox v-model="checked" :disabled="disabled" />
        </template>

        <h4 class="style-title-list ">
            {{ member.patchedMember.name }}
        </h4>

        <p v-if="validationError" class="style-description-small">
            {{ validationError }}
        </p>

        <p v-if="validationWarning" class="style-description-small">
            {{ validationWarning }}
        </p>

        <p v-if="checked && registerItem && registerItem.description" class="style-description-small pre-wrap" v-text="registerItem.description" />

        <p v-if="checked && registerItem" class="style-description-small">
            <span class="style-price">{{ formatPrice(registerItem.calculatedPrice) }}</span>
        </p>
        <template #right>
            <button v-if="checked && registerItem?.showItemView" type="button" class="icon edit gray" @click="editRegisterItem" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { Group, Organization, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useCheckoutDefaultItem, useCheckoutRegisterItem } from '../../checkout';

const props = defineProps<{
    group: Group;
    member: PlatformMember,
    groupOrganization: Organization
}>()

const registerItem = computed(() => props.member.family.checkout.cart.getMemberAndGroup(props.member.id, props.group.id) ?? RegisterItem.defaultFor(props.member, props.group, props.groupOrganization))
const validationError = computed(() => registerItem.value.validationError)
const validationWarning = computed(() => registerItem.value.validationWarning)

const disabled = computed(() => {
    return validationError.value !== null
})
const checkoutDefaultItem = useCheckoutDefaultItem();
const checkoutRegisterItem = useCheckoutRegisterItem();

const checked = computed({
    get: () => props.member.family.checkout.cart.containsMemberAndGroup(props.member.id, props.group.id),
    set: (value: boolean) => {
        // todo: add to cart flow
        if (value) {
            checkoutDefaultItem({
                member: props.member, 
                group: props.group,
                groupOrganization: props.groupOrganization,
                startCheckoutFlow: false,
                displayOptions: {action: 'present', modalDisplayStyle: 'popup'}
            }).catch(console.error)
        } else {
            // Remove from cart
            props.member.family.checkout.cart.removeMemberAndGroup(props.member.id, props.group.id)
        }
    }
})

async function editRegisterItem() {
    await checkoutRegisterItem({
        item: registerItem.value,
        startCheckoutFlow: false,
        displayOptions: {action: 'present', modalDisplayStyle: 'popup'}
    })
}

</script>
