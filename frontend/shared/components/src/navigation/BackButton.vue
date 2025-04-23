<template>
    <button class="button navigation" type="button">
        <span class="icon arrow-back" />
        <span class="hide-android">
            <slot>{{ $t('Terug') }}</slot>
        </span>
    </button>
</template>
