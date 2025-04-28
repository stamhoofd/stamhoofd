<template>
    <STList>
        <STListItem>
            <template #left>
                <span class="icon calendar-grid" />
            </template>

            <h2 class="style-title-list">
                {{ capitalizeFirstLetter(event.dateRange) }}
            </h2>
        </STListItem>

        <STListItem v-if="event.meta.location" :selectable="googleMapsUrl" :href="googleMapsUrl" :element-name="googleMapsUrl ? 'a' : undefined" target="_blank">
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

        <STListItem v-if="event.group" :selectable="!differentOrganization && !event.group.closed" class="right-stack" @click="!differentOrganization && !event.group.closed ? openGroup() : undefined">
            <template #left>
                <span class="icon edit" />
            </template>

            <h2 class="style-title-list">
                <span v-if="event.group.notYetOpen && event.group.settings.registrationEndDate">{{ $t('7aa189c8-5a21-4c4f-99c9-98e26119ee9b') }} {{ Formatter.dateRange(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date(), event.group.settings.registrationEndDate, ' tot ') }}</span>
                <span v-else-if="event.group.notYetOpen">{{ $t('3132b88b-2b83-4b1b-8ce6-3fe856779d14') }} {{ Formatter.startDate(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date()) }}</span>
                <span v-else-if="event.group.closed">{{ $t('2d68fac2-1437-4c4e-9fa1-6e0ff4e81274') }}</span>
                <span v-else-if="event.group.settings.registrationEndDate">{{ $t('dd3e1e64-a4fe-4737-bd7a-270c648628fd') }} {{ Formatter.endDate(event.group.settings.registrationEndDate) }}</span>
                <span v-else>{{ $t('54b3473d-ba8c-49f3-b4f3-638c10dffa22') }}</span>
            </h2>

            <p v-if="app !== 'registration' && !event.group.closed && (organization && event.organizationId !== organization.id && !event.group.settings.allowRegistrationsByOrganization)" class="style-description-small">
                {{ $t('34fdb013-005c-46c4-b52e-e58f7697b586') }}
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

    return Formatter.joinLast(prefixes, ', ', ' ' + $t(`8dc963d1-ba79-47c0-80d8-629b8e09c4c2`) + ' ');
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
