<template>
    <div>
        <img v-if="logoHorizontalSrc" :src="logoHorizontalSrc" :srcset="logoHorizontalSrcSet" class="organization-logo horizontal" :class="{ 'hide-smartphone': !!logoSrc }">
        <img v-if="logoSrc" :src="logoSrc" :srcset="logoSrcSet" class="organization-logo" :class="{ 'only-smartphone': !!logoHorizontalSrc }">
        <template v-if="!logoHorizontalSrc && !logoSrc">
            {{ organization.name }}
        </template>
    </div>
</template>



<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';

@Component
export default class OrganizationLogo extends Vue {
    get organization() {
        return OrganizationManager.organization
    }

    get logoSrc() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 44)
    }

    get logoSrcSet() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 44) + " 1x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 44*2)+" 2x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 44*3)+" 3x"
    }

     get logoHorizontalSrc() {
        if (!this.organization.meta.horizontalLogo) {
            return null
        }
        return this.organization.meta.horizontalLogo.getPathForSize(undefined, 44)
    }

    get logoHorizontalSrcSet() {
        if (!this.organization.meta.horizontalLogo) {
            return null
        }
        return this.organization.meta.horizontalLogo.getPathForSize(undefined, 44) + " 1x, "+this.organization.meta.horizontalLogo.getPathForSize(undefined, 44*2)+" 2x, "+this.organization.meta.horizontalLogo.getPathForSize(undefined, 44*3)+" 3x"
    }
}
</script>

<style lang="scss">
    .organization-logo {
        max-height: 44px;
        max-width: 44px;

        &.horizontal {
            max-width: 30vw
        }
    }
</style>