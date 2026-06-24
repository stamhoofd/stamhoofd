<template>
    <STListItem v-long-press="(e: MouseEvent) => showContextMenu(e)" class="right-description right-stack left-center" :selectable="true" @click="editDiscountCode()" @contextmenu.prevent="showContextMenu">
        <template #left>
            <span class="icon label" />
        </template>

        <h3 class="style-title-list">
            <span class="style-discount-code">{{ discountCode.code }}</span>
        </h3>
        <p v-if="discountCode.description" class="style-description-small">
            {{ discountCode.description }}
        </p>
        <p class="style-description-small">
            {{ discountCode.usageCount }} {{ $t('%QQ') }}
        </p>

        <template #right>
            <button type="button" class="button icon more gray hide-smartphone" @click.stop.prevent="showContextMenu" @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import type { DiscountCode, PrivateWebshop } from '@stamhoofd/structures';
import { useDiscountCodeActions } from './useDiscountCodeActions';

const props = defineProps<{
    discountCode: DiscountCode;
    discountCodes: DiscountCode[];
    visibleDiscountCodes: DiscountCode[];
    isFiltering: boolean;
    webshop: PrivateWebshop;
}>();

const emit = defineEmits<{
    (e: 'patch:discountCodes', value: PatchableArrayAutoEncoder<DiscountCode>): void;
}>();

const { showMenu: showContextMenu, editDiscountCode } = useDiscountCodeActions(
    patch => emit('patch:discountCodes', patch),
)(props);
</script>
