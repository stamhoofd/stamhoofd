<template>
    <!-- eslint-disable-next-line vue/no-v-html -> cleaned in backend -->
    <div v-if="STAMHOOFD.platformName !== 'stamhoofd'" class="webshop-platform-footer style-wysiwyg gray no-underline-links" v-html="platform.config.shopFooterText.html" />
    <div v-else class="webshop-platform-footer stamhoofd-badge">
        <a :href="'https://'+ LocalizedDomains.marketing +'?utm_medium=webshop'">{{ $t('%Zkw') }} <Logo /></a>
    </div>
</template>

<script lang="ts" setup>
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import Logo from '@stamhoofd/components/icons/Logo.vue';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';

/**
 * The footer text of the platform (or the Stamhoofd badge), shown right below the ordering part of the webshop
 */
const platform = usePlatform();
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

// Above the space below a stuck order button (WebshopProducts), which can reach a few pixels below the products at the end of the page
.webshop-platform-footer {
    position: relative;
    z-index: 1;
}

.stamhoofd-badge {
    padding-top: 15px;
    --color-primary: #{$color-primary-original};
    text-align: center;

    > a {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        min-width: 0;
        max-width: none;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 12px;

        svg {
            height: 20px;
            width: auto;
        }

        &,
        &:hover,
        &:link,
        &:active,
        &:visited {
            color: $color-gray-text;
            font-weight: 600;
            text-decoration: none;
        }
    }
}

// The cart button and the ordering part below the content already end with 15px spacing: the badge stays as close to the button as next to the content
.webshop-cart-button + .stamhoofd-badge,
.modern-webshop-view > main > :is(.webshop-products, .cart-item-view) + .stamhoofd-badge {
    padding-top: 0;
}
</style>
