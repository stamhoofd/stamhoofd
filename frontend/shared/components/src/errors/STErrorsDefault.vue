<template>
    <div ref="errors">
        <template v-for="error in errors" :key="error.id">
            <STErrorBox>
                {{ getErrorMessage(error) }}
            </STErrorBox>
        </template>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, Vue, Watch } from "@simonbackx/vue-app-navigation/classes";

import { ErrorBox } from "./ErrorBox"
import STErrorBox from "./STErrorBox.vue"
import { Ref, unref } from 'vue';

@Component({
    components: {
        STErrorBox
    }
})
export default class STErrorsDefault extends Vue {
    @Prop() 
        errorBox!: ErrorBox | Ref<ErrorBox> | null;
    
    errors: SimpleError[] = [];

    mounted() {
        this.onNewErrors(unref(this.errorBox))
    }

    getErrorMessage(error: SimpleError) {
        if (error.hasCode("network_error") || error.hasCode("network_timeout")) {
            return "Geen of slechte internetverbinding"
        }
        return error.getHuman()
    }

    @Watch('errorBox')
    onNewErrors(val: ErrorBox | Ref<ErrorBox> | null ) {
        if (!val) {
            this.errors = [];
            return;
        }
        // Wait for next tick, to prevent a useless rerender of errors that will get removed by other inputs
        this.$nextTick(() => {
            const errors = unref(val).remaining
            this.errors = errors.errors

            unref(val).scrollTo(this.errors, this.$refs.errors as HTMLElement)
        });
        
    }
}
</script>

<style lang="scss">
    .error {
        color: red;
    }
</style>