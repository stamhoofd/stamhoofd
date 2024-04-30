<template>
    <div ref="errors" :class="{'input-errors': errors.length > 0}">
        <slot />
        <div>
            <template v-for="error in errors" :key="error.id">
                <STErrorBox>
                    {{ error.human || error.message }}
                </STErrorBox>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Component, Prop, Vue, Watch } from "@simonbackx/vue-app-navigation/classes";

import { ErrorBox } from "./ErrorBox"
import STErrorBox from "./STErrorBox.vue"

@Component({
    components: {
        STErrorBox
    }
})
export default class STErrorsDefault extends Vue {
    @Prop({ default: "" }) errorFields: string;
    @Prop({ default: null }) errorBox: ErrorBox | null;
    errors: SimpleError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        if (!val) {
            this.errors = [];
            return;
        }
        let errors: SimpleErrors
        
        if (this.errorFields == "*") {
            errors = val.remaining
        } else {
            errors = val.forFields(this.errorFields.split(","))
        }
        
        this.errors = errors.errors
        val.scrollTo(this.errors, this.$refs.errors as HTMLElement)
    }
}
</script>