<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="event.organizationId" @update="setOrganization">
        <div class="st-view event-view">
            <STNavigationBar :title="title" />

            <main class="center">
                <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" :auto-height="true" class="style-cover-photo" />

                <p class="style-title-prefix">
                    {{ levelPrefix }}
                </p>
                <h1 class="style-navigation-title">
                    {{ title }}
                </h1>

                <div v-if="event.meta.description.html" class="description style-wysiwyg gray large" v-html="event.meta.description.html" />

                <STList>
                    <STListItem>
                        <template #left>
                            <span class="icon calendar" />
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

                    <STListItem v-if="event.group" :selectable="!event.group.closed" class="right-stack"  @click="!event.group.closed ? openGroup() : undefined">
                        <template #left>
                            <span class="icon edit" />
                        </template>

                        <h2 class="style-title-list">
                            <span v-if="event.group.notYetOpen && event.group.settings.registrationEndDate">Inschrijven mogelijk van {{ Formatter.dateRange(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date(), event.group.settings.registrationEndDate, ' tot ') }}</span>
                            <span v-else-if="event.group.notYetOpen">Inschrijven mogelijk vanaf {{ Formatter.startDate(event.group.activePreRegistrationDate ?? event.group.settings.registrationStartDate ?? new Date()) }}</span>
                            <span v-else-if="event.group.closed">De inschrijvingen zijn gesloten</span>
                            <span v-else-if="event.group.settings.registrationEndDate">Inschrijven kan tot {{ Formatter.endDate(event.group.settings.registrationEndDate) }}</span>
                            <span v-else>Schrijf je nu in</span>
                        </h2>

                        <template v-if="!event.group.closed" #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <template v-if="!$isMobile">
                    <hr>

                    <p class="style-button-bar right-align">
                        <button class="button primary" type="button" @click="openGroup">
                            <span>Inschrijven</span>
                            <span class="icon arrow-right" />
                        </button>
                    </p>
                </template>
            </main>

            <STToolbar v-if="$isMobile">
                <template #right>
                    <button class="button primary" type="button" @click="openGroup">
                        <span>Inschrijven</span>
                        <span class="icon arrow-right" />
                    </button>
                </template>
            </STToolbar>
        </div>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { ImageComponent, useCheckoutRegisterItem, usePlatform, ExternalOrganizationContainer } from '@stamhoofd/components';
import { Event, Organization, RegisterItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ref, computed } from 'vue';
import { useMemberManager } from '../../getRootView';

const props = defineProps<{
    event: Event;
}>();

const platform = usePlatform();
const title = computed(() => props.event.name);
const memberManager = useMemberManager()
const googleMapsUrl = computed(() => {
    if (props.event.meta.location?.address) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.event.meta.location.address)}`;
    }
    return null;
});
const groupOrganization = ref<Organization | null>(null);

function setOrganization(o: Organization) {
    groupOrganization.value = o as any;
}

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
        // Name of the organization
        prefixes.push(groupOrganization.value?.name ?? props.event.organizationId)
    }

    return Formatter.joinLast(prefixes, ', ', ' en ')
});


const ageGroups = computed(() => {
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

    return Formatter.joinLast(prefixes, ', ', ' of ');
});

const checkoutRegisterItem = useCheckoutRegisterItem()

async function openGroup() {
    if (!props.event.group) {
        return;
    }

    const item = RegisterItem.defaultFor(memberManager.family.members[0], props.event.group, memberManager.family.organizations[0])
    await checkoutRegisterItem(item, false, {
        present: 'popup'
    })

    // todo: go to member selection view
}

</script>

<style lang="scss">
.event-view {
    .description {
        margin-bottom: 20px;
    }
}
</style>
