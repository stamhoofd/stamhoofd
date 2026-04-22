<template>
    <LoadingBoxTransition v-if="actions.length || loading" :error-box="errorBox">
        <div v-if="actions.length && !loading" key="view" class="container">
            <hr><h2>
                {{ $t('%ht') }}
            </h2>

            <STList>
                <STListItem v-for="(action, index) of actionsInList" :key="index" class="left-center right-stack" :selectable="true" @click="action.action">
                    <template #left>
                        <component :is="action.leftComponent" v-bind="action.leftProps || {}" v-if="action.leftComponent" />
                        <img v-else :src="action.illustration" class="style-illustration-img">
                    </template>
                    <p v-if="action.prefix" class="style-title-prefix-list">
                        {{ action.prefix }}
                    </p>
                    <h3 class="style-title-list">
                        {{ action.title }}
                    </h3>
                    <p v-if="action.description" class="style-description-small">
                        {{ action.description }}
                    </p>

                    <template #right>
                        <span v-if="action.rightText" :class="action.rightTextClass ?? ''">
                            {{ action.rightText }}
                        </span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </div>

        <div v-if="shouldShowButton" class="style-button-bar">
            <button v-if="isShowAll" class="button text" type="button" @click="toggleShowAll">
                {{ $t('Toon minder') }}
            </button>
            <button v-else class="button text" type="button" @click="toggleShowAll">
                {{ $t('Toon {extra} meer', {extra: actions.length - props.maxActionsToShow}) }}
            </button>
        </div>
    </LoadingBoxTransition>
</template>

<script setup lang="ts">
import { computed, ref, unref } from 'vue';
import { LoadingBoxTransition } from '../containers';
import type { QuickActions } from './classes/QuickActions';

const props = withDefaults(defineProps<{
    quickActions: QuickActions;
    /**
     * Maximum number of actions to show in the list.
     * If the limit is exceeded, a button will appear to see al the actions in a new view.
     */
    maxActionsToShow?: number;
}>(), {
    maxActionsToShow: 20
});

const actions = computed(() => unref(props.quickActions.actions));
const isShowAll = ref(false);
const actionsInList = computed(() => isShowAll.value ? actions.value : actions.value.slice(0, props.maxActionsToShow));
const shouldShowButton = computed(() => actions.value.length > props.maxActionsToShow);
const errorBox = computed(() => unref(props.quickActions.errorBox));
const loading = computed(() => unref(props.quickActions.loading));

function toggleShowAll() {
    isShowAll.value = !isShowAll.value;
}
</script>
