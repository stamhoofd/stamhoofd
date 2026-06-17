<template>
    <button v-if="$user" class="button account-switcher" type="button" @click="showContextMenu">
        <figure>
            <div v-color="$user.memberId" class="letter-logo" :data-length="letters.length">
                {{ letters }}
                <span v-if="!letters" class="icon user" />
            </div>

            <span>
                <span class="hide-medium user-name">{{ $user.firstName || 'Account' }}</span>
                <span class="icon arrow-down-small" />
            </span>
        </figure>
    </button>
    <div v-else-if="!isNative && STAMHOOFD.userMode === 'organization' && organization" class="account-swicher-buttons">
        <a v-if="privacyUrl" class="button text limit-space" :href="privacyUrl" target="_blank">
            <span class="icon privacy" />
            <span>{{ $t('Privacy') }}</span>
        </a>
        <a v-if="customSiteUrl" class="button text only-icon-smartphone" :href="customSiteUrl" rel="noopener">
            <span class="icon external" />
            <span>{{ $t('%Xf') }}</span>
        </a>
    </div>
    <div v-else-if="!isNative" class="account-swicher-buttons">
        <a v-if="customSiteUrl" class="button text only-icon-smartphone" :href="customSiteUrl" rel="noopener">
            <span class="icon external" />
            <span>{{ $t('%Xf') }}</span>
        </a>

        <a v-if="!isPlatform" class="button primary" href="/aansluiten">
            {{ $t("%3t") }}
        </a>
    </div>
</template>

<script setup lang="ts" name="AccountSwitcher">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useOrganization } from '../hooks/useOrganization';
import { useUser } from '../hooks/useUser';

const $user = useUser();
const $navigate = useNavigate();
const isNative = AppManager.shared.isNative;
const isPlatform = STAMHOOFD.userMode === 'platform';
const organization = useOrganization();

// todo: this isn't working yet on start
defineRoutes([
    {
        url: 'account',
        component: async () => (await import('../views/AccountSettingsView.vue')).default as any,
        present: 'popup',
    },
]);

const letters = computed(() => {
    return $user.value ? Formatter.firstLetters($user.value.name, 3) : '';
});

const showContextMenu = async () => {
    await $navigate('account');
};

const privacyUrl = computed(() => {
    if (!organization.value) {
        return null;
    }
    if (organization.value.meta.privacyPolicyUrl) {
        return organization.value.meta.privacyPolicyUrl;
    }
    if (organization.value.meta.privacyPolicyFile) {
        return organization.value.meta.privacyPolicyFile.getPublicPath();
    }
    return null;
});

const customSiteUrl = computed(() => {
    if (STAMHOOFD.userMode === 'platform') {
        if (!STAMHOOFD.domains.marketing) {
            return null;
        }
        return 'https://' + LocalizedDomains.marketing;
    }

    if (!organization.value) {
        return null;
    }

    if (AppManager.shared.isOnDashboardDomain) {
        // Not allowed - confusion with Stamhoofd possible
        return null;
    }

    if (!organization.value.website || (!organization.value.website.startsWith('https://') && !organization.value.website.startsWith('http://'))) {
        return null;
    }

    return organization.value.website;
});

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles' as *;

.account-swicher-buttons {
    display: flex;
    flex-direction: row;
    gap: 25px;

    @media (max-width: 600px) {
        gap: 15px;
    }
}

.account-switcher {
    --block-width: 35px;

    .context-navigation-bar & {
        --block-width: 25px;

        .user-name {
            display: none;
        }

        > figure {
            gap: 5px;
        }
    }

    .user-name {
        text-overflow: ellipsis;
        max-width: 12vw;
        overflow: hidden;

        @media (max-width: 1200px) {
            max-width: 10vw;
        }
    }

    @media (hover: hover) {
        &:hover {
            opacity: 0.8;
        }
    }

    &:active {
        opacity: 0.5;
    }

    > figure {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: nowrap;
        white-space: nowrap;
        gap: 15px;

        .icon {
            flex-shrink: 0;
        }

        @media (max-width: 800px) {
            gap: 5px;
        }

        > span {
            display: inline-block;
        }

        > span > span {
            @extend %style-interactive-small;
            display: inline-block;
            vertical-align: middle;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .letter-logo {
        width: var(--block-width, 35px);
        height: var(--block-width, 35px);
        border-radius: calc(var(--block-width, 35px) / 2);
        text-align: center;
        background: $color-primary-light;
        color: $color-primary-dark;
        text-transform: uppercase;
        line-height: var(--block-width, 35px);
        font-size: calc(var(--block-width, 35px) * 0.40);
        font-weight: bold;
        position: relative;

        &[data-length="2"] {
            font-size: calc(var(--block-width, 35px) * 0.32);
        }

        &[data-length="3"] {
            font-size: calc(var(--block-width, 35px) * 0.32);
            letter-spacing: -0.5px;
        }
    }
}
</style>
