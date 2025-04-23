<template>
    <STListItem class="right-stack smartphone-wrap-left" :selectable="true">
        <template #left>
            <EventImageBox :event="event" />
        </template>
        <p v-if="levelPrefix" class="style-title-prefix-list style-limit-lines">
            {{ levelPrefix }}
        </p>
        <h3 class="style-title-list larger">
            <span>{{ event.name }}</span>
        </h3>
        <p class="style-description-small">
            {{ Formatter.capitalizeFirstLetter(event.dateRange) }}
        </p>

        <p v-if="prefix" class="style-description-small">
            {{ $t('60898eb6-b3e7-44ef-820c-3bd57b4c6bca') }} {{ prefix }}
        </p>

        <p v-if="event.meta.location?.name || event.meta.location?.address?.city" class="style-description-small">
            {{ event.meta.location?.name || event.meta.location?.address?.city }}
        </p>

        <p v-if="event.group" class="style-description-small">
            <span v-if="event.group.notYetOpen">{{ $t('4837760e-e747-427f-a976-0acbc786365f') }} {{ Formatter.date(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date()) }}</span>
            <span v-else-if="event.group.closed">{{ $t('8222f272-8e50-4d5d-9e30-ddd534c30081') }}</span>
            <span v-else>{{ $t('5e56d87a-0c2b-412c-8a84-92091856e538') }}</span>
        </p>

        <p v-if="event.group && app !== 'registration'" class="style-description-small">
            <span v-if="event.group.getMemberCount() !== null">{{ capitalizeFirstLetter(pluralText(event.group.getMemberCount() ?? 0, 'inschrijving', 'inschrijvingen')) }}</span>
        </p>

        <template #right>
            <span v-if="!event.meta.visible" class="icon gray eye-off" :v-tooltip="$t('6276d07c-bd0d-4117-b46c-e3f7b0dbb1e5')" />
            <span v-if="event.id" class="icon arrow-right-small gray" />
            <span v-else class="icon add gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { Event } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useAppContext } from '../../context';
import { useOrganization, usePlatform } from '../../hooks';
import EventImageBox from './EventImageBox.vue';

const props = defineProps<{
    event: Event;
}>();

const platform = usePlatform();
const organization = useOrganization();
const app = useAppContext();

const levelPrefix = computed(() => {
    const prefixes: string[] = [];

    if (props.event.organizationId === null) {
        if (props.event.meta.organizationTagIds !== null) {
            const tagNames = platform.value?.config.tags.filter(t => props.event.meta.organizationTagIds?.includes(t.id)).map(t => t.name);
            prefixes.push(...tagNames);
        }
        else {
            prefixes.push($t(`81df09d0-56ee-491d-b474-85173b1401dd`));
        }
    }
    else {
        if (props.event.organizationId === organization.value?.id) {
            // skip
        }
        else {
            // Name of the organization
            if (props.event.meta.organizationCache?.name) {
                prefixes.push(props.event.meta.organizationCache?.name);
            }
        }
    }

    return Formatter.joinLast(prefixes, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ');
});

const prefix = computed(() => {
    const prefixes: string[] = [];

    if (props.event.meta.defaultAgeGroupIds !== null) {
        for (const ageGroupId of props.event.meta.defaultAgeGroupIds) {
            const ageGroup = platform.value?.config.defaultAgeGroups.find(g => g.id === ageGroupId);
            if (ageGroup) {
                prefixes.push(ageGroup.name);
            }
        }
    }

    if (props.event.meta.groups !== null) {
        for (const group of props.event.meta.groups) {
            prefixes.push(group.name);
        }
    }
    return Formatter.joinLast(prefixes, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ');
});

</script>
