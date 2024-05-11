<template>
    <button v-if="$user" class="button account-switcher" type="button" @click="showContextMenu">
        <figure>
            <div class="letter-logo" :data-length="letters.length">
                {{ letters }}
            </div>
        </figure>
    </button>
</template>

<script setup lang="ts" name="AccountSwitcher">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

import { useUser } from '../VueGlobalHelper';

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
    return $user.value ? Formatter.firstLetters($user.value.name, 1) : ''
});

const showContextMenu = () => {
    $navigate('account');
};

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.account-switcher {
    &:hover {
        opacity: 0.8;
    }

    &:active {
        opacity: 0.5;
    }

    .letter-logo {
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: calc(var(--block-width, 40px) / 2);
        text-align: center;
        background: $color-primary-light;
        color: $color-primary-dark;
        text-transform: uppercase;
        line-height: var(--block-width, 40px);
        font-size: calc(var(--block-width, 40px) * 0.40);
        font-weight: bold;
        position: relative;

        &[data-length="2"] {
            font-size: calc(var(--block-width, 40px) * 0.32);
        }

        &[data-length="3"] {
            font-size: calc(var(--block-width, 40px) * 0.32);
            letter-spacing: -0.5px;
        }
    }
}
</style>
