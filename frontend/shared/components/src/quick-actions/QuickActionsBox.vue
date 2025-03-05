<template>
    <LoadingBoxTransition :error-box="errorBox" v-if="actions.length || loading">
        <div v-if="actions.length" class="container" key="view">
            <hr><h2>
                {{ $t('7828f075-060e-45bd-917a-2b0b616bb897') }}
            </h2>

            <STList>
                <STListItem v-for="action of actions" class="left-center right-stack" :selectable="true" @click="action.action">
                    <template #left>
                        <component :is="action.leftComponent" v-if="action.leftComponent"/>
                        <img v-else :src="action.illustration" class="style-illustration-img"></template>
                    <h3 class="style-title-list">
                        {{ action.title }}
                    </h3>
                    <p v-if="action.description" class="style-description-small">
                        {{ action.description }}
                    </p>

                    <template #right>
                        <span :class="action.rightTextClass ?? ''" v-if="action.rightText">
                            {{ action.rightText }}
                        </span>
                        <span class="icon arrow-right-small gray"/>
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
    quickActions: QuickActions
}>();

const actions = computed(() => unref(props.quickActions.actions));
const errorBox = computed(() => unref(props.quickActions.errorBox));
const loading = computed(() => unref(props.quickActions.loading));

</script>
