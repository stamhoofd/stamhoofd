<template>
    <div :class="{'input-errors': errors.length > 0}">
        <slot />
        <div style="min-height: 1px;">
            <template v-for="error in errors">
                <ErrorBox :key="error.message">
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
        console.log("Picked new errors for", this.errorFields);
        const errors = val.forFields(this.errorFields.split(","))
        this.errors = errors.errors
    }

    beforeAppear(el: HTMLElement) {
        const child = el.firstElementChild as HTMLElement
        if (child) {
            child.style.opacity = "0";
        }
    }

    appear(el: HTMLElement) {
        const height = el.offsetHeight;
        const child = el.firstElementChild as HTMLElement;
        el.style.height = "0";

        requestAnimationFrame(() => {
            el.style.height = height+"px";
            if (child) {
                child.style.opacity = "1";
            }
        });

    }

    afterAppear(el: HTMLElement) {
        el.style.height = "";
    }
}
</script>