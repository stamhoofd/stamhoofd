<template>
    <LoadingBoxTransition v-if="actions.length || loading" :error-box="errorBox">
        <div v-if="actions.length && !loading" key="view" class="container">
            <hr><h2>
                {{ $t('5400f4c3-d47a-44c9-b53a-62d0111c6d98') }}
            </h2>

            <STList>
                <STListItem v-for="action of actions" class="left-center right-stack" :selectable="true" @click="action.action">
                    <template #left>
                        <component :is="action.leftComponent" v-bind="action.leftProps || {}" v-if="action.leftComponent" />
                        <img v-else :src="action.illustration" class="style-illustration-img">
                    </template>
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
    </LoadingBoxTransition>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue';
import { LoadingBoxTransition } from '../containers';
import { QuickActions } from './classes/QuickActions';

const props = defineProps<{
    quickActions: QuickActions;
}>();

const actions = computed(() => unref(props.quickActions.actions));
const errorBox = computed(() => unref(props.quickActions.errorBox));
const loading = computed(() => unref(props.quickActions.loading));

</script>
