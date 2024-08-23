<template>
    <figure class="style-icon-with-progress" :class="{complete: isComplete}">
        <figure>
            <div class="primary-icon-container">
                <span class="icon" :class="icon" />
            </div>
        </figure>
        <aside v-if="secondaryIcon && secondaryIcon !== SecondaryIcon.None">
            <ProgressRing v-if="secondaryIcon === SecondaryIcon.InProgress" :progress="percentage" :radius="8" :stroke="3" :border-width="2" />
            <CountRing v-else-if="secondaryIcon === SecondaryIcon.Count" :count="progress.count" :radius="8" :stroke="3" :border-width="2"/>
            <span v-else class="icon small" :class="secondaryIcon" />
        </aside>
    </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CountRing from './CountRing.vue';
import ProgressRing from './ProgressRing.vue';

enum SecondaryIcon {
    Help = 'help',
    InProgress = 'clock',
    Error = 'error',
    Success = 'success',
    None = 'none',
    Count = 'count'
}

const props = 
    defineProps<{
        icon: string;
        isReviewed?: boolean,
        hasWarning?: boolean,
        isOptional?: boolean,
        progress: {
            count: number,
            total: number | null
        };
    }>();

const percentage = computed(() => {
    const {count, total} = props.progress;
    if(!total) return 1;
    return count / total;
})

const isComplete = computed(() => secondaryIcon.value === SecondaryIcon.Success || secondaryIcon.value === SecondaryIcon.Count);

const secondaryIcon = computed(() => {
    const {count, total} = props.progress;

    if(props.hasWarning) return SecondaryIcon.Help;

    if(total === null) {
        if(props.isOptional) {
            if(count === 0) return SecondaryIcon.None;
            return SecondaryIcon.Count;
        }
        return SecondaryIcon.Success;
    }

    if(count === total) {
        if(props.isReviewed) return SecondaryIcon.Success;
        return SecondaryIcon.None;
    }
    if(count > total) return SecondaryIcon.Error;
    return SecondaryIcon.InProgress;
});
</script>
