<template>
    <STListItem class="right-stack" :selectable="canEdit" @click="canEdit ? editMe() : undefined">
        <template v-if="showGroup" #left>
            <GroupIconWithWaitingList :group="item.group" :icon="item.replaceRegistrations.length ? 'sync' : ''" />
        </template>
        <template v-else #left>
            <MemberIcon :member="item.member" :icon="item.group.type === GroupType.WaitingList ? 'clock' : (item.replaceRegistrations.length ? 'sync' : '')" />
        </template>

        <template v-if="showGroup">
            <p class="style-title-prefix-list">
                {{ item.organization.name }}
            </p>

            <h3 class="style-title-list">
                {{ item.group.settings.name }}
                <span v-if="item.group.settings.period && item.group.type === GroupType.Membership" class="title-suffix">{{ item.group.settings.period.nameShort }}</span>
            </h3>

            <p class="style-description-small">
                {{ item.member.patchedMember.name }}
            </p>
        </template>
        <template v-else>
            <h3 class="style-title-list">
                {{ item.member.patchedMember.name }}
            </h3>
        </template>

        <p v-if="item.description" class="style-description-small pre-wrap" v-text="item.description" />

        <template v-if="item.totalPrice !== 0">
            <footer v-if="item.checkout.isAdminFromSameOrganization">
                <p v-if="item.totalPrice >= 0" class="style-price">
                    {{ $t('8f5787b9-ad3e-41e2-b996-9e7704688b13', {price: formatPrice(item.totalPrice)}) }}
                </p>
                <p v-else class="style-price">
                    {{ $t('2f76634a-16b6-494c-90b1-b70644b6503b', {price: formatPrice(-item.totalPrice)}) }}
                </p>
            </footer>
            <footer v-else>
                <p class="style-price">
                    {{ formatPrice(item.totalPrice) }}
                </p>
            </footer>
        </template>

        <template v-if="item.calculatedPriceDueLater > 0">
            <footer>
                <p class="style-price">
                    {{ formatPrice(item.calculatedPriceDueLater) }} {{ $t('c8f348d5-d497-48dd-b7a2-c9c6d8f99199') }}
                </p>
            </footer>
        </template>

        <p v-if="item.cartError" class="error-box small">
            {{ item.cartError.getHuman() }}

            <span v-if="canEdit" class="button text">
                <span>{{ $t('43735610-03c1-494b-b76b-74a13a560880') }}</span>
                <span class="icon arrow-right-small" />
            </span>
        </p>

        <template #right>
            <button class="button icon trash gray" type="button" @click.stop="deleteMe()" />
            <button v-if="canEdit" class="button icon edit gray" type="button" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { GroupType, RegisterItem } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useCheckoutRegisterItem } from '../../checkout';
import MemberIcon from '../MemberIcon.vue';
import GroupIconWithWaitingList from './GroupIconWithWaitingList.vue';

const props = withDefaults(
    defineProps<{
        item: RegisterItem;
        showGroup?: boolean;
    }>(),
    {
        showGroup: true,
    },
);

// We do some caching here to prevent too many calculations on cart changes
const canEdit = computed(() => props.item.showItemView);

const checkoutRegisterItem = useCheckoutRegisterItem();

async function deleteMe() {
    props.item.checkout.remove(props.item);
}

async function editMe() {
    await checkoutRegisterItem({
        item: props.item,
        startCheckoutFlow: false,
        displayOptions: { action: 'present', modalDisplayStyle: 'popup' },
    });
}

</script>
