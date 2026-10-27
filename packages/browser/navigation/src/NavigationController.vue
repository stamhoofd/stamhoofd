<template>
    <div v-if="mainComponent" class="navigation-controller">
        <transition

            :css="false"
            @before-enter="beforeEnter"
            @before-leave="beforeLeave"
            @enter="enter"
            @leave="leave"
            @after-leave="afterLeave"
            @after-enter="afterEnter"
            @enter-cancelled="enterCancelled"
        >
            <FramedComponent
                :key="mainComponent.key"
                ref="child"
                :root="mainComponent"
                :custom-provide="provideForComponent(mainComponent.key)"
            />
        </transition>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, unref, type PropType } from 'vue';

import { ComponentWithProperties, type ComponentWithPropertiesType } from './ComponentWithProperties';
import FramedComponent from './FramedComponent.vue';
import { HistoryManager } from './HistoryManager';
import { type PopOptions } from './PopOptions';
import { type PushOptions } from './PushOptions';

/**
 * A stack of covering views. Pushing preserves the covered views' instances and
 * scroll positions; popping removes the top view and restores the previous one.
 * Child show/pop hooks target this stack, independently of its modal presentation.
 */
const NavigationController = defineComponent({
    name: 'NavigationController',
    components: {
        FramedComponent,
    },
    inject: {
        reactive_navigation_pop: {
            default: null,
        },
        reactive_navigation_can_pop: {
            default: false,
        },
        reactive_navigation_can_dismiss: {
            default: false,
        },
        reactive_navigationController: {
            default: null,
        },
        // Our own wrapper component, used to forward our content state to a parent controller.
        navigation_currentComponent: {
            default: null,
        },
    },
    provide() {
        let extra = {};
        if (this.animationType === 'modal') {
            extra = {
                reactive_navigation_dismiss: computed(() => this.components.length > 1 ? this.pop : unref(this.reactive_navigation_pop)),
                reactive_navigation_can_dismiss: computed(() => this.components.length > 1),
                reactive_navigation_can_pop: false,
            };
        } else {
            extra = {
                reactive_navigation_can_pop: computed(() => this.components.length > 1 || unref(this.reactive_navigation_can_pop)),
            };
        }
        return {
            reactive_navigationController: this,
            reactive_navigation_show: this.push,
            reactive_navigation_pop: computed(() => this.components.length > 1 ? this.pop : unref(this.reactive_navigation_pop)),
            ...extra,
            ...(this.customProvide ?? {}),
        };
    },
    props: {
        /** Initial view when initialComponents is absent or empty; later prop changes do not reset the stack. */
        root: {
            default: null,
            type: Object as PropType<ComponentWithProperties | null>,
        },
        /** Initial bottom-to-top stack; a nonempty array takes precedence over root and only its last view is visible. */
        initialComponents: {
            default: null,
            type: Object as PropType<ComponentWithProperties[] | null>,
        },
        animationType: {
            default: 'default',
            type: String,
        },
        disableAnimations: {
            default: false,
            type: Boolean,
        },
        customProvide: {
            type: Object,
            default: null,
        },
    },
    emits: ['didPush', 'didPop', 'showDetail', 'present'] as unknown as undefined,
    data() {
        const savedInternalScrollPositions: number[] = [];
        const components: ComponentWithPropertiesType[] = [];

        return {
            components,
            mainComponent: null as ComponentWithPropertiesType | null,
            transitionName: 'none',
            nextInternalScrollPosition: 0,
            savedInternalScrollPositions,

            // Because push/pop is async, it can cause issues if we call it multiple times after each other
            // all push/pop operations should be queued
            asyncQueue: [] as (() => Promise<void>)[],
            asyncQueueRunning: false,
            cachedProvides: new Map<number, any>(),

            // Key of the current main component when it signaled that it does not have any
            // content yet (e.g. an async component that is still loading). This uses an opt-out
            // model: every component is assumed to have content unless it explicitly signals
            // otherwise. While set, we keep the size frozen instead of collapsing to the height
            // of the (empty) loading placeholder.
            contentlessMainKey: null as number | null,

            // Whether a content-height animation (triggered when async content arrives) is
            // currently running, so afterEnter does not clear the frozen size mid-animation.
            animatingContent: false,

            // Ownership token for content-height animations. Each new sizing operation (freezeSize)
            // or content animation increments it; pending animation-frame/transition callbacks
            // bail out when their captured token is no longer current, so an older animation can
            // never overwrite dimensions, clear animatingContent, or unfreeze a newer one.
            contentAnimationToken: 0,

            // Removes transition listeners and animation-frame callbacks for the current
            // content-height animation.
            contentTransitionCleanup: null as (() => void) | null,
        };
    },
    computed: {
        navigationController() {
            return unref(this.reactive_navigationController) as InstanceType<typeof NavigationController> | null;
        },
    },
    watch: {
        // whenever question changes, this function will run
        mainComponent(newComponent: ComponentWithPropertiesType | null, oldComponent: ComponentWithProperties) {
            // Reset the content state: the new main component is assumed to have content unless
            // it signals otherwise (which it does while mounting, before the enter animation runs).
            if (newComponent === this.root || oldComponent === null) {
                return;
            }
            this.resetContentState();

            if (!newComponent) {
                return;
            }
            this.cacheComponentProvides(newComponent);
        },
    },
    beforeMount() {
        if (this.initialComponents && this.initialComponents.length > 0) {
            this.mainComponent = this.initialComponents[this.initialComponents.length - 1];
            this.components = this.initialComponents.slice(0);

            // Update property (even if not allowed, we know, but we need to remove the references)
            // this.initialComponents.splice(0, this.initialComponents.length);
        } else {
            if (!this.root) {
                throw new Error('No root component provided for navigation controller');
            }
            this.mainComponent = this.root;
            this.components = [this.root];
        }

        for (const [index, component] of this.components.entries()) {
            this.cacheComponentProvides(component);

            if (index < this.components.length - 1) {
                HistoryManager.pushState(null, null, { adjustHistory: false });
            }
            component.assignHistoryIndex();
        }
    },
    mounted() {
        if (this.contentlessMainKey === this.mainComponent?.key) {
            // We received a setContent event before we could process it correctly (no element)
            this.setContentState(this.mainComponent, false);
        }
    },
    beforeUnmount() {
        this.cancelContentAnimation();

        // Prevent memory issues by removing all references and destroying kept alive components
        for (const component of this.components) {
            // Destroy them one by one
            if (component.isKeptAlive && component.vnode) {
                component.destroy(component.vnode);
            }
        }

        this.components = [];
        this.mainComponent = null;
    },
    methods: {
        cacheComponentProvides(newComponent: ComponentWithPropertiesType) {
            if (this.animationType === 'modal') {
                this.cachedProvides.set(newComponent.key, {
                    reactive_navigation_can_dismiss: this.components.length > 1,
                });
            } else {
                this.cachedProvides.set(newComponent.key, {
                    reactive_navigation_can_pop: this.components.length > 1 || unref(this.reactive_navigation_can_pop),
                });
            }
        },
        provideForComponent(key: number) {
            return this.cachedProvides.get(key) ?? {};
        },
        runQueue<T>(run: () => Promise<T>): Promise<T> {
            return new Promise<T>((resolve, reject) => {
                this.asyncQueue.push(async () => {
                    try {
                        const r = await run();
                        resolve(r);
                    } catch (e) {
                        reject(e);
                    }
                });
                this.runQueueIfNeeded();
            });
        },
        runQueueIfNeeded() {
            if (this.asyncQueueRunning) {
                return;
            }
            if (this.asyncQueue.length == 0) {
                return;
            }
            this.asyncQueueRunning = true;
            const next = this.asyncQueue.shift();
            if (!next) {
                this.asyncQueueRunning = false;
                this.runQueueIfNeeded();
                return;
            }

            next().catch((e) => {
                console.error('Error in async queue', e);
            }).finally(() => {
                this.asyncQueueRunning = false;
                this.runQueueIfNeeded();
            });
        },
        freezeSize() {
            const el = this.$el as HTMLElement;

            if (!el) {
                return;
            }

            // A new sizing operation starts: cancel any pending content-height animation so it can
            // no longer overwrite the size or unfreeze us.
            this.cancelContentAnimation();

            // First do reads, then writes to avoid 2 layouts
            const w = el.offsetWidth;
            const h = el.offsetHeight;

            el.style.width = w + 'px';
            el.style.height = h + 'px';
            this.setFrozenHeightVariable(h);

            setTimeout(() => {
                if (this.isSizeFrozen()) {
                    console.error('Navigation controller size still frozen!', this);
                    this.unfreezeSize();
                }
            }, 1_000);
        },
        growSize(width: number, height: number) {
            const el = this.$el as HTMLElement;

            el.style.height = height + 'px';
            el.style.width = width + 'px';
            this.setFrozenHeightVariable(height);
        },
        unfreezeSize() {
            const el = this.$el as HTMLElement;
            el.style.width = '';
            el.style.height = '';
            // Intentionally keep --frozen-height: it is only read by placeholder/loading views and
            // keeping the last known height avoids a flash if such a view appears while unfrozen.
        },
        /**
         * Expose the height this controller is (or was last) pinned to as a CSS variable. Inside a
         * dynamically sized container (e.g. a sheet) the global --vh resolves to the full viewport,
         * which is wrong for placeholder/loading views that want to fill the actual (much smaller)
         * size. Those views can read var(--frozen-height) instead. We use a dedicated variable
         * rather than overriding --vh, because --vh is also used for max-height caps and overriding
         * it there would clamp incoming taller views to the old height.
         */
        setFrozenHeightVariable(height: number) {
            (this.$el as HTMLElement).style.setProperty('--frozen-height', height + 'px');
        },
        isSizeFrozen() {
            const el = this.$el as HTMLElement | undefined;
            return !!el && el.style.height !== '';
        },
        hasContent() {
            return !(this.mainComponent !== null && this.contentlessMainKey === this.mainComponent.key);
        },
        cancelContentAnimation() {
            this.contentAnimationToken++;
            this.animatingContent = false;
            this.contentTransitionCleanup?.();
            this.contentTransitionCleanup = null;
        },
        /**
         * Called by a (descendant) component to signal whether it currently renders content.
         * This uses an opt-out model: components are assumed to have content unless they signal
         * otherwise. A component without content (e.g. an async component that is still loading)
         * keeps the navigation controller from collapsing its frozen height to the height of the
         * empty placeholder. Once the content arrives, the controller animates to the real height.
         */
        setContentState(component: ComponentWithProperties, hasContent: boolean) {
            const hadContent = this.hasContent();

            let isMain = true;

            // If mainComponent is not set = called before navigationController is fully created, so we can assume we received it from the future main component
            // if (this.mainComponent && this.mainComponent.key !== component.key) {
            //    // Child if child
            //    if (component.vnode?.el && this.$el && (this.$el as HTMLElement).contains(component.vnode.el as HTMLElement)) {
            //        // Child: okay
            //    }
            //    else {
            //        isMain = false;
            //    }
            // }

            if (!isMain) {
                console.info('Component is not main where we received it from lol');

                // A component that is no longer the main one finally got content: just forget it.
                if (hasContent && this.contentlessMainKey === component.key) {
                    this.contentlessMainKey = null;
                }
            } else if (!hasContent) {
                if (!hadContent && this.isSizeFrozen()) {
                    // Already handled
                } else {
                    // Content disappeared again before a pending resize completed. Revoke ownership
                    // immediately so that resize cannot measure or unfreeze the loading placeholder.
                    this.contentlessMainKey = component.key;

                    if (!this.isSizeFrozen()) {
                        this.freezeSize();
                    }
                }
            } else if (!hadContent) {
                this.contentlessMainKey = null;
                // Content arrived for the current main component: animate to its real height.
                this.animateToContentHeight();
            }

            // When our aggregate content state changes, forward it to a parent navigation
            // controller (if any). This way a controller that was pushed onto another controller's
            // stack while its content is still loading also keeps the outer size frozen, instead
            // of letting the outer controller collapse to the height of the empty placeholder.
            const hasContentNow = this.hasContent();
            if (hadContent !== hasContentNow) {
                this.propagateContentState(hasContentNow);
            }
        },
        propagateContentState(hasContent: boolean) {
            const parent = this.navigationController;
            const ownComponent = this.navigation_currentComponent as ComponentWithProperties | null;
            if (parent && ownComponent && typeof parent.setContentState === 'function') {
                parent.setContentState(ownComponent, hasContent);
            }
        },
        resetContentState() {
            // contentlessMainKey always refers to the (previous) main component, so a non-null value
            // means that component was contentless. When the main component changes, the new one is
            // assumed to have content until it signals otherwise, so forward that transition to a
            // parent controller. Without this, a parent stays marked contentless forever when a
            // nested controller navigates away from a still-loading view (new content is opt-out and
            // may never call setContentState(true) itself).
            const wasContentless = this.contentlessMainKey !== null;
            this.contentlessMainKey = null;
            if (wasContentless) {
                this.propagateContentState(true);
            }
        },
        /**
         * Animate the (still frozen) size towards the real height of the current main component.
         * Used when async content arrives after the enter animation already measured an empty
         * loading placeholder.
         */
        animateToContentHeight() {
            if (!this.isSizeFrozen()) {
                // Nothing was frozen (e.g. not animated): let the layout flow naturally.
                return;
            }

            const child = this.$refs.child as { $el?: HTMLElement } | undefined;
            const framed = child?.$el;
            const inner = framed?.firstElementChild as HTMLElement | null | undefined;
            if (!inner) {
                this.unfreezeSize();
                return;
            }

            // Take ownership of the sizing. Any pending callback from an earlier animation (or a
            // later freeze/animation) now has a stale token and will bail out.
            const token = ++this.contentAnimationToken;
            this.animatingContent = true;

            requestAnimationFrame(() => {
                if (token !== this.contentAnimationToken) {
                    // A newer freeze or content animation took over: do not touch the size.
                    return;
                }

                this.waitForSizeTransition(token, () => {
                    if (token !== this.contentAnimationToken) {
                        console.info('Animation interrupted, not unfreezing size');
                        return;
                    }
                    this.animatingContent = false;
                    if (this.hasContent()) {
                        this.unfreezeSize();
                    }
                });

                const w = (inner.firstElementChild as HTMLElement | null)?.offsetWidth ?? inner.offsetWidth;
                const h = inner.offsetHeight;
                console.info('Grow size towards element', inner);
                this.growSize(w, h);
            });
        },
        waitForSizeTransition(token: number, complete: () => void) {
            const element = this.$el as HTMLElement;
            const pending = new Set<string>();
            let sawSizeTransition = false;
            let firstFrame = 0;
            let secondFrame = 0;

            const cleanup = () => {
                element.removeEventListener('transitionrun', onTransitionRun);
                element.removeEventListener('transitionend', onTransitionFinished);
                element.removeEventListener('transitioncancel', onTransitionFinished);
                cancelAnimationFrame(firstFrame);
                cancelAnimationFrame(secondFrame);
                if (this.contentTransitionCleanup === cleanup) {
                    this.contentTransitionCleanup = null;
                }
            };
            const finish = () => {
                cleanup();
                complete();
            };
            const isSizeTransition = (event: TransitionEvent) => {
                return event.target === element && (event.propertyName === 'height' || event.propertyName === 'width');
            };
            const onTransitionRun = (event: TransitionEvent) => {
                if (!isSizeTransition(event)) {
                    return;
                }
                sawSizeTransition = true;
                pending.add(event.propertyName);
            };
            const onTransitionFinished = (event: TransitionEvent) => {
                if (!isSizeTransition(event)) {
                    return;
                }
                pending.delete(event.propertyName);
                if (sawSizeTransition && pending.size === 0) {
                    finish();
                }
            };

            element.addEventListener('transitionrun', onTransitionRun);
            element.addEventListener('transitionend', onTransitionFinished);
            element.addEventListener('transitioncancel', onTransitionFinished);
            this.contentTransitionCleanup = cleanup;

            // No transition events fire when the consumer has no size transition or when the
            // measured size did not change. After two rendered frames, release immediately.
            firstFrame = requestAnimationFrame(() => {
                secondFrame = requestAnimationFrame(() => {
                    if (token === this.contentAnimationToken && !sawSizeTransition) {
                        finish();
                    }
                });
            });
        },
        /**
         * Animate the controller's height around an in-place content change (e.g. an async
         * sub-component of the current main component finished loading). Freezes the current height,
         * applies the change, then animates to the new height. Unlike the contentless mechanism this
         * does not wait for a navigation: it captures the height as it is right now.
         */
        async animateHeightChange(applyChange: () => void | Promise<void>) {
            if (!this.shouldAnimate()) {
                await applyChange();
                return;
            }
            // Capture the current height before the change is applied.
            this.freezeSize();
            await applyChange();
            // Let the new content render before measuring and animating to its height.
            await this.$nextTick();
            this.animateToContentHeight();
        },
        getInternalScrollElement(element: Element | null = null) {
            const mightBe = (element ?? this.$el as HTMLElement)?.querySelector('main');
            return mightBe ? mightBe : null;
        },
        getScrollElement(_: HTMLElement | null = null): HTMLElement {
            // Deprecated
            return document.documentElement;
        },
        shouldAnimate() {
            return !this.disableAnimations && this.$el && (this.$el as HTMLElement).offsetWidth <= 1000 && !(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        },
        getNavigationTransitionDuration() {
            const isPop = this.transitionName === 'pop' || this.transitionName === 'modal-pop';
            const property = isPop ? '--navigation-pop-transition-duration' : '--navigation-transition-duration';
            const fallback = isPop ? 250 : 300;
            const value = getComputedStyle(this.$el as HTMLElement).getPropertyValue(property).trim();

            if (value.endsWith('ms')) {
                const duration = Number.parseFloat(value);
                return Number.isFinite(duration) ? duration : fallback;
            }
            if (value.endsWith('s')) {
                const duration = Number.parseFloat(value) * 1000;
                return Number.isFinite(duration) ? duration : fallback;
            }
            return fallback;
        },
        returnToHistoryIndex() {
            const lastComponent = this.components[this.components.length - 1];
            if (lastComponent && lastComponent.hasHistoryIndex()) {
                return lastComponent.returnToHistoryIndex();
            }
            return false;
        },
        async push(options: PushOptions) {
            return await this.runQueue(async () => {
                if (options.components.length === 0) {
                    console.error('Missing component when pushing');
                    return;
                }
                (document.activeElement as any)?.blur();
                const components = options.components;
                const component = components[components.length - 1];

                // shouldAnimate: boolean | null = null, replace = 0, reverse = false, replaceWith: ComponentWithProperties[] = [], popOptions: PopOptions = {}
                const destroy = options.destroy ?? true;
                const force = options.force ?? false;
                const animated = this.shouldAnimate() ? (options.animated === undefined ? component.animated : options.animated) : false;

                let replace = options.replace ?? 0;
                if (replace > this.components.length) {
                    replace = this.components.length;
                }

                if (ComponentWithProperties.debug) console.log('Pushing new component on navigation controller: ' + component.component.name);

                if (replace > 0) {
                    // Check if we are allowed to dismiss them all.
                    // If one fails, we skip everything.
                    if (destroy && !force) {
                        for (let index = this.components.length - 1; index >= this.components.length - replace; index--) {
                            const component = this.components[index];
                            const r = await component.shouldNavigateAway();
                            if (!r) {
                                return;
                            }
                        }
                    }
                }

                if (!animated) {
                    this.cancelContentAnimation();
                    this.unfreezeSize();
                    this.transitionName = 'none';
                } else {
                    this.transitionName = this.animationType === 'modal' ? 'modal-push' : options.reverse ? 'pop' : 'push';
                }

                // Add the client height from the saved height (check pop method for information)
                // Check if we have an internal scroll position
                const internalScrollElement = this.getInternalScrollElement();
                const internalClientHeight = internalScrollElement?.clientHeight;

                // Save scroll position
                this.savedInternalScrollPositions.push((internalScrollElement?.scrollTop ?? 0) + (internalClientHeight ?? 0));
                this.nextInternalScrollPosition = 0;

                // Save width and height
                if (animated) {
                    this.freezeSize();
                }

                // Make sure the transition name changed, so wait for a rerender
                let popped: ComponentWithPropertiesType[] = [];
                let forceOneAdjust = false;
                const adjustHistory = options?.adjustHistory ?? true;

                if (replace > 0) {
                    popped = this.components.splice(this.components.length - replace, replace, ...components);

                    if (!destroy) {
                        // Stop destroy
                        for (const comp of popped) {
                            comp.keepAlive = true;
                        }
                    }

                    // Back/forward buttons won't work anymore in a reliable/predicable way
                    if (this.components.length <= components.length) {
                        const lastComponent = popped[0];
                        if (HistoryManager.active) {
                            if (lastComponent && lastComponent.hasHistoryIndex()) {
                                HistoryManager.returnToHistoryIndex(lastComponent.historyIndex!.index - 1);
                                forceOneAdjust = true;
                            } else {
                                console.log('Last removed component has no history index', popped);
                                HistoryManager.invalidateHistory();
                            }
                        }
                    } else {
                        const lastComponent = this.components[this.components.length - components.length - 1];
                        if (lastComponent && lastComponent.hasHistoryIndex()) {
                            lastComponent.returnToHistoryIndex();
                            forceOneAdjust = true;
                        } else {
                            console.log('Last visible component has no history index', lastComponent);
                            HistoryManager.invalidateHistory();
                        }
                    }
                } else {
                    this.components.push(...components);
                }

                if (this.mainComponent) {
                    // Keep the component alive while it is removed from the DOM, unless it is being replaced
                    this.mainComponent.keepAlive = !replace || !destroy;
                }

                // We can provide a back action

                for (const [index, component] of components.entries()) {
                    if (index === 0 && popped.length && adjustHistory) {
                        HistoryManager.pushState(null, async (canAnimate: boolean) => {
                            if (!this.mainComponent) {
                                console.error('Tried to pop NavigationController, but it was already unmounted');
                                return;
                            }

                            await this.push({
                                animated: animated && canAnimate,
                                replace: 1,
                                components: popped,
                                reverse: !(options.reverse ?? false),
                                adjustHistory: false,
                            });
                        }, {
                            adjustHistory: adjustHistory || forceOneAdjust,
                            invalid: options.invalidHistory ?? false,
                        });
                        forceOneAdjust = false;
                    } else {
                        HistoryManager.pushState(null, async (canAnimate: boolean) => {
                            if (!this.mainComponent) {
                                console.error('Tried to pop NavigationController, but it was already unmounted');
                                return;
                            }

                            await this.pop({ animated: animated && canAnimate });
                        }, {
                            adjustHistory: adjustHistory || forceOneAdjust,
                            invalid: options.invalidHistory ?? false,
                        });
                    }
                    forceOneAdjust = false;
                    component.assignHistoryIndex();
                }
                // }
                // else {
                //    // Todo: implement back behaviour
                //    for (const [index, component] of components.entries()) {
                //        // if (!replace || this.components.length !== components.length) {
                //        HistoryManager.pushState(undefined, (!!replace && index === 0)
                //            ? async (animated: boolean) => {
                //                // Simply pop
                //                await this.pop({ animated, count: components.length });
                //            }
                //            : null, {
                //            adjustHistory: (!!replace && index === 0), // for the first one we need to adjust the history because we returned earlier
                //            invalid: options.invalidHistory ?? false,
                //        });
                //        // }
                //        // Assign history index
                //        component.assignHistoryIndex();
                //    }
                // }

                this.mainComponent = component;
                this.$emit('didPush');

                // Await mount
                await this.$nextTick();
            });
        },
        async shouldNavigateAway(): Promise<boolean> {
            for (let index = this.components.length - 1; index >= 0; index--) {
                const component = this.components[index];
                const r = await component.shouldNavigateAway();
                if (!r) {
                    return false;
                }
            }
            return true;
        },
        popToRoot(options: PopOptions = {}) {
            options.count = this.components.length - 1;
            return this.pop(options);
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
        async pop(options: PopOptions = {}): Promise<ComponentWithProperties[] | undefined> {
            return await this.runQueue(async () => {
                (document.activeElement as any)?.blur();

                const animated = this.shouldAnimate() ? (options.animated ?? true) : false;
                const destroy = options.destroy ?? true;
                const count = options.count ?? 1;
                const force = options.force ?? false;

                if (this.components.length <= count) {
                    const parentPop = unref(this.reactive_navigation_pop) as any;

                    // Prevent multiple count pop across modal levels
                    options.count = 1;

                    if (!parentPop) {
                        console.error("Tried to pop an empty navigation controller, but couldn't find a parent to pop");
                        return;
                    }
                    return await parentPop(options);
                }

                if (count === 0) {
                    return;
                }

                if (destroy && !force) {
                    for (let index = this.components.length - 1; index >= this.components.length - count; index--) {
                        const component = this.components[index];
                        const r = await component.shouldNavigateAway();
                        if (!r) {
                            return;
                        }
                    }
                }

                if (!animated) {
                    this.cancelContentAnimation();
                    this.unfreezeSize();
                    this.transitionName = 'none';
                } else {
                    this.transitionName = this.animationType === 'modal' ? 'modal-pop' : 'pop';
                    this.freezeSize();
                }

                const popped = this.components.splice(this.components.length - count, count);

                if (!destroy) {
                    // Stop destroy
                    for (const comp of popped) {
                        comp.keepAlive = true;
                    }
                }

                // Remove the client height from the saved height (since this includes the client height so we can correct any changes in client heigth ahead of time)
                // We need this because when we set the height of the incoming view, we cannot reliably detect the maximum scroll height due some mobile browser glitches
                this.nextInternalScrollPosition = Math.max(0, (this.savedInternalScrollPositions.pop() ?? 0));

                this.mainComponent = this.components[this.components.length - 1];

                this.mainComponent.returnToHistoryIndex();

                // Await mount
                await this.$nextTick();

                this.$emit('didPop');
                return popped;
            });
        },
        beforeEnter(insertedElement: Element) {
            if (this.transitionName == 'none') {
                return;
            }

            // We need to set the class already to hide the incoming element
            insertedElement.className = this.transitionName + '-enter-active ' + this.transitionName + '-enter-from';
        },
        beforeLeave(leavingElement: Element) {
            if (this.transitionName == 'none') {
                return;
            }
            // We need to set the class already to hide the incoming element
            leavingElement.className = this.transitionName + '-leave-active ';
        },
        beforeBeforeEnterAnimation() {
            if (this.mainComponent) {
                const instance: any = this.mainComponent.componentInstance();
                if (instance && instance.beforeBeforeEnterAnimation) {
                    instance.beforeBeforeEnterAnimation();
                }
            }
        },
        finishedEnterAnimation() {
            if (this.mainComponent) {
                const instance: any = this.mainComponent.componentInstance();
                if (instance && instance.finishedEnterAnimation) {
                    instance.finishedEnterAnimation();
                }
            }
        },
        enter(element: any, done: () => void) {
            if (this.transitionName === 'none') {
                const internal = this.getInternalScrollElement(element);
                if (internal) {
                    internal.scrollTop = Math.max(0, this.nextInternalScrollPosition - internal.clientHeight);
                }

                done();
                return;
            }

            // Allow scrollTop override in a specified handler
            // Call before
            // if (this.mainComponent) {
            //     const instance: any = this.mainComponent.componentInstance()
            //     if (instance && instance.beforeBeforeEnterAnimation) {
            //         instance.beforeBeforeEnterAnimation()
            //     }
            // }

            requestAnimationFrame(() => {
                // First group all the reads before making layout changes

                const w = ((element.firstElementChild as HTMLElement).firstElementChild as HTMLElement).offsetWidth;
                const h = (element.firstElementChild as HTMLElement).offsetHeight;

                const internal = this.getInternalScrollElement(element);
                let nextInternal = this.nextInternalScrollPosition;
                if (internal) {
                    nextInternal = Math.max(0, this.nextInternalScrollPosition - internal.clientHeight);
                    const scrollOuterHeight = this.getScrollOuterHeight(internal);
                    const h = internal.scrollHeight;

                    if (nextInternal > h - scrollOuterHeight) {
                        nextInternal = Math.max(0, h - scrollOuterHeight);
                    }
                }

                // Prepare animation
                const childElement = element.firstElementChild as HTMLElement;

                const transitionDuration = this.getNavigationTransitionDuration();

                // Layout changes

                if (this.transitionName == 'push' || this.transitionName == 'pop' || this.transitionName == 'modal-push') {
                    childElement.style.willChange = 'transform';
                }

                if (internal) {
                    internal.style.willChange = 'scroll-position';
                }

                // Lock position if needed
                // This happens before the beforeLeave animation frame!
                // When the incoming main component signaled that it has no content yet (e.g. an
                // async component that is still loading), we keep the previous (frozen) size
                // instead of collapsing to the height of the empty placeholder. The size will be
                // animated to the real height once the content arrives (see setContentState).
                if (this.hasContent()) {
                    this.growSize(w, h);
                }

                // Disable scroll during animation (this is to fix overflow elements)
                // We can only allow scroll during transitions when all browser support overflow: clip, which they don't atm
                // This sometimes doesn't work on iOS Safari on body due to a bug
                requestAnimationFrame(() => {
                    // Wait and execute immediately after beforeLeave's animation frame
                    // Let the OS rerender once so all the positions are okay after dom insertion
                    if (internal) {
                        internal.scrollTop = nextInternal;
                    }

                    // We've reached our initial positioning and can start our animation
                    element.className = this.transitionName + '-enter-active ' + this.transitionName + '-enter-to';

                    setTimeout(() => {
                        element.style.willChange = '';
                        childElement.style.willChange = '';
                        if (internal) {
                            internal.style.willChange = '';
                        }

                        done();
                    }, transitionDuration + 25);
                });
            });
        },
        getScrollOuterHeight(scrollElement: HTMLElement) {
            let h = scrollElement.clientHeight;
            if (scrollElement === document.documentElement) {
                // Fix viewport glitch
                const w = window as any;
                if (w.visualViewport) {
                    h = w.visualViewport.height;
                }
            }
            return h;
        },
        leave(element: any, done: () => void) {
            if (this.transitionName == 'none') {
                done();
                return;
            }

            // Prepare animation
            const childElement = element.firstElementChild as HTMLElement;
            childElement.style.willChange = 'transform';

            const transitionDuration = this.getNavigationTransitionDuration();

            // This animation frame is super important to prevent flickering on Safari and Webkit!
            // This is also one of the reasons why we cannot use the default Vue class additions
            // We do this to improve the timing of the classes and scroll positions
            requestAnimationFrame(() => {
                // Prevent blinking due to slow rerender after scrollTop changes
                // Create a clone and offset the clone first. After that, adjust the scroll position
                const h = (this.$el as HTMLElement).offsetHeight;
                const w = (this.$el as HTMLElement).offsetWidth;
                const height = h + 'px';
                const width = w + 'px';

                // Setting the class has to happen in one go.
                // First we need to make our element fixed / absolute positioned, and pinned to all the edges
                // In the same frame, we need to update the scroll position.
                // If we switch the ordering, this won't work!
                element.className = this.transitionName + '-leave-active ' + this.transitionName + '-leave-from';

                element.style.top = '0px';
                element.style.height = height;
                element.style.width = width;

                element.style.bottom = 'auto';
                element.style.overflow = 'hidden';

                // Now scroll!
                childElement.style.overflow = 'hidden';
                childElement.style.height = height;
                childElement.style.width = width;

                // childElement.scrollTop = current;

                requestAnimationFrame(() => {
                    // We've reached our initial positioning and can start our animation
                    element.className = this.transitionName + '-leave-active ' + this.transitionName + '-leave-to';

                    setTimeout(() => {
                        element.style.overflow = '';
                        element.style.top = '';
                        element.style.height = '';
                        element.style.bottom = '';
                        childElement.style.overflow = '';
                        childElement.style.willChange = '';
                        done();
                    }, transitionDuration + 25);
                });
            });
        },
        afterLeave(element: any) {
            if (this.transitionName == 'none') {
                return;
            }

            element.className = '';
        },
        afterEnter(element: any) {
            if (this.transitionName == 'none') {
                return;
            }
            element.className = '';

            // Keep the size frozen while the main component has no content yet, or while a
            // content-height animation is still running. unfreezeSize will be called once the
            // content arrives (see setContentState / animateToContentHeight).
            if (!this.hasContent() || this.animatingContent) {
                return;
            }
            this.unfreezeSize();
        },
        enterCancelled(_element: any) {
            // Mirror afterEnter: keep the size frozen while the main component has no content yet,
            // or while a content-height animation is running, so a cancelled enter (e.g. during
            // rapid push/pop) does not collapse the loading view mid-transition.
            if (!this.hasContent() || this.animatingContent) {
                return;
            }
            this.unfreezeSize();
        },
    },
});
export default NavigationController;

export function wrapWithNavigationController(component: ComponentWithProperties) {
    if (component.component === NavigationController) {
        return component;
    }
    return new ComponentWithProperties(NavigationController, {
        root: component,
    });
}
</script>

<style lang="scss">
.navigation-controller {
    // Scrolling should happen inside the children!
    overflow: visible;
    position: relative;

    > div {
        //width: fit-content;
        //height: fit-content;
    }

    > .modal {
        &-push {
            &-enter-from,
            &-enter-active {
                position: relative;
                z-index: 100;

                & > div {
                    min-height: 100vh;
                    min-height: calc(var(--vh, 1vh) * 100);
                    background: white;
                    background: var(--color-white, white);

                    will-change: transform;

                    transition: transform var(--navigation-transition-duration, 300ms) cubic-bezier(0.0, 0.0, 0.2, 1);
                    transform: translateY(100vh);
                }
            }

            &-leave-from,
            &-leave-active {
                position: absolute;
                pointer-events: none;

                // During leave animation, the div inside this container will transition to the left, causing scroll offsets
                // We'll need to ignore these
                //overflow: hidden !important;
                top: 0px;
                left: 0px;
                right: 0px;
                bottom: 0px;
                contain: strict;

                // Darkness in sync with enter animation
                transition: filter var(--navigation-transition-duration, 300ms);

                & > div {
                    //overflow: hidden !important;
                    width: 100%;
                    height: 100%;
                }
            }

            &-enter-to {
                & > div {
                    transform: translateY(0);
                }
            }

            &-leave-to {
                filter: brightness(80%);
            }
        }

        &-pop {
            &-leave-active {
                & > div {
                    transition: transform var(--navigation-pop-transition-duration, 250ms) cubic-bezier(0.4, 0.0, 1, 1);
                }
            }

            &-leave-from,
            &-leave-active {
                position: absolute;
                z-index: 10000;
                pointer-events: none;

                // During leave animation, the div inside this container will transition to the left, causing scroll offsets
                // We'll need to ignore these
                //overflow: hidden !important;
                top: 0px;
                left: 0px;
                right: 0px;
                bottom: 0px;

                & > div {
                    //overflow: hidden !important;
                    background: white;
                    background: var(--color-white, white);
                    width: 100%;
                    height: 100%;
                }
            }

            &-enter-from,
            &-enter-active {
                position: relative;
            }

            &-leave-to {
                & > div {
                    transform: translateY(100vh);
                }
            }
        }
    }

    > .push {
        &-enter-active {
            user-select: none;

            & > div {
                transition: transform var(--navigation-transition-duration, 300ms);
            }
        }

        &-leave-active {
            user-select: none;

            // Darkness in sync with enter animation
            transition: filter var(--navigation-transition-duration, 300ms);

            & > div {
                transition: transform var(--navigation-transition-duration, 300ms);
            }
        }

        &-enter-from,
        &-enter-active {
            position: relative;
            z-index: 1000;

            & > div {
                will-change: transform;
            }
        }

        &-leave-from,
        &-leave-active {
            position: absolute;
            pointer-events: none;

            // During leave animation, the div inside this container will transition to the left, causing scroll offsets
            // We'll need to ignore these
            //overflow: hidden !important;
            top: 0px;
            left: 0px;
            right: 0px;
            bottom: 0px;
            will-change: filter;
            contain: strict;

            // Top, left and bottom will get adjusted

            & > div {
                //overflow: hidden !important;
                width: 100%;
                height: 100%;
                contain: strict;
                will-change: transform;
            }
        }

        &-leave-to /* .fade-leave-active below version 2.1.8 */ {
            filter: brightness(80%);
        }

        /*&-enter-from, &-leave-to {
            opacity: 0;
        }*/

        &-enter-from {
            & > div {
                transform: translateX(100%);

                // RTL support
                transform: translateX(calc(100% * var(--direction-scale-x, 1)));
            }
        }

        &-leave-to {
            & > div {
                transform: translateX(-40%);

                // RTL support
                transform: translateX(calc(-40% * var(--direction-scale-x, 1)));
            }
        }
    }

    > .pop {
         &-enter-active {
            user-select: none;

            // Opacity in sync with leave
            transition: filter var(--navigation-pop-transition-duration, 250ms);

            & > div {
                transition: transform var(--navigation-pop-transition-duration, 250ms);
            }
        }

        &-leave-active {
            user-select: none;

            & > div {
                transition: transform var(--navigation-pop-transition-duration, 250ms);
            }
        }

        &-enter-from,
        &-enter-active {
            position: relative;

            & > div {
                will-change: transform;
            }
        }

        &-leave-from,
        &-leave-active {
            position: absolute;
            pointer-events: none;
            //overflow: hidden !important;
            top: 0px;
            left: 0px;
            right: 0px;
            bottom: 0px;
            z-index: 1000;

            contain: strict;

            & > div {
                //overflow: hidden !important;
                width: 100%;
                height: 100%;
                will-change: transform;
                contain: strict;
            }
        }

        &-enter-from/*, &-leave-to *//* .fade-leave-active below version 2.1.8 */ {
            filter: brightness(80%);
        }

        &-enter-from {
            & > div {
                transform: translateX(-40%);

                // RTL support
                transform: translateX(calc(-40% * var(--direction-scale-x, 1)));
            }
        }

        &-leave-to {
            & > div {
                transform: translateX(100%);

                // RTL support
                transform: translateX(calc(100% * var(--direction-scale-x, 1)));
            }
        }
    }
}
</style>
