<template>
    <button v-if="$user" class="button account-switcher" type="button" @click="showContextMenu">
        <figure>
            <div class="letter-logo" :data-length="letters.length" v-color="$user.memberId">
                {{ letters }}
                <span class="icon user" v-if="!letters" />
            </div>

            <span>
                <span class="hide-medium">{{ $user.name || 'Account' }}</span>
                <span class="icon arrow-down-small" />
            </span>
        </figure>
    </button>
</template>

<script setup lang="ts" name="AccountSwitcher">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

import { useUser } from '../hooks';

const $user = useUser();
const $navigate = useNavigate();

// todo: this isn't working yet on start
defineRoutes([
    {
        url: 'account',
        component: async () => (await import('../views/AccountSettingsView.vue')).default as any,
        present: "popup"
    }
])

const letters = computed(() => {
    return $user.value ? Formatter.firstLetters($user.value.name, 3) : ''
});

const showContextMenu = () => {
    $navigate('account');
};

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles' as *;

.account-switcher {
    &:hover {
        opacity: 0.8;
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
