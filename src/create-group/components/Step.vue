<template>
    <main class="step">
        <article>
            <slot></slot>
        </article>
    </main>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
@Component({})
export default class Step extends Vue {}
</script>

<style lang="scss">
@use 'scss/base/variables' as *;

$header-height: 50px;

.step {
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);
    padding-top: $header-height;
    box-sizing: border-box;

    & > article {
        box-sizing: border-box;
        flex-basis: 800px;
        padding: 50px;
        background: $color-white;
        border-radius: $border-radius;
        max-width: 100%;

        @media (max-width: 800px + 50px*2) {
            border-radius: 0;
        }

        @media (max-width: 500px) {
            padding: 30px 20px;
        }
    }
}
</style>
