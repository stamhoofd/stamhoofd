<template>
    <STListItem :selectable="true">
        <template #left>
            <GroupIconWithWaitingList :group="group" :icon="groupIcon"/>
        </template>

        <h3 class="style-title-list">
            {{ name }}
        </h3>

        <STListItemGrid>
            <STListItemGridRow :value="prices" :label="$t(`19e17ff3-bd33-4b19-9803-91a975367519`)"/>
            <STListItemGridRow :value="ageRestriction" :label="$t(`fd0fc1f2-5cbf-4498-a920-3413afd2f482`)"/>
            <STListItemGridRow :value="genderRestriction" :label="$t(`620baefd-58fd-4f7d-a698-62e12b4eca23`)"/>
            <STListItemGridRow v-if="$defaultAgeGroups.length" :value="defaultAgeGroupName" :label="$t(`8ad3a6b5-20e9-4858-ab57-f6d524ef50af`)"/>
            <STListItemGridRow :value="status" :label="$t(`38b75e19-10cb-4641-88a8-f4e2e9be7576`)"/>
        </STListItemGrid>

        <template #right>
            <span class="icon arrow-right-small gray"/>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { GroupIconWithWaitingList, STListItemGrid, STListItemGridRow, usePlatform } from '@stamhoofd/components';
import { Group, GroupGenderType, GroupStatus } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{ group: Group }>();
const platform = usePlatform();

const currency = '€';

const groupIcon = computed(() => {
    const group = props.group;

    if (group.status !== GroupStatus.Open) {
        return 'lock';
    }

    if (group.defaultAgeGroupId === null) {
        return 'warning';
    }

    if (group.settings.prices.length === 1 && group.settings.prices[0].price.price === 0) {
        return 'gift';
    }

    return '';
});

const name = computed(() => props.group.settings.name);

const prices = computed(() => {
    const group = props.group;

    if (group.settings.prices.length === 0) {
        return 'geen';
    }

    return Array.from(
        new Set(group.settings.prices
            .flatMap((p) => {
                const standardPrice = p.price.price;
                const reducedPrice = p.price.reducedPrice;
                if (reducedPrice) return [standardPrice, reducedPrice];
                return [standardPrice];
            })),
    ).map(price => price / 100)
        .sort((a, b) => a - b)
        .map(price => `${currency} ${price}`)
        .join(' / ');
});

const ageRestriction = computed(() => {
    const group = props.group;

    const max = group.settings.maxAge;
    const min = group.settings.minAge;

    if (max !== null && min !== null) {
        return `${min} - ${max}`;
    }

    if (max !== null) {
        return `tot ${max}`;
    }

    if (min !== null) {
        return `${min}+`;
    }

    return 'Geen restrictie';
});

const genderRestriction = computed(() => {
    const group = props.group;

    switch (group.settings.genderType) {
        case GroupGenderType.OnlyMale: return 'Enkel jongens';
        case GroupGenderType.OnlyFemale: return 'Enkel meisjes';
        case GroupGenderType.Mixed: return 'Gemengd';
        default: return '';
    }
});

const status = computed(() => {
    const group = props.group;

    switch (group.status) {
        case GroupStatus.Open: return 'Open';
        case GroupStatus.Closed: return 'Gesloten';
        default: return 'Onbekend';
    }
});

const $defaultAgeGroups = computed(() => platform.value.config.defaultAgeGroups);

const defaultAgeGroupName = computed(() => {
    const group = props.group;

    const defaultAgeGroups = $defaultAgeGroups.value;
    const defaultAgeGroupId = group.defaultAgeGroupId;
    if (!defaultAgeGroupId) {
        return 'Niet verzekerd!';
    }

    const defaultAgeGroup = defaultAgeGroups.find(g => g.id === defaultAgeGroupId);

    if (!defaultAgeGroup) {
        return 'Onbekend';
    }

    return defaultAgeGroup.name;
});
</script>

<style lang="scss" scoped></style>
