<template>
    <div class="gender-selector">
        <label>
            <input type="checkbox" name="male" class="male">
            <div>
                <MaleIcon />
            </div>
        </label>
        <label>
            <input type="checkbox" name="female" class="female">
            <div>
                <FemaleIcon />
            </div>
        </label>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import MaleIcon from "@stamhoofd/shared/components/icons/MaleIcon.vue";
import FemaleIcon from "@stamhoofd/shared/components/icons/FemaleIcon.vue";

@Component({
    components: {
        MaleIcon,
        FemaleIcon,
    },
})
export default class GenderSelector extends Vue {}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
.gender-selector {
    display: inline-flex;
    vertical-align: middle;

    label input {
        display: none;
    }
    input + div {
        display: block;
        width: 24px;
        height: 24px;
        background: url(~@stamhoofd/assets/images/icons/border/male.svg) center center no-repeat;
        transition: background-image 0.2;
        cursor: pointer;

        svg > path {
            stroke-dasharray: 30;
            stroke-dashoffset: 30;
            transition: stroke-dashoffset 0.4s 0.1s;
        }
        padding: 10px 0;

        @media (pointer: coarse) {
            padding: 10px 5px;
        }
    }
    input.female + div {
        background-image: url(~@stamhoofd/assets/images/icons/border/female.svg);
    }

    label:active {
        opacity: 0.5;
    }

    input:checked + div {
        display: block;
        width: 24px;
        height: 24px;
        cursor: pointer;

        svg > path {
            stroke-dashoffset: 0;
        }
    }
}
</style>
