<template>
    <button class="button navigation" type="button" @click="$emit('click', $event)">
        <span class="icon arrow-back" />
        <span class="hide-android">
            <slot>Terug</slot>
        </span>
    </button>
</template>