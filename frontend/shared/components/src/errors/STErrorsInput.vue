<template>
    <div ref="errors" :class="{'input-errors': errors.length > 0}">
        <slot />
        <div>
            <template v-for="error in errors" :key="error.id">
                <STErrorBox>
                    {{ getErrorMessage(error) }}
                </STErrorBox>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from './ErrorBox';
import STErrorBox from './STErrorBox.vue';
import { Request } from '@simonbackx/simple-networking';

@Component({
    components: {
        STErrorBox,
    },
})
export default class STErrorsInput extends VueComponent {
    @Prop({ default: '' })
    errorFields: string;

    @Prop({ default: null })
    errorBox: ErrorBox | ErrorBox[] | null;

    errors: SimpleError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox | ErrorBox[] | null) {
        if (!val) {
            this.errors = [];
            return;
        }
        const arr = Array.isArray(val) ? val : [val];
        if (arr.length === 0) {
            this.errors = [];
            return;
        }
        this.errors = [];
        for (const errorBox of arr) {
            if (this.errorFields === '') {
                continue;
            }
            let errors: SimpleErrors;

            if (this.errorFields === '*') {
                errors = errorBox.remaining;
            }
            else {
                errors = errorBox.forFields(this.errorFields.split(','));
            }

            this.errors.push(...errors.errors);

            // If no input element currently focused
            if (document.activeElement && this.$el.contains(document.activeElement)) {
                continue;
            }
            errorBox.scrollTo(this.errors, this.$refs.errors as HTMLElement);
        }
    }

    getErrorMessage(error: SimpleError) {
        if (Request.isNetworkError(error as any)) {
            return $t(`94bdc2a4-9ebb-42d2-a4e9-d674eb9aafef`);
        }
        return error.getHuman();
    }
}
</script>
