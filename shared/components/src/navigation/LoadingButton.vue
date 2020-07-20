<template>
    <div class="loading-button" :class="{loading}">
        <div><slot /></div>
        <div>
            <Spinner />
        </div>
    </div>
</template>


<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

import Spinner from "../Spinner.vue";

@Component({
    components: {Spinner}
})
export default class LoadingButton extends Vue {
    @Prop({ default: false, type: Boolean })
    loading!: boolean;
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles';

.loading-button {
    position: relative;

    > div:first-child {
        padding-right: 0px;
        transition: padding-right 0.25s;
    }

     > div:last-child {
        position: absolute;
        opacity: 0;
        top: 50%;
        right: 0;
        transform: translate(100%, -50%);
        transition: transform 0.25s, opacity 0.25s;
    }

    &.loading {
        > div:first-child {
            padding-right: 40px;
        }
        > div:last-child {
            opacity: 1;
            transform: translate(0, -50%);
        }
    }
}
</style>
