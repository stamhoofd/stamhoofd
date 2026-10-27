<template>
    <div class="split-view-controller" :data-has-detail="detail ? 'true' : 'false'">
        <div ref="masterElement" class="master">
            <NavigationController ref="navigationController" :root="root" :custom-provide="masterProvide" />
        </div>
        <div v-if="detail" class="detail">
            <FramedComponent :key="detail.key" :root="detail" :custom-provide="detailProvide" />
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue';

import { ComponentWithProperties, type ComponentWithPropertiesType } from './ComponentWithProperties';
import FramedComponent from './FramedComponent.vue';
import { HistoryManager } from './HistoryManager';
import NavigationController from './NavigationController.vue';
import { type PushOptions } from './PushOptions';
import { injectHooks } from './utils/injectHooks';
import { useUrl, type DefaultRouteHandler } from './utils/navigationHooks';

// Credits https://codeburst.io/throttling-and-debouncing-in-javascript-b01cad5c8edf
const throttle = (func: any, limit: any) => {
    let lastFunc: any;
    let lastRan: any;
    return function (this: any) {
        const context = this;

        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        }
        else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};

export default defineComponent({
    name: 'SplitViewController',
    components: {
        NavigationController,
        FramedComponent,
    },
    provide() {
        return {
            reactive_splitViewController: this,
            reactive_navigation_show_detail: this.showDetail,
        };
    },
    props: {
        /** Master/menu view, rendered in its own navigation stack. Detail navigation targets the second pane. */
        root: {
            required: true,
            type: Object as PropType<ComponentWithPropertiesType>,

        },
        /** Optional CSS width for the detail pane; null uses the stylesheet default. */
        detailWidth: {
            default: null,
            type: String,
        },
    },
    data() {
        return {
            detail: null as ComponentWithPropertiesType | null,
            detailKey: null as number | null,
            defaultHandler: null as DefaultRouteHandler | null,
            isChangingComponents: false as boolean,
        };
    },
    computed: {
        masterProvide() {
            return {
                // The master cannot make changes to the url or title if there is a detail
                reactive_navigation_disable_url: computed(() => !!this.detail),
                reactive_provide_default_handler: (defaultHandler: DefaultRouteHandler) => {
                    this.defaultHandler = defaultHandler;
                    this.onResize();
                },
            };
        },
        detailProvide() {
            return {
                // Detail can not alter the navigation of the parent of split view controller.
                reactive_navigation_can_pop: false,
                reactive_navigation_can_dismiss: false,
            };
        },
        lastIsDetail() {
            return this.detailKey != null && this.navigationController?.mainComponent?.key == this.detailKey;
        },
        navigationController() {
            return this.$refs['navigationController'] as InstanceType<typeof NavigationController>;
        },
        masterElement() {
            return this.$refs['masterElement'] as HTMLElement;
        },
    },
    created(this: any) {
        // we cannot use setup in mixins, but we want to avoid having to duplicate the 'use' hooks logic.
        // so this is a workaround
        const definitions: any = {
            $url: useUrl(),
        };

        injectHooks(this, definitions);
    },
    mounted() {
        if (this.detailWidth) {
            (this.$el as HTMLElement).style.setProperty('--split-view-width', this.detailWidth);
        }
    },
    activated() {
        (this as any).listener = throttle(this.onResize, 100);
        window.addEventListener('resize', (this as any).listener, { passive: true } as EventListenerOptions);

        // Recheck if we need to show the detail
        this.onResize();
    },
    deactivated() {
        window.removeEventListener('resize', (this as any).listener, { passive: true } as EventListenerOptions);
    },
    methods: {
        returnToHistoryIndex() {
            // The splitview controller became the topmost component again, pass it through to the topmost
            if (this.detail) {
                return this.detail.returnToHistoryIndex();
            }
            return this.navigationController.returnToHistoryIndex();
        },
        onResize() {
            // Skip if not in DOM (fixes issues where split view would collapse when deactivated)
            if (this.$el.isConnected === false) return false;

            if (this.shouldCollapse()) {
                if (this.detail) {
                    this.collapse().catch(console.error);
                }
            }
            else {
                if (this.canExpand()) {
                    this.expand().catch(console.error);
                }
            }
        },
        getScrollElement(element: HTMLElement | null = null): HTMLElement {
            if (!element) {
                element = this.$el as HTMLElement;
            }

            const style = window.getComputedStyle(element);
            if (style.overflowY == 'scroll' || style.overflow == 'scroll' || style.overflow == 'auto' || style.overflowY == 'auto') {
                return element;
            }
            else {
                if (!element.parentElement) {
                    return document.documentElement;
                }
                return this.getScrollElement(element.parentElement);
            }
        },
        async shouldNavigateAway(): Promise<boolean> {
            if (this.detail) {
                const r = await this.detail.shouldNavigateAway();
                if (!r) {
                    return false;
                }
            }

            if (this.navigationController) {
                return await this.navigationController.shouldNavigateAway();
            }

            return true;
        },
        async showDetail(options: PushOptions): Promise<boolean> {
            if (this.isChangingComponents) {
                console.error('Show detail called on a splitViewController that is busy');
                return false;
            }

            const component = options.components[options.components.length - 1] as ComponentWithProperties;
            this.detailKey = component.key;
            this.isChangingComponents = true;
            try {
                if (this.shouldCollapse()) {
                    if (this.lastIsDetail || this.detail) {
                        console.error('Pushing a detail when a detail is already presented is not allowed');
                        this.isChangingComponents = false;
                        return false;
                    }

                    await this.navigationController.push(options);
                }
                else {
                    // Replace existing detail component
                    // First check if we don't destroy anything
                    if (this.detail) {
                        const r = await this.detail.shouldNavigateAway();
                        if (!r) {
                            this.isChangingComponents = false;
                            return false;
                        }
                    }

                    this.getScrollElement().scrollTop = 0;

                    if (this.detail) {
                        HistoryManager.invalidateHistory();
                    }

                    HistoryManager.pushState(null, null, {
                        adjustHistory: options.adjustHistory ?? true,
                        invalid: !!options.invalidHistory,
                    });
                    component.assignHistoryIndex();
                    this.detail = component;
                }
            }
            finally {
                this.isChangingComponents = false;
            }
            return true;
        },
        shouldCollapse() {
            return (this.$el as HTMLElement).offsetWidth < 850;
        },
        async collapse() {
            if (!this.navigationController) {
                console.error('Cannot collapse without navigation controller');
                return;
            }
            if (this.lastIsDetail) {
                console.error('Cannot collapse when the detail is already collaped');
                return;
            }
            if (!this.detail) {
                console.error('Cannot collapse without detail');
                return;
            }
            if (this.isChangingComponents) {
                console.error('Cannot collapse while already isChangingComponents');
                return;
            }

            console.log('Collapse SplitViewController');

            this.isChangingComponents = true;
            try {
                this.detail.keepAlive = true;
                const detail = this.detail;
                this.detail = null;
                await this.navigationController.push({ components: [detail], animated: false });
                // HistoryManager.invalidateHistory();
            }
            finally {
                this.isChangingComponents = false;
            }
        },
        canExpand() {
            if (!this.navigationController) {
                return false;
            }
            if (this.detail) {
                return false;
            }
            if (this.isChangingComponents) {
                return false;
            }
            if (!this.lastIsDetail) {
                if (this.defaultHandler) {
                    return true;
                }
                return false;
            }
            return true;
        },
        async expand() {
            if (!this.navigationController) {
                console.error('Cannot expand without navigation controller');
                return;
            }
            if (this.detail) {
                console.error('Cannot expand when detail is already visible');
                return;
            }
            if (this.isChangingComponents) {
                console.error('Cannot expand while already isChangingComponents');
                return false;
            }
            console.log('Expand SplitViewController');
            if (!this.lastIsDetail) {
                // Expand with rootDetail
                if (!this.defaultHandler) {
                    console.error('Cannot expand when there is no defaultHandler');
                    return;
                }
                // HistoryManager.invalidateHistory();

                this.isChangingComponents = false;
                try {
                    const succeeded = await this.defaultHandler(); // will call showDetail normally
                    if (succeeded && !this.detail) {
                        console.warn('Did call defaultHandler but no detail was set. Are all mounts properly awaited?');
                    }
                    if (!succeeded) {
                        console.warn('Failed to show default handler');
                    }
                    console.info('Used default handler for split view controller');
                }
                finally {
                    this.isChangingComponents = false;
                }

                return;
            }
            this.isChangingComponents = true;

            try {
                const popped = await this.navigationController.pop({
                    animated: false,
                    destroy: false,
                });
                if (!popped || popped.length == 0) {
                    this.isChangingComponents = false;
                    return;
                }

                // We need to wait until it is removed from the vnode
                await this.$nextTick();
                HistoryManager.pushState(null, null, {
                    adjustHistory: false,
                    invalid: true,
                });
                this.detailKey = popped[0].key;
                this.detail = popped[0];
                this.detail.assignHistoryIndex();
            }
            finally {
                this.isChangingComponents = false;
            }
        },
    },
});

</script>

<style lang="scss">
.split-view-controller {
    //background: $color-white-shade;
    position: relative;
    width: 100%;
    box-sizing: border-box;

    & > .master {
        flex-shrink: 0;
        flex-grow: 0;
        position: sticky;
        left: 0;
        top: 0;
        height: 100vh;
        height: calc(var(--vh, 1vh) * 100);

        overflow: hidden;
        overflow-y: scroll;
        -webkit-overflow-scrolling: touch;

        // do not start scrolling parents if we reached the edge of this view
        // we'll need to add a polyfill for Safari in JS to disable overscroll (currently not available)
        overscroll-behavior-y: contain;

        &:last-child {
            position: relative;
            overflow: visible;
            width: 100%;
            height: auto;
        }
    }

    & > .detail {
        /*background: $color-white;
        border-top-left-radius: $border-radius;
        border-bottom-left-radius: $border-radius;*/

        // Clip contents (during animations)
        // Sometimes not working on iOS (need to fix)
        // clip-path: inset(0px 0px);

        // @extend .style-side-view-shadow;
    }

    // Make sure our background color etc fills the whole view
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);

    &[data-has-detail="true"] {
        display: grid;
        grid-template-columns: 320px 1fr;
        grid-template-columns: var(--split-view-width, 320px) 1fr;

        & > .master {
            min-width: 0;
        }

        & > .detail {
            min-width: 0;
            min-height: 100vh;
            min-height: calc(var(--vh, 1vh) * 100);
        }
    }
}
</style>
