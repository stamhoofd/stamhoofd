<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('%1O5')" @click="goBack" />
                <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('%1Og')" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1P1') }}
                    </h3>
                    <p class="style-definition-text with-icons">
                        <span>{{ statusLabel }}</span>
                        <span v-if="statusIcon" :class="'icon ' + statusIcon" />
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1PI') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ props.webshopWithOrganization.organization.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1PC') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ typeLabel }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1PV') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(props.webshopWithOrganization.webshop.createdAt) }}
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('%1Pa') }}</h2>

            <STList>
                <STListItem
                    :selectable="true"
                    element-name="a"
                    :href="dashboardUrl"
                    :target="$isMobile ? undefined : '_blank'"
                >
                    <template #left>
                        <IconContainer icon="settings" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1PJ') }}
                    </h3>
                    <p class="style-description">
                        {{ isArchived ? $t('%1O3') : $t('%1P5') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>

                <STListItem
                    v-if="!isArchived"
                    :selectable="true"
                    element-name="a"
                    :href="webshopUrl"
                    :target="$isMobile ? undefined : '_blank'"
                >
                    <template #left>
                        <IconContainer icon="link" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1Pf') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('%1PY') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import { useBackForward } from '@stamhoofd/components/hooks/useBackForward.ts';
import type { WebshopWithOrganization} from '@stamhoofd/structures';
import { WebshopStatus, getWebshopStatusName, getWebshopTypeName } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    webshopWithOrganization: WebshopWithOrganization;
    getNext: ((current: WebshopWithOrganization) => WebshopWithOrganization | null) | null;
    getPrevious: ((current: WebshopWithOrganization) => WebshopWithOrganization | null) | null;
}>();

const { goBack, goForward, hasNext, hasPrevious } = useBackForward('webshopWithOrganization', props);

const title = computed(() => props.webshopWithOrganization.webshop.meta.name);

const typeLabel = computed(() => getWebshopTypeName(props.webshopWithOrganization.webshop.meta.type));

const statusLabel = computed(() => getWebshopStatusName(props.webshopWithOrganization.webshop.meta.status));

const statusIcon = computed(() => {
    switch (props.webshopWithOrganization.webshop.meta.status) {
        case WebshopStatus.Open: return 'success green small';
        case WebshopStatus.Closed: return 'disabled red small';
        case WebshopStatus.Archived: return 'archive small';
        default: return '';
    }
});

const isArchived = computed(() => props.webshopWithOrganization.webshop.meta.status === WebshopStatus.Archived);

const dashboardUrl = computed(() => props.webshopWithOrganization.dashboardUrl);

const webshopUrl = computed(() => props.webshopWithOrganization.url);
</script>
