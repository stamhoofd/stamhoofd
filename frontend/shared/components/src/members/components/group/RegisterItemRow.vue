<template>
    <STListItem class="right-stack" :selectable="canEdit" @click="canEdit ? editMe() : undefined">
        <template v-if="showGroup" #left>
            <GroupIcon :group="item.group" :icon="item.replaceRegistrations.length ? 'sync' : ''" />
        </template>

        <h3 class="style-title-list">
            <span>{{ item.member.patchedMember.name }}</span>
        </h3>

        <p v-if="!item.organization" class="style-description">
            {{ item.organization }}
        </p>
        <p v-if="showGroup" class="style-description">
            Inschrijven voor {{ item.group.settings.name }}
        </p>
        <p v-if="item.description" class="style-description-small pre-wrap" v-text="item.description" />
        
        <footer>
            <p class="style-price">
                {{ formatPrice(item.calculatedPrice) }}
            </p>
        </footer>

        <template #right>
            <button class="button icon trash gray" type="button" @click.stop="deleteMe()" />
            <button v-if="canEdit" class="button icon edit gray" type="button"  />
        </template>
    </STListItem>
</template>


<script setup lang="ts">
import { RegisterItem } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useCheckoutRegisterItem } from '../../checkout';
import GroupIcon from './GroupIcon.vue';

const props = withDefaults(
    defineProps<{
        item: RegisterItem;
        showGroup: boolean;
    }>(),
    {
        showGroup: true
    }
);

// We do some caching here to prevent too many calculations on cart changes
const canEdit = computed(() => props.item.showItemView)

const checkoutRegisterItem = useCheckoutRegisterItem();

async function deleteMe() {
    props.item.checkout.remove(props.item)
}

async function editMe() {
    await checkoutRegisterItem({
        item: props.item,
        startCheckoutFlow: false,
        displayOptions: {action: 'present', modalDisplayStyle: 'popup'}
    })
}

</script>
