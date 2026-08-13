<template>
    <div class="crowdfunding-bar">
        <div v-if="crowdfunding.goalAmount" class="progress-bar">
            <div class="progress" :style="{width: progress.toFixed(2) + '%'}" />
        </div>

        <div class="split">
            <div>
                <h3 class="style-definition-label">
                    {{ $t('%Zkj') }}
                </h3>
                <p class="style-definition-text">
                    {{ formatPrice(crowdfunding.progressAmount + crowdfunding.pendingAmount) }}
                </p>
            </div>

            <div v-if="crowdfunding.goalAmount">
                <h3 class="style-definition-label">
                    {{ $t('%Zkd') }}
                </h3>
                <p class="style-definition-text">
                    {{ formatPrice(crowdfunding.goalAmount) }}
                </p>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { WebshopCrowdfunding } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    crowdfunding: WebshopCrowdfunding;
}>();

const progress = computed(() => {
    if (!props.crowdfunding.goalAmount) {
        return 100;
    }
    return Math.max(0, Math.min(100, (props.crowdfunding.progressAmount + props.crowdfunding.pendingAmount) / props.crowdfunding.goalAmount * 100));
});

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.crowdfunding-bar {
    .progress-bar {
        background: $color-border;
        height: 6px;
        overflow: hidden;
        margin: 15px 0;
        position: relative;
        border-radius: 10px;

        .progress {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: $color-primary;
            border-radius: 10px;
        }

        .pending-progress {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: $color-primary-gray-light;
            border-radius: 10px;
        }
    }

    .split {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 15px;
    }
}
</style>
