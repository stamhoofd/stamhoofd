<template>
    <STListItem :selectable="true">
        <template #left>
            <GroupIconWithWaitingList :group="group" :icon="groupIcon" />
        </template>

        <h3 class="style-title-list">
            {{ name }}
        </h3>

        <STListItemGrid>
            <STListItemGridRow :value="prices" :label="$t(`ae21b9bf-7441-4f38-b789-58f34612b7af`)" />
            <STListItemGridRow :value="ageRestriction" :label="$t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`)" />
            <STListItemGridRow :value="genderRestriction" :label="$t(`3048ad16-fd3b-480e-b458-10365339926b`)" />
            <STListItemGridRow v-if="$defaultAgeGroups.length" :value="defaultAgeGroupName" :label="$t(`c0277e8e-a2e0-4ec3-9339-c2e1be2e6e2d`)" />
            <STListItemGridRow :value="status" :label="$t(`e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5`)" />
        </STListItemGrid>

        <template #right>
            <span class="icon arrow-right-small gray" />
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
