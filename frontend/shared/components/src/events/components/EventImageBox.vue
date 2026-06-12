<template>
    <div class="event-image-box">
        <div class="overlay">
            <span class="day">{{ Formatter.day(event.startDate) }}</span>
            <span class="month">{{ Formatter.capitalizeFirstLetter(Formatter.month(event.startDate)) }}</span>
        </div>
        <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" class="event-image" />
    </div>
</template>

<script setup lang="ts">
import type { Event } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import ImageComponent from '#views/ImageComponent.vue';

defineProps<{
    event: Event;
}>();
</script>
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.event-image-box {
    width: 150px;
    border-radius: $border-radius;
    position: relative;
    padding: 0;
    aspect-ratio: 150 / 116;
    border-radius: 5px;
    overflow: hidden;
    background: $color-background-shade;
    margin-right: 15px;
    border: 1px solid $color-border;

    @media (max-width: 600px) {
        width: 25vw;
        margin-right: 0;
    }

    @media (max-width: 350px) {
        width: 100%;
        margin-right: 0;
    }

    .overlay {
        text-align: center;
        display: flex;
        height: 100%;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        .day {
            display: block;
            font-size: 28px;
            font-weight: bold;
            line-height: 1.1;
            padding-bottom: 5px;

            @media (max-width: 500px) {
                font-size: 5vw;
            }
        }

        .month {
            display: block;
            font-size: 15px;
            color: $color-gray-1;
            padding-bottom: 5px; // visual correction;
            line-height: 1;
            font-weight: 600;
            text-transform: uppercase;

            @media (max-width: 500px) {
                font-size: 3vw;
            }
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
