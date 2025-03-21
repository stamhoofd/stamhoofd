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
            Voor {{ prefix }}
        </p>

        <p v-if="event.meta.location?.name || event.meta.location?.address?.city" class="style-description-small">
            {{ event.meta.location?.name || event.meta.location?.address?.city }}
        </p>

        <p v-if="event.group" class="style-description-small">
            <span v-if="event.group.notYetOpen">Inschrijvingen starten op {{ Formatter.date(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date()) }}</span>
            <span v-else-if="event.group.closed">Inschrijvingen gesloten</span>
            <span v-else>Inschrijvingen open</span>
        </p>

        <p v-if="event.group && app !== 'registration'" class="style-description-small">
            <span v-if="event.group.getMemberCount() !== null">{{ capitalizeFirstLetter(pluralText(event.group.getMemberCount() ?? 0, 'inschrijving', 'inschrijvingen')) }}</span>
        </p>

        <template #right>
            <span v-if="!event.meta.visible" v-tooltip="'Verborgen'" class="icon gray eye-off" />
            <span v-if="event.id" class="icon arrow-right-small gray" />
            <span v-else class="icon add gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { Event } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useOrganization, usePlatform } from '../../hooks';
import EventImageBox from './EventImageBox.vue';
import { useAppContext } from '../../context';

const props = defineProps<{
    event: Event
}>();

const platform = usePlatform()
const organization = useOrganization()
const app = useAppContext()

const levelPrefix = computed(() => {
    const prefixes: string[] = []

    if (props.event.organizationId === null) {
        if (props.event.meta.organizationTagIds !== null) {
            const tagNames = platform.value?.config.tags.filter(t => props.event.meta.organizationTagIds?.includes(t.id)).map(t => t.name)
            prefixes.push(...tagNames)
        } else {
            prefixes.push('Nationaal')
        }
    } else {
        if (props.event.organizationId === organization.value?.id) {
            // skip
        } else {
            // Name of the organization
            if (props.event.meta.organizationCache?.name) {
                prefixes.push(props.event.meta.organizationCache?.name)
            }
        }
    }

    return Formatter.joinLast(prefixes, ', ', ' en ')
});


const prefix = computed(() => {
    const prefixes: string[] = []

    if (props.event.meta.defaultAgeGroupIds !== null) {
        for (const ageGroupId of props.event.meta.defaultAgeGroupIds) {
            const ageGroup = platform.value?.config.defaultAgeGroups.find(g => g.id === ageGroupId)
            if (ageGroup) {
                prefixes.push(ageGroup.name)
            }
        }
    }

    if (props.event.meta.groups !== null) {
        for (const group of props.event.meta.groups) {
            prefixes.push(group.name)
        }
    }
    return Formatter.joinLast(prefixes, ', ', ' en ')
});

</script>
