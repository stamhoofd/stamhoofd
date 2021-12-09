<template>
    <button class="button navigation only-icon-tiny-smartphone" type="button" @click="$emit('click', $event)">
        <span class="icon arrow-back" />
        <span class="hide-android">Terug</span>
    </button>
</template>