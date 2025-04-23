<template>
    <a alt="Stamhoofd" :href="'https://'+$domains.marketing+''" rel="noopener" class="platform-logo" :class="{expand: logo && platform.config.expandLogo, center: !logo}">
        <ImageComponent v-if="logo" :image="logo" :image-dark="logoDark" />
        <template v-else>
            <Logo class="responsive" />
            <span v-if="!isPlatform" class="logo-text horizontal hide-medium">{{ $t('05dff2a6-72fa-4054-ab7f-8e04dc7c7ed9') }}</span>
        </template>
    </a>
</template>

<script setup lang="ts">
import { ImageComponent, Logo, useDeviceWidth, usePlatform } from '@stamhoofd/components';
import { computed } from 'vue';

const isPlatform = STAMHOOFD.userMode === 'platform';

const platform = usePlatform();
const width = useDeviceWidth();

const logo = computed(() => width.value > 800 ? (platform.value.config.horizontalLogo ?? platform.value.config.squareLogo) : (platform.value.config.squareLogo ?? platform.value.config.horizontalLogo));
const logoDark = computed(() => width.value > 800 ? (platform.value.config.horizontalLogoDark ?? platform.value.config.squareLogoDark) : (platform.value.config.squareLogoDark ?? platform.value.config.horizontalLogoDark));

</script>

<style lang="scss">
.platform-logo {
    height: 40px;
    width: 100%;
    position: relative;
    display: block;

    &.expand {
        height: 60px;
    }

    &.center {
        align-items: center;
        display: flex;
        justify-content: flex-start;
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
