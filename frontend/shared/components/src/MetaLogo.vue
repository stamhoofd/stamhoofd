<template>
    <div>
        <picture v-if="horizontalLogo" class="organization-logo horizontal" :class="{expand, 'hide-smartphone': !!squareLogo}">
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

        <picture v-if="squareLogo" class="organization-logo" :class="{expand, 'only-smartphone': !!horizontalLogo}">
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
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";
import { DarkMode, Image, OrganizationMetaData, WebshopMetaData } from "@stamhoofd/structures";

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
        return this.metaData.horizontalLogo ?? this.metaData.horizontalLogoDark;
    }

    get horizontalLogoDark() {
        return this.metaData.horizontalLogoDark ?? this.metaData.horizontalLogo;
    }

    get squareLogo() {
        return this.metaData.squareLogo ?? this.metaData.squareLogoDark
    }

    get squareLogoDark() {
        return this.metaData.squareLogoDark ?? this.metaData.squareLogo
    }

    get logoSrc() {
        if (!this.metaData.squareLogo) {
            return null
        }
        if (this.metaData.expandLogo) {
            return this.metaData.squareLogo.getPathForSize(100, 70)
        }
        return this.metaData.squareLogo.getPathForSize(70, 50)
    }

    get logoHorizontalSrc() {
        if (!this.metaData.horizontalLogo) {
            return null
        }
        if (this.metaData.expandLogo) {
            return this.metaData.horizontalLogo.getPathForSize(undefined, 70)
        }
        return this.metaData.horizontalLogo.getPathForSize(150, 50)
    }

    getHorizontalResolution(image: Image) {
        if (this.expand) {
            return image.getResolutionForSize(undefined, 70)
        }
        return image.getResolutionForSize(150, 50)
    }

    getResolution(image: Image) {
        if (this.expand) {
            return image.getResolutionForSize(100, 70)
        }
        return image.getResolutionForSize(70, 50)
    }

    logoHorizontalSrcSet(image) {
        if (this.expand) {
            return image.getPathForSize(undefined, 70) + " 1x, "+image.getPathForSize(undefined, 70*2)+" 2x, "+image.getPathForSize(undefined, 70*3)+" 3x"
        }
        return image.getPathForSize(150, 50) + " 1x, "+image.getPathForSize(150*2, 50*2)+" 2x, "+image.getPathForSize(150*3, 50*3)+" 3x"
    }

    logoSrcSet(image) {
        if (this.expand) {
            return image.getPathForSize(100, 70) + " 1x, "+image.getPathForSize(100*2, 70*2)+" 2x, "+image.getPathForSize(100*3, 70*3)+" 3x"
        }
        return image.getPathForSize(70, 50) + " 1x, "+image.getPathForSize(70*2, 50*2)+" 2x, "+image.getPathForSize(70*3, 50*3)+" 3x"
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
        object-fit: contain;
        object-position: left center;
        height: 50px;
        width: 70px;
    }

    &.expand {
        img {
            height: 70px;
            width: 100px;

            @media (max-width: 300px) {
                width: 40vw;
            }
        }
    }

    &.horizontal {
        img {
            height: 50px;
            width: 38vw;
            width: min(150px, 38vw);
        }

        &.expand {
            img {
                height: 70px;
                width: 38vw;
            }
        }
    }
}
</style>
