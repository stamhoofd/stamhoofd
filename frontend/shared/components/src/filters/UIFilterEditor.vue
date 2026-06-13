<template>
    <form class="st-view" data-submit-last-field @submit.prevent="applyFilter">
        <STNavigationBar v-if="!popup || canDelete || canPop" :title="capitalizeFirstLetter((filter as any).name ? (filter as any).name : filter.builder.name)" :disable-dismiss="canPop">
            <template v-if="canDelete" #right>
                <button class="button icon trash" type="button" @click="deleteFilter" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="!live">
                {{ capitalizeFirstLetter((filter as any).name ? (filter as any).name : filter.builder.name) }}
            </h1>

            <FramedComponent :root="filterComponent" />
        </main>

        <STToolbar v-if="!live || !popup">
            <template #right>
                <button class="button primary full" type="button" @click="applyFilter">
                    {{ $t('%bt') }}
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { FramedComponent, useCanPop, usePop, usePopup } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { nextTick } from 'vue';

import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import type { UIFilter } from './UIFilter';

const props = withDefaults(defineProps<{
    filter: UIFilter;
    saveHandler?: ((filter: UIFilter) => void) | null;
    deleteHandler?: (() => void) | null;
}>(), {
    saveHandler: null,
    deleteHandler: null,
});

const pop = usePop();
const popup = usePopup();
const canPop = useCanPop();
const live = !props.saveHandler;
const clonedFilter = live ? props.filter : props.filter.clone();
const filterComponent = clonedFilter.getComponent();
const canDelete = !!props.deleteHandler;
const capitalizeFirstLetter = Formatter.capitalizeFirstLetter.bind(Formatter);

async function applyFilter() {
    if (!props.saveHandler) {
        await pop({ force: true });
        return;
    }

    props.saveHandler(clonedFilter);
    await nextTick();
    await pop({ force: true });
}

async function deleteFilter() {
    if (!props.deleteHandler) {
        return;
    }
    props.deleteHandler();
    await nextTick();
    await pop({ force: true });
}

async function shouldNavigateAway() {
    if (live) {
        return true;
    }

    const changed = JSON.stringify(props.filter.build()) !== JSON.stringify(clonedFilter.build());
    if (!changed) {
        return true;
    }
    return await CenteredMessage.confirm($t(`%yf`), $t(`%4X`));
}

defineExpose({ shouldNavigateAway });
</script>
