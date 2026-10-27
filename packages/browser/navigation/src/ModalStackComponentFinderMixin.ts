import { defineComponent } from 'vue';

import ModalStackComponent from './ModalStackComponent.vue';

// You can declare mixins as the same style as components.
export const ModalStackComponentFinderMixin = defineComponent({
    computed: {
        modalStackComponent(): InstanceType<typeof ModalStackComponent> | null {
            let start: any = this.$parent;
            while (start) {
                if (start instanceof ModalStackComponent) {
                    return start;
                }

                start = start.$parent;
            }
            return null;
        },
    },
});
