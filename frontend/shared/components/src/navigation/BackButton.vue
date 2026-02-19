<template>
    <button v-if="$isIOS || $isAndroid" class="button icon navigation arrow-back" type="button" />

    <button v-else class="button navigation" type="button">
        <span class="icon arrow-back" />
        <span>
            <slot>{{ $t('1b311bbf-8cc3-4b91-a019-f80a062d8d4d') }}</slot>
        </span>
    </button>
</template>
