<template>
    <figure class="organization-avatar">
        <div v-if="logoSrc" class="logo">
            <img :src="logoSrc" :srcset="logoSrcSet">
        </div>
        <div v-else class="letter-logo" :data-length="letters.length">
            {{ letters }}
        </div>
    </figure>
</template>

<script lang="ts">
import { Organization } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Prop, Vue } from "vue-property-decorator";

import { ColorHelper } from "./ColorHelper";

@Component
export default class OrganizationAvatar extends Vue {
    @Prop({ required: true })
    organization!: Organization

    width = 40

    mounted() {
        if (this.organization.meta.color) {
            ColorHelper.setColor(this.organization.meta.color, this.$el as HTMLElement);
        }

        this.width = parseInt(getComputedStyle(this.$el).getPropertyValue('--block-width') ?? 40);
    }

    get letters() {
        return Formatter.firstLetters(this.organization.name, 3)
    }

    get logoSrc() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(this.width, this.width)
    }

    get logoSrcSet() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(this.width, this.width) + " 1x, "+this.organization.meta.squareLogo.getPathForSize(this.width*2, this.width*2)+" 2x, "+this.organization.meta.squareLogo.getPathForSize(this.width*3, this.width*3)+" 3x"
    }
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;

.organization-avatar {
    .letter-logo {
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: $border-radius;
        text-align: center;
        background: $color-primary-light;
        color: $color-primary;
        text-transform: uppercase;
        line-height: var(--block-width, 40px);
        font-size: calc(var(--block-width, 40px) * 0.40);
        font-weight: bold;
        position: relative;

        &[data-length="2"] {
            font-size: calc(var(--block-width, 40px) * 0.3);
        }

        &[data-length="3"] {
            font-size: calc(var(--block-width, 40px) * 0.3);
        }
    }

    .logo {
        img {
            width: var(--block-width, 40px);
            height: var(--block-width, 40px);
            object-fit: contain;
        }
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: $border-radius;
        overflow: hidden;
        //background: $color-background;
        //box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.05), 0px 2px 15px rgba(0, 0, 0, 0.05);
        position: relative;

        &::after {
            border-radius: 12px;
            // inset box shadow doesn't work over img tags
            //box-shadow: inset 0px 0px 0px 2px rgba(0, 0, 0, 0.2);
            content: '';
            display: block;
            height: 100%;
            position: absolute;
            top: 0;
            width: 100%;

            mix-blend-mode: luminosity;
        }
    }
}
</style>