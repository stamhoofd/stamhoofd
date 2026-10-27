import { defineComponent } from 'vue';

import { ModalStackComponentFinderMixin } from './ModalStackComponentFinderMixin';
import { type PopOptions } from './PopOptions';

// You can declare mixins as the same style as components.
export const ModalMixin = defineComponent({
    extends: ModalStackComponentFinderMixin,
    methods: {
        pop(options: PopOptions = {}) {
            const nav = this.getPoppableParent();
            if (nav) {
                // Sometimes we need to call the pop event instead (because this adds custom data to the event)
                if (nav.props.onPop) {
                    nav.emit('pop', options);
                }
                else {
                    console.error("Couldn't pop. Failed");
                }
            }
            else {
                console.warn('No navigation controller to pop');
            }
        },
        getPoppableParent() {
            let prev = this.$;
            let start = this.$.parent;
            while (start) {
                if (prev.props.onPop) {
                    return prev;
                }

                prev = start;
                start = start.parent;
            }
            return null;
        },
    },
});
