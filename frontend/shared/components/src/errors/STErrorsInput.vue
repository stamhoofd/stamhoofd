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
    @Prop({ default: '' }) errorFields: string;
    @Prop({ default: null }) errorBox: ErrorBox | null;
    errors: SimpleError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        if (!val) {
            this.errors = [];
            return;
        }
        let errors: SimpleErrors;

        if (this.errorFields === '*') {
            errors = val.remaining;
        }
        else {
            errors = val.forFields(this.errorFields.split(','));
        }

        this.errors = errors.errors;
        val.scrollTo(this.errors, this.$refs.errors as HTMLElement);
    }

    getErrorMessage(error: SimpleError) {
        if (Request.isNetworkError(error as any)) {
            return $t(`94bdc2a4-9ebb-42d2-a4e9-d674eb9aafef`);
        }
        return error.getHuman();
    }
}
</script>
