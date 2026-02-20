<template>
    <div ref="errors">
        <template v-for="(error, index) in errors" :key="index">
            <STErrorBox :error="error" />
        </template>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from './ErrorBox';
import STErrorBox from './STErrorBox.vue';
import { Ref, unref } from 'vue';
import { Request } from '@simonbackx/simple-networking';

@Component({
    components: {
        STErrorBox,
    },
})
export default class STErrorsDefault extends VueComponent {
    @Prop()
    errorBox!: ErrorBox | Ref<ErrorBox> | null;

    errors: SimpleError[] = [];

    mounted() {
        this.onNewErrors(unref(this.errorBox));
    }

    getErrorMessage(error: SimpleError) {
        if (Request.isNetworkError(error as any)) {
            return $t(`94bdc2a4-9ebb-42d2-a4e9-d674eb9aafef`);
        }
        return error.getHuman();
    }

    @Watch('errorBox')
    onNewErrors(val: ErrorBox | Ref<ErrorBox> | null) {
        if (!val) {
            this.errors = [];
            return;
        }
        // Wait for next tick, to prevent a useless rerender of errors that will get removed by other inputs
        this.$nextTick(() => {
            const errors = unref(val).remaining;
            this.errors = errors.errors;

            unref(val).scrollTo(this.errors, this.$refs.errors as HTMLElement);
        });
    }
}
</script>

<style lang="scss">
    .error {
        color: red;
    }
</style>
