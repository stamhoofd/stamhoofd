<template>
    <label class="prefix-input input" :class="{ error: !valid }">
        <div class="prefix">
            {{ prefix }}
        </div>
        <input
            ref="input"
            v-model="internalValue"
            type="text"
            @blur="$emit('blur', $event)"
        >
    </label>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class PrefixInput extends Vue {
    valid = true;

    /** Price in cents */
    @Prop({ default: "" })
    value!: string

    @Prop({ default: "" })
    prefix!: string

    @Prop({ default: "" })
    placeholder!: string

    get internalValue() {
        return this.value
    }

    set internalValue(val: string) {
        this.$emit("input", val)
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;

.prefix-input {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0;
    align-items: stretch;
    overflow: visible;

    & > .prefix {
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
        opacity: 0.5;

        box-sizing: border-box;
        
        
        line-height: $input-height - 10px - 2 * $border-width;
        display: block;

        @media (max-width: 350px) {
            letter-spacing: -0.5px;
        }
    }

    & > input {
        box-sizing: border-box;
        display: block;
        width: auto;
        min-width: 0;

        padding: 5px 15px;
        margin: -5px -15px;

        padding-right: 0;
        margin-right: 0;

        // Clicking on the prefix should set the cursor to the start + allow text selection easily
        padding-left: 200px;
        margin-left: -200px;

        line-height: $input-height - 10px - 2 * $border-width;

        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }
}
</style>
