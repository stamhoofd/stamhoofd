import Vue, { VNode } from "vue";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";

export default Vue.extend({
    props: {
        component: ComponentWithProperties
    },

    created() {
        /// Whether the node should be destroyed if it is removed from the dom
        this.destroy = true;
    },

    watch: {
        component(val) {
            throw new Error("Changing component during life is not yet supported");
        }
    },

    beforeMount() {
        //this.component.beforeMount();
    },

    mounted() {
        console.log(this.$el);
        this.component.beforeMount();
    },

    render(createElement): VNode {
        // Only create the vnode once
        if (this.component.vnode) {
            // We need to update the parent here
            this.component.vnode.componentInstance.$parent = this;
            return this.component.vnode;
        }

        console.log("Created new vnode " + this.component.component.name);
        this.component.vnode = createElement(this.component.component, {
            props: this.component.properties,
            key: this.component.key
        });

        // Magic trick: we are now responsible for deallocating the component
        this.component.vnode.data.keepAlive = true;
        return this.component.vnode;
    },

    destroyed() {
        // This component got removed (with v-if, v-for, ...) in some way.
        // This doesn't mean we want to destroy it
        // this.component.vnode.componentInstance.$parent = null;
        this.component.destroy();
    }
});
