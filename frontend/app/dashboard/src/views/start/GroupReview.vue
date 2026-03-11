<template>
    <STListItem :selectable="true">
        <template #left>
            <GroupIconWithWaitingList :group="group" :icon="groupIcon" />
        </template>

        <h3 class="style-title-list">
            {{ name }}
        </h3>

        <STListItemGrid>
            <STListItemGridRow :value="prices" :label="$t(`a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc`)" />
            <STListItemGridRow :value="ageRestriction" :label="$t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`)" />
            <STListItemGridRow :value="genderRestriction" :label="$t(`08ef39ff-3431-4975-8c46-8fb68c946432`)" />
            <STListItemGridRow v-if="$defaultAgeGroups.length" :value="defaultAgeGroupName" :label="$t(`c0277e8e-a2e0-4ec3-9339-c2e1be2e6e2d`)" />
            <STListItemGridRow :value="status" :label="$t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`)" />
        </STListItemGrid>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { GroupIconWithWaitingList, STListItemGrid, STListItemGridRow, usePlatform } from '@stamhoofd/components';
import { Group, GroupGenderType, GroupStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = defineProps<{ group: Group }>();
const platform = usePlatform();

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
    ).sort((a, b) => a - b)
        .map(price => Formatter.price(price))
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
