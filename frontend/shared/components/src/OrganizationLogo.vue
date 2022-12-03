<template>
    <div>
        <img v-if="logoHorizontalSrc" :src="logoHorizontalSrc" :srcset="logoHorizontalSrcSet" class="organization-logo horizontal" :class="{ 'hide-smartphone': !!logoSrc, expand }">
        <img v-if="logoSrc" :src="logoSrc" :srcset="logoSrcSet" class="organization-logo" :class="{ 'only-smartphone': !!logoHorizontalSrc, expand }">
        <template v-if="!logoHorizontalSrc && !logoSrc">
            {{ organization.name }}
        </template>
    </div>
</template>

<script lang="ts">
import { Organization } from "@stamhoofd/structures";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class OrganizationLogo extends Vue {
    @Prop({ required: true })
    organization!: Organization

    get expand() {
        return this.organization.meta.expandLogo
    }

    get logoSrc() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        if (this.organization.meta.expandLogo) {
            return this.organization.meta.squareLogo.getPathForSize(undefined, 70)
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 50)
    }

    get logoSrcSet() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        if (this.organization.meta.expandLogo) {
            return this.organization.meta.squareLogo.getPathForSize(undefined, 70) + " 1x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 70*2)+" 2x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 70*3)+" 3x"
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 50) + " 1x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 50*2)+" 2x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 50*3)+" 3x"
    }

    get logoHorizontalSrc() {
        if (!this.organization.meta.horizontalLogo) {
            return null
        }
        if (this.organization.meta.expandLogo) {
            return this.organization.meta.horizontalLogo.getPathForSize(undefined, 70)
        }
        return this.organization.meta.horizontalLogo.getPathForSize(undefined, 50)
    }

    get logoHorizontalSrcSet() {
        if (!this.organization.meta.horizontalLogo) {
            return null
        }
        if (this.organization.meta.expandLogo) {
            return this.organization.meta.horizontalLogo.getPathForSize(undefined, 70) + " 1x, "+this.organization.meta.horizontalLogo.getPathForSize(undefined, 70*2)+" 2x, "+this.organization.meta.horizontalLogo.getPathForSize(undefined, 70*3)+" 3x"
        }
        return this.organization.meta.horizontalLogo.getPathForSize(undefined, 40) + " 1x, "+this.organization.meta.horizontalLogo.getPathForSize(undefined, 40*2)+" 2x, "+this.organization.meta.horizontalLogo.getPathForSize(undefined, 40*3)+" 3x"
    }
}
</script>

<style lang="scss">
    .organization-logo {
        max-height: 50px;
        max-width: 70px;

        &.expand {
            max-height: 70px;
            max-width: 100px;

            @media (max-width: 300px) {
                max-width: 30vw;
            }
        }

        &.horizontal {
            max-height: 50px;
            max-width: 30vw;

            &.expand {
                max-height: 70px;
            }
        }
    }
</style>