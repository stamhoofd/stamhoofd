<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div class="context-provider-view">
        <ComponentWithPropertiesInstance :key="root.key" :component="root" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';
import { appToUri } from '@stamhoofd/structures';
import { isReactive } from 'vue';

@Component({
    components: {
        ComponentWithPropertiesInstance,
    },
    provide() {
        if (isReactive(this.context)) {
            // If this.context is a proxy, it will auto unwrap all the reference properties it has
            // which will break reactivity on scalar values (e.g. Computed<null> will be unwrapped to null)
            throw new Error('ContextProvider.context is reactive, which will break reactivity of the context properties');
        }

        if (!this.context.stamhoofd_app) {
            console.error('Missing stamhoofd_app in ContextProvider.context');
        }
        else if (!this.context.$context) {
            console.error('Missing $context in ContextProvider.context');
        }
        else {
            if (this.context.stamhoofd_app === 'webshop') {
                this.context.reactive_navigation_url = '/';
            }
            else {
                // Build reactive url
                this.context.reactive_navigation_url = appToUri(this.context.stamhoofd_app) + (this.context.$context.organization && !STAMHOOFD.singleOrganization ? '/' + this.context.$context.organization!.uri : '');
            }
        }

        return this.context;
    },
})
export default class ContextProvider extends VueComponent {
    @Prop()
    root!: ComponentWithProperties;

    @Prop({ default: () => {
        return {};
    } })
    context!: Record<string, unknown>;

    async shouldNavigateAway() {
        return await this.root.shouldNavigateAway();
    }

    returnToHistoryIndex() {
        if (this.root) {
            return this.root.returnToHistoryIndex();
        }
        return false;
    }

    beforeMount() {
        if (this.root) {
            this.root.assignHistoryIndex();
        }
    }
}
</script>
