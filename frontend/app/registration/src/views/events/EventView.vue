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

                <template v-if="!$isMobile && event.group && !event.group.closed">
                    <hr><p class="style-button-bar right-align">
                        <button class="button primary" type="button" :disabled="!!differentOrganization" @click="openGroup">
                            <span>{{ $t('eb52f3e4-1daa-41d6-8716-18785bdc8a8d') }}</span>
                            <span class="icon arrow-right" />
                        </button>
                    </p>
                </template>

                <template v-if="!$isMobile && webshop && webshopOrganization && !webshop.isClosed()">
                    <hr><p class="style-button-bar right-align">
                        <a class="button primary" :href="'https://' + webshop.getUrl(webshopOrganization)" target="_blank">
                            <span v-if="webshop.hasTickets" class="icon ticket" />
                            <span v-if="webshop.hasTickets">{{ $t('6585a0cd-eb4c-448d-802c-dfcb27e5c7b8') }}</span>
                            <template v-else>
                                <span>{{ $t('52aadb14-e175-4efe-bdf9-b88a632b6926') }}</span>
                                <span class="icon arrow-right" />
                            </template>
                        </a>
                    </p>
                </template>
            </main>

            <STToolbar v-if="$isMobile && event.group && !event.group.closed">
                <template #right>
                    <button class="button primary" type="button" :disabled="!!differentOrganization" @click="openGroup">
                        <span>{{ $t('eb52f3e4-1daa-41d6-8716-18785bdc8a8d') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </template>
            </STToolbar>

            <STToolbar v-if="$isMobile && webshop && webshopOrganization && !webshop.isClosed()">
                <template #right>
                    <a class="button primary" :href="'https://' + webshop.getUrl(webshopOrganization)" target="_blank">
                        <span v-if="webshop.hasTickets" class="icon ticket" />
                        <span v-if="webshop.hasTickets">{{ $t('6585a0cd-eb4c-448d-802c-dfcb27e5c7b8') }}</span>
                        <template v-else>
                            <span>{{ $t('52aadb14-e175-4efe-bdf9-b88a632b6926') }}</span>
                            <span class="icon arrow-right" />
                        </template>
                    </a>
                </template>
            </STToolbar>
        </div>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { EventInfoTable, ExternalOrganizationContainer, ImageComponent, useChooseFamilyMembersForGroup, useContext, useExternalOrganization, useOrganization, usePlatform } from '@stamhoofd/components';
import { useMemberManager, useRequestOwner } from '@stamhoofd/networking';
import { Event, Organization, Webshop, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, Ref, ref } from 'vue';

const props = defineProps<{
    event: Event;
}>();

const platform = usePlatform();
const title = computed(() => props.event.name);
const memberManager = useMemberManager();
const groupOrganization = ref<Organization | null>(null) as Ref<Organization | null>;
const differentOrganization = computed(() => props.event.group && !memberManager.family.checkout.cart.isEmpty && memberManager.family.checkout.singleOrganization?.id !== props.event.group.organizationId);
const loadedWebshop = ref<Webshop | WebshopPreview | null>(null);
const context = useContext();
let didLoadWebshop = false;
const loadingWebshop = ref(false);
const owner = useRequestOwner();
const { loading: loadingWebshopOrganization, externalOrganization: loadedWebshopOrganization } = useExternalOrganization(computed(() => {
    const id = loadedWebshop.value?.organizationId ?? null;
    if (id === props.event.organizationId) {
        // We are gonna load it anyway, don't load it again
        return null;
    }
    return id;
}), groupOrganization);
const organization = useOrganization();

const webshopOrganization = computed(() => {
    if (!loadedWebshop.value) {
        return null;
    }
    if (groupOrganization.value && groupOrganization.value.id === loadedWebshop.value.organizationId) {
        return groupOrganization.value;
    }

    if (organization.value && organization.value.id === loadedWebshop.value.organizationId) {
        return organization.value;
    }

    return loadedWebshopOrganization.value;
});

function setOrganization(o: Organization) {
    groupOrganization.value = o as any;

    // Delay loading webshop, because we can often find the webshop inside the organization
    loadWebshop().catch(console.error);
}

onMounted(() => {
    if (!props.event.organizationId) {
        // Load webshop, as we won't loado the group organization
        loadWebshop().catch(console.error);
    }
});

const webshop = computed(() => {
    if (!props.event.webshopId) {
        return null;
    }
    return loadedWebshop.value;
});

async function loadWebshop() {
    if (!props.event.webshopId) {
        return;
    }
    if (didLoadWebshop) {
        return;
    }
    // @ts-ignore
    let loaded = groupOrganization.value?.webshops.find(w => w.id === props.event.webshopId) ?? null;
    if (loaded) {
        loadedWebshop.value = loaded;
        return;
    }
    didLoadWebshop = true;
    loadingWebshop.value = true;

    // Fetch webshop by id
    try {
        const response = await context.value.getAuthenticatedServerForOrganization(props.event.organizationId).request({
            method: 'GET',
            path: '/webshop/' + props.event.webshopId,
            decoder: Webshop as Decoder<Webshop>,
            shouldRetry: true,
            owner,
        });
        loadedWebshop.value = response.data;
    }
    catch (e) {
        console.error('Failed to load webshop', e);
    }
    loadingWebshop.value = false;
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
