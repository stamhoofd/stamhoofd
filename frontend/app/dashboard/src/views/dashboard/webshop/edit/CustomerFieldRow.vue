<template>
    <STListItem v-long-press="(e: MouseEvent) => showContextMenu(e)" :selectable="!fixed" class="customer-field-row left-center right-stack hover-box" :data-testid="dataTestid" @click="showContextMenu" @contextmenu.prevent="showContextMenu">
        <template #left>
            <IconContainer :icon="icon" :aside-icon="isOptional ? 'help' : null" class="gray" />
        </template>
        <h3 class="style-title-list">
            {{ name }}
        </h3>

        <p v-if="description" class="style-description-small">
            {{ description }}
        </p>
        <p v-if="isOptional" class="style-description-small">
            {{ $t('%14p') }}
        </p>
        <template #right>
            <span v-if="fixed" v-tooltip="$t('Altijd verplicht')" class="icon lock small gray hover-show" />
            <button v-else type="button" class="hover-show button icon more small" :data-testid="dataTestid ? dataTestid + '-more' : undefined" @click.stop="showContextMenu" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu';
import { CustomerFieldRequirement, getCustomerFieldRequirementName } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import { computed } from 'vue';

const requirement = defineModel<CustomerFieldRequirement>({ required: true });

const props = withDefaults(defineProps<{
    name: string;
    icon: string;
    description?: string | null;
    /**
     * Always asked and required: the requirement cannot change and the field cannot be removed
     */
    fixed?: boolean;
    dataTestid?: string;
}>(), {
    description: null,
    fixed: false,
    dataTestid: undefined,
});

const isOptional = computed(() => requirement.value === CustomerFieldRequirement.Optional);

function showContextMenu(event: MouseEvent) {
    if (props.fixed) {
        return;
    }
    const menu = new ContextMenu([
        [CustomerFieldRequirement.Required, CustomerFieldRequirement.Optional].map(value => new ContextMenuItem({
            name: getCustomerFieldRequirementName(value),
            selected: requirement.value === value,
            action: () => {
                requirement.value = value;
            },
        })),
        [
            new ContextMenuItem({
                name: $t('%CJ'),
                icon: 'trash',
                destructive: true,
                action: () => {
                    requirement.value = CustomerFieldRequirement.Disabled;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}
</script>

<style lang="scss" scoped>
.customer-field-row :deep(> .left) {
    gap: 12px;
}
</style>
