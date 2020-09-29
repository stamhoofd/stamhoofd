<template>
    <button class="button text" @click="$emit('click', $event)" type="button">
        <span class="icon arrow-left"/>
        <span>Terug</span>
    </button>
</template>