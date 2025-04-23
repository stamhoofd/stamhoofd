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

                <p v-if="differentOrganization" class="info-box icon basket">
                    {{ $t('97ea7ffc-c5a0-4bb8-a2c5-ec1ae003a371') }}
                </p>

                <EventInfoTable :event="event" :family="memberManager.family" />

                <template v-if="!$isMobile && event.group">
                    <hr><p class="style-button-bar right-align">
                        <button class="button primary" type="button" :disabled="!!differentOrganization" @click="openGroup">
                            <span>{{ $t('eb52f3e4-1daa-41d6-8716-18785bdc8a8d') }}</span>
                            <span class="icon arrow-right" />
                        </button>
                    </p>
                </template>
            </main>

            <STToolbar v-if="$isMobile && event.group">
                <template #right>
                    <button class="button primary" type="button" :disabled="!!differentOrganization" @click="openGroup">
                        <span>{{ $t('eb52f3e4-1daa-41d6-8716-18785bdc8a8d') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </template>
            </STToolbar>
        </div>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { EventInfoTable, ExternalOrganizationContainer, ImageComponent, useChooseFamilyMembersForGroup, usePlatform } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { Event, Organization } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

const props = defineProps<{
    event: Event;
}>();

const platform = usePlatform();
const title = computed(() => props.event.name);
const memberManager = useMemberManager();
const groupOrganization = ref<Organization | null>(null);
const differentOrganization = computed(() => props.event.group && !memberManager.family.checkout.cart.isEmpty && memberManager.family.checkout.singleOrganization?.id !== props.event.group.organizationId);

function setOrganization(o: Organization) {
    groupOrganization.value = o as any;
}

const levelPrefix = computed(() => {
    const prefixes: string[] = [];

    if (props.event.organizationId === null) {
        if (props.event.meta.organizationTagIds !== null) {
            const tagNames = platform.value?.config.tags.filter(t => props.event.meta.organizationTagIds?.includes(t.id)).map(t => t.name);
            prefixes.push(...tagNames);
        }
        else {
            prefixes.push($t(`33c4f792-005f-4fb1-ad98-397dd92038aa`));
        }
    }
    else {
        // Name of the organization
        prefixes.push(groupOrganization.value?.name ?? props.event.organizationId);
    }

    return Formatter.joinLast(prefixes, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ');
});

const chooseFamilyMembersForGroup = useChooseFamilyMembersForGroup();

async function openGroup() {
    if (!props.event.group) {
        return;
    }

    await chooseFamilyMembersForGroup({
        group: props.event.group,
        family: memberManager.family,
        displayOptions: {
            action: 'present',
            modalDisplayStyle: 'popup',
        },
    });
}

</script>

<style lang="scss">
.event-view {
    .description {
        margin-bottom: 20px;
    }
}
</style>
