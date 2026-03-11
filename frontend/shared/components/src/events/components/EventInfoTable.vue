<template>
    <STList>
        <STListItem>
            <template #left>
                <span class="icon event" />
            </template>

            <h2 class="style-title-list">
                {{ capitalizeFirstLetter(event.dateRange) }}
            </h2>
        </STListItem>

        <STListItem v-if="event.meta.location" :selectable="!!googleMapsUrl" :href="googleMapsUrl" :element-name="googleMapsUrl ? 'a' : undefined" target="_blank">
            <template #left>
                <span class="icon location" />
            </template>

            <h2 class="style-title-list">
                {{ event.meta.location.name }}
            </h2>
            <p class="style-description-small">
                {{ event.meta.location.address }}
            </p>

            <template v-if="googleMapsUrl" #right>
                <span class="icon arrow-right-small gray" />
            </template>
        </STListItem>

        <STListItem v-if="ageGroups.length">
            <template #left>
                <span class="icon group" />
            </template>

            <h2 class="style-title-list">
                {{ ageGroups }}
            </h2>
        </STListItem>

        <STListItem v-if="event.group && (event.meta.minAge !== null || event.meta.maxAge !== null)">
            <template #left>
                <span class="icon membership-filled" />
            </template>

            <h2 v-if="event.meta.minAge !== null && event.meta.maxAge !== null && event.meta.minAge === event.meta.maxAge" class="style-title-list">
                {{ $t('%1Fx', {
                    x: event.meta.minAge,
                    xxxx: (event.startDate.getFullYear() - event.meta.minAge),
                }) }}
            </h2>
            <h2 v-else-if="event.meta.minAge !== null && event.meta.maxAge !== null" class="style-title-list">
                {{ $t('%1Fy', {
                    x: event.meta.minAge,
                    xxxx: (event.startDate.getFullYear() - event.meta.minAge),
                    y: event.meta.maxAge,
                    yyyy: (event.startDate.getFullYear() - event.meta.maxAge),
                }) }}
            </h2>
            <h2 v-else-if="event.meta.minAge !== null" class="style-title-list">
                {{ $t('%1Fz', {
                    x: event.meta.minAge,
                    xxxx: (event.startDate.getFullYear() - event.meta.minAge)
                }) }}
            </h2>
            <h2 v-else-if="event.meta.maxAge !== null" class="style-title-list">
                {{ $t('%1G0', {
                    x: event.meta.maxAge,
                    xxxx: (event.startDate.getFullYear() - event.meta.maxAge)
                }) }}
            </h2>
        </STListItem>

        <STListItem v-if="event.group" :selectable="!differentOrganization && !event.group.closed" class="right-stack" @click="!differentOrganization && !event.group.closed ? openGroup() : undefined">
            <template #left>
                <span class="icon edit" />
            </template>

            <h2 class="style-title-list">
                <span v-if="event.group.notYetOpen && event.group.settings.registrationEndDate">{{ $t('%b2') }} {{ Formatter.dateRange(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date(), event.group.settings.registrationEndDate, ' tot ') }}</span>
                <span v-else-if="event.group.notYetOpen">{{ $t('%b3') }} {{ Formatter.startDate(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date()) }}</span>
                <span v-else-if="event.group.closed">{{ $t('%b4') }}</span>
                <span v-else-if="event.group.settings.registrationEndDate">{{ $t('%b5') }} {{ Formatter.endDate(event.group.settings.registrationEndDate) }}</span>
                <span v-else>{{ $t('%b6') }}</span>
            </h2>

            <p v-if="app !== 'registration' && !event.group.closed && (organization && event.organizationId !== organization.id && !event.group.settings.allowRegistrationsByOrganization)" class="style-description-small">
                {{ $t('%5c') }}
            </p>

            <template v-if="!differentOrganization && !event.group.closed" #right>
                <span class="icon arrow-right-small gray" />
            </template>
        </STListItem>

        <slot />
    </STList>
</template>

<script setup lang="ts">
import { useAppContext, useChooseFamilyMembersForGroup, useOrganization, usePlatform } from '@stamhoofd/components';
import { Event, PlatformFamily } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        event: Event;
        family?: PlatformFamily | null;
    }>(),
    {
        family: null,
    },
);

const platform = usePlatform();
const app = useAppContext();
const organization = useOrganization();

const googleMapsUrl = computed(() => {
    if (props.event.meta.location?.address) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.event.meta.location.address.toString())}`;
    }
    return null;
});
const differentOrganization = computed(() => props.event.group && (!props.family || (props.family.checkout.cart.isEmpty && props.family.checkout.singleOrganization?.id !== props.event.group.organizationId)));

const ageGroups = computed(() => {
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

    return Formatter.joinLast(prefixes, ', ', ' ' + $t(`%GT`) + ' ');
});

const chooseFamilyMembersForGroup = useChooseFamilyMembersForGroup();

async function openGroup() {
    if (!props.event.group || !props.family) {
        return;
    }

    await chooseFamilyMembersForGroup({
        group: props.event.group,
        family: props.family,
        displayOptions: {
            action: 'present',
            modalDisplayStyle: 'popup',
        },
    });
}

</script>
