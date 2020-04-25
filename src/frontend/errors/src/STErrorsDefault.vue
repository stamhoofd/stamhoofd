<template>
    <div ref="errors" style="min-height: 1px;">
        <template v-for="error in errors">
            <ErrorBox :key="error.message">
                {{ error.human || error.message }}
            </ErrorBox>
        </template>
    </div>
</template>

<script lang="ts">
import { STError } from '@stamhoofd-common/errors';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import { ErrorBox } from "./ErrorBox"
import ErrorBoxComponent from "./ErrorBox.vue"

@Component({
    components: {
        ErrorBox: ErrorBoxComponent
    }
})export default class STErrorsDefault extends Vue {
    @Prop() errorBox: ErrorBox | null;
    errors: STError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        // Wait for next tick, to prevent a useless rerender of errors that will get removed by other inputs
        this.$nextTick(() => {
            const errors = val.remaining
            console.log("Picked new default errors", errors);
            this.errors = errors.errors

            val.scrollTo(this.errors, this.$refs.errors as HTMLElement)
        });
        
    }
}
</script>

<style lang="scss">
    .error {
        color: red;
    }
</style>