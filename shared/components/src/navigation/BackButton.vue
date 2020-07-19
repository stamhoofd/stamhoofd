<template>
    <button class="button text" @click="$emit('click', $event)">
        <span class="icon arrow-left"/>
        <span>Terug</span>
    </button>
</template>