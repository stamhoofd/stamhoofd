<template>
    <div>
        <picture v-if="horizontalLogo" class="organization-logo horizontal hide-smartphone" :class="{expand }">
            <source 
                v-if="horizontalLogoDark && (darkMode === 'Auto' || darkMode === 'On')"
                :srcset="logoHorizontalSrcSet(horizontalLogoDark)"
                :media="darkMode === 'Auto' ? '(prefers-color-scheme: dark)' : ''"

                :width="getHorizontalResolution(horizontalLogoDark).width"
                :height="getHorizontalResolution(horizontalLogoDark).height"
            >
            <img 
                :src="logoHorizontalSrc" :srcset="logoHorizontalSrcSet(horizontalLogo)"
                :width="getHorizontalResolution(horizontalLogo).width"
                :height="getHorizontalResolution(horizontalLogo).height"
                :alt="name"
            >
        </picture>

        <picture v-if="squareLogo" class="organization-logo only-smartphone" :class="{expand }">
            <source 
                v-if="darkMode === 'Auto' || darkMode === 'On'"
                :srcset="logoSrcSet(squareLogoDark)"
                :media="darkMode === 'Auto' ? '(prefers-color-scheme: dark)' : ''"

                :width="getResolution(squareLogoDark).width"
                :height="getResolution(squareLogoDark).height"
            >
            <img 
                :src="logoSrc" :srcset="logoSrcSet(squareLogo)"
                :width="getResolution(squareLogo).width"
                :height="getResolution(squareLogo).height"
                :alt="name"
            >
        </picture>

        <span v-if="!horizontalLogo && !squareLogo" class="organization-logo-text">
            {{ name }}
        </span>
    </div>
</template>

<script lang="ts">
import { DarkMode, Image, OrganizationMetaData, WebshopMetaData } from "@stamhoofd/structures";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class OrganizationLogo extends Vue {
    @Prop({ required: true })
        metaData!: OrganizationMetaData | WebshopMetaData

    @Prop({ required: true })
        name!: string

    created() {
        // Inject favicon if no favicon is present
        if (!document.querySelector("link[rel='icon']")) {
            const resolution = this.squareLogo?.getResolutionForSize(256, 256);

            if (resolution && resolution.width === resolution.height) {
                const path = resolution.file.getPublicPath();
                const link = document.createElement("link");
                link.rel = "icon";
                link.href = path;
                link.type = path.endsWith('.png') ? "image/png" : (path.endsWith('.svg') ? "image/svg+xml" : "image/jpeg");
                document.head.appendChild(link);
            }
        }
    }

    get expand() {
        return this.metaData.expandLogo
    }

    get darkMode() {
        return (this.metaData as any).darkMode ?? DarkMode.Off
    }

    get horizontalLogo() {
        return this.metaData.horizontalLogo ?? this.metaData.squareLogo ?? this.metaData.horizontalLogoDark ?? this.metaData.squareLogoDark
    }

    get horizontalLogoDark() {
        return this.metaData.horizontalLogoDark ?? this.metaData.squareLogoDark ?? this.metaData.horizontalLogo ?? this.metaData.squareLogo
    }

    get squareLogo() {
        return this.metaData.squareLogo ?? this.metaData.horizontalLogo ?? this.metaData.squareLogoDark ?? this.metaData.horizontalLogoDark
    }

    get squareLogoDark() {
        return this.metaData.squareLogoDark ?? this.metaData.horizontalLogoDark ?? this.metaData.squareLogo ?? this.metaData.horizontalLogo
    }

    get logoSrc() {
        if (!this.metaData.squareLogo) {
            return null
        }
        if (this.metaData.expandLogo) {
            return this.metaData.squareLogo.getPathForSize(undefined, 70)
        }
        return this.metaData.squareLogo.getPathForSize(undefined, 50)
    }

    get logoHorizontalSrc() {
        if (!this.metaData.horizontalLogo) {
            return null
        }
        if (this.metaData.expandLogo) {
            return this.metaData.horizontalLogo.getPathForSize(undefined, 70)
        }
        return this.metaData.horizontalLogo.getPathForSize(undefined, 50)
    }

    getHorizontalResolution(image: Image) {
        if (this.expand) {
            return image.getResolutionForSize(undefined, 70)
        }
        return image.getResolutionForSize(undefined, 40)
    }

    getResolution(image: Image) {
        if (this.expand) {
            return image.getResolutionForSize(undefined, 70)
        }
        return image.getResolutionForSize(undefined, 50)
    }

    logoHorizontalSrcSet(image) {
        if (this.expand) {
            return image.getPathForSize(undefined, 70) + " 1x, "+image.getPathForSize(undefined, 70*2)+" 2x, "+image.getPathForSize(undefined, 70*3)+" 3x"
        }
        return image.getPathForSize(undefined, 40) + " 1x, "+image.getPathForSize(undefined, 40*2)+" 2x, "+image.getPathForSize(undefined, 40*3)+" 3x"
    }

    logoSrcSet(image) {
        if (this.expand) {
            return image.getPathForSize(undefined, 70) + " 1x, "+image.getPathForSize(undefined, 70*2)+" 2x, "+image.getPathForSize(undefined, 70*3)+" 3x"
        }
        return image.getPathForSize(undefined, 50) + " 1x, "+image.getPathForSize(undefined, 50*2)+" 2x, "+image.getPathForSize(undefined, 50*3)+" 3x"
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

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

.organization-logo {
    img {
        height: auto;
        width: auto;

        max-height: 50px;
        max-width: 70px;
    }

    &.expand {
        img {
            max-height: 70px;
            max-width: 100px;

            @media (max-width: 300px) {
                max-width: 35vw;
            }
        }
    }

    &.horizontal {
        img {
            max-height: 50px;
            max-width: 35vw;
        }

        &.expand {
            img {
                max-height: 70px;
            }
        }
    }
}
</style>