<template>
    <button class="button full" :class="primary ? 'primary' : 'secundary'" type="button" :disabled="disabled">
        <span v-if="provider === LoginProviderType.Google" class="icon">
            <img src="@stamhoofd/assets/images/partners/icons/google.svg">
        </span>
        <span>{{ text }}</span>
    </button>
</template>

<script lang="ts" setup>
import { LoginMethodConfig, LoginProviderType } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        provider: LoginProviderType;
        config: LoginMethodConfig;
        primary?: boolean;
        disabled?: boolean;
        fallbackText?: string | null;
    }>(),
    {
        primary: false,
        disabled: false,
        fallbackText: null,
    },
);

const text = computed(() => {
    if (props.config.loginButtonText) {
        return props.config.loginButtonText;
    }

    if (props.fallbackText) {
        return props.fallbackText;
    }

    if (props.provider === LoginProviderType.Google) {
        return $t('%15b');
    }

    return $t('%Zk');
});
</script>
