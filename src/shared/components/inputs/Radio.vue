<template>
    <label class="radio">
        <input type="radio" name="gender" value="mixed">
        <div>
            <div />
            <slot />
        </div>
    </label>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class Radio extends Vue {}
</script>
