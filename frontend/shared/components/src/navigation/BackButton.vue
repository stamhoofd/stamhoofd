<template>
    <button v-if="$isIOS || $isAndroid" class="button icon navigation arrow-back" type="button" />

    <button v-else class="button navigation" type="button">
        <span class="icon arrow-back" />
        <span>
            <slot>{{ $t('%Vz') }}</slot>
        </span>
    </button>
</template>
