<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="promise-view">
        <LoadingViewTransition :errorBox="errorBox">
            <ComponentWithPropertiesInstance v-if="root" :key="root.key" :component="root" />
        </LoadingViewTransition>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from '../errors/ErrorBox';
import LoadingViewTransition from './LoadingViewTransition.vue';

@Component({
    components: {
        ComponentWithPropertiesInstance,
        LoadingViewTransition,
    },
})
export default class PromiseView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    promise!: (this: typeof PromiseView) => Promise<ComponentWithProperties>;

    root: ComponentWithProperties | null = null;
    passRoutes = false;
    errorBox: ErrorBox | null = null;

    mounted() {
        this.run();
    }

    customRoutes() {
        this.passRoutes = true;
    }

    run() {
        this.errorBox = null;
        this.promise.call(this).then((value) => {
            if (!value) {
                console.error('Promise view did not return a component.');
                throw new Error('Missing component in promise');
            }

            const c = value;
            if (this.passRoutes) {
                this.passRoutes = false;
                c.setCheckRoutes();
            }
            this.root = c;
        }).catch((e) => {
            console.error(e);
            console.error('Promise error not caught, defaulting to dismiss behaviour in PromiseView');

            if (this.canDismiss) {
                this.dismiss({ force: true });
            }
            else {
                this.errorBox = new ErrorBox(e);
            }
        });
    }

    reload() {
        this.root = null;
        this.run();
    }

    returnToHistoryIndex() {
        if (this.root) {
            return this.root.returnToHistoryIndex();
        }
        return false;
    }

    async shouldNavigateAway(): Promise<boolean> {
        if (!this.root) {
            return true;
        }
        return await (this.root.shouldNavigateAway());
    }
}
</script>

<style lang="scss">

.promise-view.st-view {
    background: transparent; // Ticket scanning requires all views to be transparent
}
</style>
