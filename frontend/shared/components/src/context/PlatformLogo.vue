<template>
    <a alt="Stamhoofd" :href="'https://'+$t('shared.domains.marketing')+''" rel="noopener" class="platform-logo" :class="{expand: platform.config.expandLogo}">
        <ImageComponent v-if="logo" :image="logo" :image-dark="logoDark" />
        <template v-else>
            <Logo class="responsive" />
            <span v-if="!isPlatform" class="logo-text horizontal hide-medium">Beheerders</span>
        </template>
    </a>
</template>

<script setup lang="ts">
import { ImageComponent, Logo, useDeviceWidth, usePlatform } from '@stamhoofd/components';
import { computed } from 'vue';

const isPlatform = STAMHOOFD.userMode === 'platform'

const platform = usePlatform()
const width = useDeviceWidth()

const logo = computed(() => width.value > 800 ? (platform.value.config.horizontalLogo ?? platform.value.config.squareLogo) : (platform.value.config.squareLogo ?? platform.value.config.horizontalLogo))
const logoDark = computed(() => width.value > 800 ? (platform.value.config.horizontalLogoDark ?? platform.value.config.squareLogoDark) : (platform.value.config.squareLogoDark ?? platform.value.config.horizontalLogoDark))

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
