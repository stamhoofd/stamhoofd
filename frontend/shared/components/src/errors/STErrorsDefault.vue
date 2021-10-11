<template>
    <div ref="errors">
        <template v-for="error in errors">
            <STErrorBox :key="error.id">
                {{ error.human || error.message }}
            </STErrorBox>
        </template>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import { ErrorBox } from "./ErrorBox"
import STErrorBox from "./STErrorBox.vue"

@Component({
    components: {
        STErrorBox
    }
})export default class STErrorsDefault extends Vue {
    @Prop() 
    errorBox: ErrorBox | null;
    
    errors: SimpleError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox | null ) {
        if (!val) {
            this.errors = [];
            return;
        }
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