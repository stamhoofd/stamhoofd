<template>
    <STListItem :selectable="true">
        <template #left>
            <GroupIcon :group="group" :icon="groupIcon" />
        </template>

        <h3 class="style-title-list">
            {{ name }}
        </h3>

        <STListItemGrid>
            <STListItemGridRow label="Tarief" :value="prices" />
            <STListItemGridRow label="Leeftijd" :value="ageRestriction" />
            <STListItemGridRow label="Geslacht" :value="genderRestriction" />
            <STListItemGridRow label="Status" :value="status" />
        </STListItemGrid>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { GroupIcon, STListItemGrid, STListItemGridRow } from '@stamhoofd/components';
import { Group, GroupGenderType, GroupStatus } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{group: Group}>();

const currency = '€';

const groupIcon = computed(() => {
    const group = props.group;

    if(group.status !== GroupStatus.Open) {
        return 'lock';
    }

    if(group.settings.prices.length === 1 && group.settings.prices[0].price.price === 0) {
        return 'gift';
    }

    return '';
});

const name = computed(() => props.group.settings.name);

const prices = computed(() => {
    const group = props.group;

    if(group.settings.prices.length === 0) {
        return 'geen'
    }
    return group.settings.prices
        .map(p => p.price.price / 100)
        .sort((a, b) => a - b)
        .map(price => `${currency} ${price}`)
        .join(' / ');
});

const ageRestriction = computed(() => {
    const group = props.group;

    const max = group.settings.maxAge;
    const min = group.settings.minAge;

    if(max !== null && min !== null) {
        return `${min} - ${max}`;
    }

    if(max !== null) {
        return `tot ${max}`;
    }

    if(min !== null) {
        return `${min}+`;
    }

    return 'Geen restrictie';
});

const genderRestriction = computed(() => {
    const group = props.group;

    switch(group.settings.genderType) {
        case GroupGenderType.OnlyMale: return 'Enkel jongens';
        case GroupGenderType.OnlyFemale: return 'Enkel meisjes';
        case GroupGenderType.Mixed: return 'Gemengd';
        default: return '';
    }
});

const status = computed(() => {
    const group = props.group;

    switch(group.status) {
        case GroupStatus.Open: return 'Open';
        case GroupStatus.Closed: return 'Gesloten';
        default: return 'Onbekend';
    }
});
</script>

<style lang="scss" scoped>
</style>
