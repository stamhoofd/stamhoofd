<template>
    <template v-if="enabledActions.length">
        <template v-if="title">
            <hr><h2>{{ title }}</h2>
        </template>

        <STList>
            <STListItem v-for="(action, index) in enabledActions" :key="index" :selectable="true" :class="action.theme" :data-testid="action.testId" @click="action.action">
                <template #left>
                    <IconContainer :icon="action.icon" :class="action.iconClass">
                        <template v-if="action.asideIcon" #aside>
                            <span :class="'icon ' + action.asideIcon" />
                        </template>
                    </IconContainer>
                </template>

                <h2 class="style-title-list">
                    {{ action.name }}
                </h2>
                <p v-if="action.description" class="style-description-small">
                    {{ action.description }}
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </template>
</template>

<script lang="ts">
export interface ActionButton {
    /** Title of the action */
    name: string;
    /** Optional description shown below the title */
    description?: string;
    /** Main icon shown in the IconContainer */
    icon: string;
    /** Color theme class applied to the IconContainer (e.g. 'error', 'primary', 'success') */
    iconClass?: string;
    /** Small icon shown in the corner of the IconContainer (e.g. 'undo small') */
    asideIcon?: string;
    /** Optional extra class applied to the list item (e.g. 'theme-error') */
    theme?: string;
    /** Optional data-testid for the list item */
    testId?: string;
    /** Whether the action should be shown. Disabled actions are not rendered. */
    enabled: boolean;
    action: () => void | Promise<void>;
}
</script>

<script lang="ts" setup>
import IconContainer from '#icons/IconContainer.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    /** Optional section title. When omitted, no title or separator is rendered. */
    title?: string;
    actions: ActionButton[];
}>(), {
    title: '',
});

const enabledActions = computed(() => props.actions.filter(action => action.enabled));
</script>
