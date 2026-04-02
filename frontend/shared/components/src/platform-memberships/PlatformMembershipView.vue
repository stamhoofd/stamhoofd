<template>
    <LoadingViewTransition>
        <div class="st-view">
            <STNavigationBar :title="title">
                <template #right>
                    <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('Vorige aansluiting')" @click="goBack" />
                    <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('Volgende aansluiting')" @click="goForward" />
                </template>
            </STNavigationBar>

            <main>
                <h1>
                    {{ title }}
                </h1>

                <div>
                    <PlatformMembershipBox :platform-membership="platformMembership" />
                </div>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import type { PlatformMembership } from '@stamhoofd/structures';
import { LoadingViewTransition } from '../containers';
import { useBackForward } from '../hooks';
import PlatformMembershipBox from './PlatformMembershipBox.vue';

/**
 * Simple list with data (will not be used frequently). Can be improved in the future if necessary.
 */
const props = withDefaults(
    defineProps<{
        platformMembership: PlatformMembership;
        getNext?: ((platformMembership: PlatformMembership) => PlatformMembership) | null;
        getPrevious?: ((platformMembership: PlatformMembership) => PlatformMembership) | null;
    }>(), {
        getNext: null,
        getPrevious: null,
    },
);
const { hasNext, hasPrevious, goBack, goForward } = useBackForward('platformMembership', props);

const title = $t('Aansluiting');
</script>
