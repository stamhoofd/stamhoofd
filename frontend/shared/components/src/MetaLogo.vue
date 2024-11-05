<template>
    <div class="meta-logo" :class="{expand: metaData.expandLogo}">
        <ImageComponent v-if="logo" :image="logo" :image-dark="logoDark"/>
        <template v-else>
            <span class="organization-logo-text">{{ name }}</span>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ImageComponent, useDeviceWidth } from '@stamhoofd/components';
import { OrganizationMetaData, WebshopMetaData } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    metaData: OrganizationMetaData | WebshopMetaData;
    name: string;
}>();

const width = useDeviceWidth();

const logo = computed(() => width.value > 800 ? (props.metaData.horizontalLogo ?? props.metaData.squareLogo) : (props.metaData.squareLogo ?? props.metaData.horizontalLogo));
const logoDark = computed(() => width.value > 800 ? (props.metaData.horizontalLogoDark ?? props.metaData.squareLogoDark) : (props.metaData.squareLogoDark ?? props.metaData.horizontalLogoDark));

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.organization-logo-text {
    color: $color-dark;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    max-width: 40vw;
    display: block;
    font-size: 16px;
}

.meta-logo {
    height: 40px;
    width: 100%;
    position: relative;
    display: block;
    max-width: 200px;
    line-height: 40px;

    &.expand {
        height: 60px;
        max-width: 50vw;
        line-height: 60px;
    }

    > .image-component {
        height: 100%;
        width: 100%;
        position: absolute;
        left: 0;
        top: 0;

        img {
            object-position: left center;
        }
    }
}
</style>
