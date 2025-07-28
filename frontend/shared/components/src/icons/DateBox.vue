<template>
    <div class="date-image-box">
        <div class="overlay">
            <span v-if="date" class="day">{{ Formatter.day(date) }}</span>
            <span v-if="date" class="month">{{ Formatter.capitalizeFirstLetter(Formatter.month(date)) }}</span>
            <span v-if="!date" class="month">{{ $t('Geen datum') }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Formatter } from '@stamhoofd/utility';

defineProps<{
    date?: Date;
}>();
</script>
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.date-image-box {
    width: 150px;
    height: 80px;
    border-radius: $border-radius;
    position: relative;
    padding: 15px 0;
    border-radius: 5px;
    overflow: hidden;
    background: $color-background-shade;
    margin-right: 15px;
    border: 1px solid $color-border;

    @media (max-width: 450px) {
        width: 100%;
        margin-right: 0;
    }

    .overlay {
        text-align: center;

        // Add these flexbox styles:
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;

        height: 100%; // Ensure it fills the container

        .day {
            display: block;
            font-size: 35px;
            font-weight: bold;
        }

        .month {
            display: block;
            font-size: 15px;
            color: $color-gray-1;
        }
    }

    .event-image {
        position: absolute;
        z-index: 1;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        touch-action: none;
        pointer-events: none;

        img {
            object-fit: cover;
        }
    }
}

</style>
