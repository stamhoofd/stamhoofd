<template>
    <div ref="errors" :class="{'input-errors': errors.length > 0}">
        <slot />
        <div style="min-height: 1px; margin-top: -10px;">
            <template v-for="error in errors">
                <ErrorBox :key="error.id">
                    {{ error.human || error.message }}
                </ErrorBox>
            </template>
        </div>
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
})
export default class STErrorsDefault extends Vue {
    @Prop() errorFields: string;
    @Prop() errorBox: ErrorBox;
    errors: STError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        if (!val) {
            this.errors = [];
            return;
        }
        console.log("Picked new errors for", this.errorFields);
        const errors = val.forFields(this.errorFields.split(","))
        errors.generateIds()
        this.errors = errors.errors
        val.scrollTo(this.errors, this.$refs.errors as HTMLElement)
    }
}
</script>