<template>
    <label class="checkbox">
        <input type="checkbox" name="test" :checked="value" @input="onChange">
        <div>
            <div>
                <svg width="10" height="9" viewBox="0 0 10 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M1 4L4 8L9 1"
                        stroke="white"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </div>
            <div><slot /></div>
        </div>
    </label>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class Checkbox extends Vue {
    @Prop({
        default: false,
    })
    value!: boolean;

    onChange(event) {
        this.$emit("input", event.target.checked);
    }
}
</script>

<style lang="scss">
@use "~scss/components/checkbox.scss";
</style>
