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
import { Event } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ImageComponent } from '@stamhoofd/components';

defineProps<{
    event: Event
}>();
</script>
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.event-image-box {
    width: 200px;
    border-radius: $border-radius;
    position: relative;
    padding: 40px 0;
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
