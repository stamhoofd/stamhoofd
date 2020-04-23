import Vue, { VNode } from "vue";

import { ComponentWithProperties } from "../../classes/ComponentWithProperties";

export default Vue.extend({
    props: {
        component: ComponentWithProperties,
    },

    watch: {
        component(_val) {
            throw new Error("Changing component during life is not yet supported");
        },
    },

    created() {
        /// Whether the node should be destroyed if it is removed from the dom
        this.destroy = true;
    },

    beforeMount() {
        this.component.beforeMount();
    },

    mounted() {
        this.component.mounted();
    },

    destroyed() {
        // This component got removed (with v-if, v-for, ...) in some way.
        // This doesn't mean we want to destroy it
        this.component.destroy();
    },

    render(createElement): VNode {
        // Only create the vnode once
        if (this.component.vnode) {
            // We need to update the parent here
            this.component.vnode.componentInstance.$parent = this;
            return this.component.vnode;
        }

        this.component.vnode = createElement(this.component.component, {
            props: this.component.properties,
            key: this.component.key,
        });

        // Magic trick: we are now responsible for deallocating the component
        this.component.vnode.data.keepAlive = true;
        return this.component.vnode;
    },
});
