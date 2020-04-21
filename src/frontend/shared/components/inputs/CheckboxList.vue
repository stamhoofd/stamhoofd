<template>
    <div>
        <slot />
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class CheckboxList extends Vue {}
</script>

<style lang="scss"></style>
