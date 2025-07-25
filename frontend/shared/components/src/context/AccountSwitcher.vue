<template>
    <button v-if="$user" class="button account-switcher" type="button" @click="showContextMenu">
        <figure>
            <div v-color="$user.memberId" class="letter-logo" :data-length="letters.length">
                {{ letters }}
                <span v-if="!letters" class="icon user" />
            </div>

            <span>
                <span class="hide-medium">{{ $user.name || 'Account' }}</span>
                <span class="icon arrow-down-small" />
            </span>
        </figure>
    </button>
    <template v-else-if="!isNative">
        <a class="button text only-icon-smartphone" :href="'https://'+$domains.marketing+''" rel="noopener">
            <span class="icon external" />
            <span>{{ $t('6de2861f-64bc-44fe-af80-5742c91d03d6') }}</span>
        </a>

        <a v-if="!isPlatform" class="button primary" href="/aansluiten">
            {{ $t("2cd40bd9-b158-42e3-81e2-c02c560ab2e5") }}
        </a>
    </template>
</template>

<script setup lang="ts" name="AccountSwitcher">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

import { AppManager } from '@stamhoofd/networking';
import { useUser } from '../hooks';

const $user = useUser();
const $navigate = useNavigate();
const isNative = AppManager.shared.isNative;
const isPlatform = STAMHOOFD.userMode === 'platform';

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

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles' as *;

.account-switcher {
    --block-width: 35px;

    .context-navigation-bar & {
        --block-width: 25px;
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
        gap: 15px;

        @media (max-width: 800px) {
            gap: 5px;
        }

        > span {
            display: inline-block;
        }

        > span > span {
            @extend .style-interactive-small;
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
