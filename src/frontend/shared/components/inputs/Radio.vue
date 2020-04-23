<template>
    <label class="radio">
        <input type="radio" name="gender" value="mixed">
        <div>
            <div />
            <div><slot /></div>
        </div>
    </label>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class Radio extends Vue {}
</script>
