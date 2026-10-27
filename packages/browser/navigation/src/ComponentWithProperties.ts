import { type ComponentInternalInstance, type ComponentPublicInstance, inject, markRaw, proxyRefs, type Raw, reactive, type Ref, ref, unref, type VNode } from 'vue';

import { HistoryManager, type HistoryUrl } from './HistoryManager';
import type { Route } from './utils/navigationHooks';

export type ModalDisplayStyle = 'cover' | 'popup' | 'overlay' | 'sheet' | 'side-view';

/** Setup-only access to this view's navigation wrapper; null when it was not rendered through the navigation framework. */
export function useCurrentComponent(): ComponentWithPropertiesType | null {
    return inject('navigation_currentComponent', null) as ComponentWithPropertiesType | null;
}
export function useParentComponent(): ComponentWithPropertiesType | null {
    return inject('navigation_parentComponent', null) as ComponentWithPropertiesType | null;
}

// Sadly getExposeProxy is not exposed from Vue so we have to mimic it
export function getExposeProxy(instance: ComponentInternalInstance | null | undefined) {
    if (!instance) {
        return;
    }
    if (!instance.exposed) {
        return;
    }
    if (instance.exposeProxy) {
        return instance.exposeProxy as ComponentPublicInstance;
    }

    const extendingProxy = instance.proxy as any;
    instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key: string) {
            if (key in target) {
                return target[key];
            }
            return extendingProxy[key];
        },
        has(target, key: string) {
            return key in target || key in extendingProxy;
        },
    });
    return instance.exposeProxy as ComponentPublicInstance;
}

export class HistoryIndex {
    index: number;

    constructor(index: number) {
        this.index = index;
    }
}

function deepClone(root: ComponentWithProperties, alreadyProcessed?: Map<ComponentWithPropertiesType, ComponentWithPropertiesType>) {
    const handled = alreadyProcessed ?? new Map<ComponentWithPropertiesType, ComponentWithPropertiesType>(); // to avoid recursive calling
    const replaced = root.clone();
    replaced.properties = { ...replaced.properties };
    handled.set(root, replaced);

    for (const key in replaced.properties) {
        let v = replaced.properties[key];
        if (v instanceof ComponentWithProperties) {
            replaced.properties[key] = deepClone(v, handled);
        }
        if (Array.isArray(v) && v.length) {
            replaced.properties[key] = [...v];
            v = replaced.properties[key];

            for (let index = 0; index < v.length; index++) {
                const element = v[index];
                if (element instanceof ComponentWithProperties) {
                    v[index] = deepClone(element, handled);
                }
            }
        }
    }
    return replaced;
}

export function forAllRoots(root: ComponentWithProperties, handler: (root: ComponentWithPropertiesType) => void, alreadyProcessed?: Set<ComponentWithPropertiesType>) {
    const handled = alreadyProcessed ?? new Set(); // to avoid recursive calling
    handler(root);
    handled.add(root);

    for (const key in root.properties) {
        const v = root.properties[key];
        if (v instanceof ComponentWithProperties) {
            forAllRoots(v, handler, handled);
        }
        if (Array.isArray(v) && v.length) {
            const lastItem = v[v.length - 1];
            if (lastItem instanceof ComponentWithProperties) {
                forAllRoots(lastItem, handler, handled);
            }
        }
    }
}

/** Sadly we  cannot really tell TypeScript that ComponentWithProperties is always Raw */
export type ComponentWithPropertiesType = Raw<ComponentWithProperties>;
export class ComponentWithProperties {
    /// Name of component or component Options. Currently no way to force type
    public component: any;
    public properties: Record<string, any>;

    public provide: Record<string, any>;
    public inheritedDisplayerProvide: Record<string, any> = {};
    public inheritedParentProvide: Record<string, any> = {};

    public key: number;
    public type: string | null = null;

    /// Saved vnode of this instance
    public vnode: VNode | null = null;
    public unmount: ((vnode: VNode) => void) | null = null;

    // Keep the vnode alive when it is removed from the VDOM
    public keepAlive = false;
    public isKeptAlive = false;

    // Counter for debugging. Count of components that are kept alive but are not mounted.
    static keepAliveCounter = 0;
    static keyCounter = 0;
    static debug = false;

    /// Cover whole screen. Other style = popup
    public modalDisplayStyle: ModalDisplayStyle = 'cover';

    // If the display animation should be animated
    public animated = true;
    public checkRoutes = false; // Setting this will allow the component to check the routes on the next activation
    public navigationRoutes: Route[] = [];
    public keepNavigationRoutes = false;
    public isDismissing = ref(false); // Custom state for stack items that need to navigate way without being removed from the dom

    // Hisotry index
    public historyIndex: HistoryIndex | null = null;

    static historyIndexOwners = new Map<number, ComponentWithProperties>();

    public forceCanHaveFocus: Ref<boolean> = ref(false); // Automatically true if it has a history state

    // private static ignoreActivate: ComponentWithProperties | null = null

    setCheckRoutes() {
        forAllRoots(this, (c) => {
            c.checkRoutes = true;
        });
        return this;
    }

    constructor(component: any, properties: Record<string, any> = {}, options?: { keepNavigationRoutes?: boolean; forceCanHaveFocus?: boolean; provide?: Record<string, any>; inheritedDisplayerProvide?: Record<string, any>; inheritedParentProvide?: Record<string, any> }) {
        this.component = component;
        this.key = ComponentWithProperties.keyCounter++;
        this.properties = reactive(properties);
        this.provide = options?.provide || {};
        this.inheritedDisplayerProvide = options?.inheritedDisplayerProvide || {};
        this.inheritedParentProvide = options?.inheritedParentProvide || {};
        this.forceCanHaveFocus = ref(options?.forceCanHaveFocus || false);
        this.keepNavigationRoutes = options?.keepNavigationRoutes ?? false;

        // Prevent becoming reactive in any way
        markRaw(this);
    }

    get combinedProvide() {
        return {
            ...this.inheritedParentProvide,
            ...this.inheritedDisplayerProvide, // has priority
            ...this.provide,
        };
    }

    inheritFromDisplayer(component: ComponentWithProperties) {
        // console.log('Inheriting properties from displayer', this.component.name,' from ', component.component.name, component.combinedProvide)

        this.inheritedDisplayerProvide = {
            ...component.combinedProvide,
        };
    }

    inheritFromParent(component: ComponentWithProperties) {
        // console.log('Inheriting properties from parent', this.component.name,' from ', component.component.name, component.combinedProvide)

        this.inheritedParentProvide = {
            ...component.combinedProvide,
        };
    }

    clone() {
        return new ComponentWithProperties(this.component, this.properties, { provide: this.provide, inheritedParentProvide: this.inheritedParentProvide, inheritedDisplayerProvide: this.inheritedDisplayerProvide });
    }

    deepClone() {
        return deepClone(this);
    }

    beforeMount() {
        if (this.vnode) {
            if (this.isKeptAlive) {
                this.isKeptAlive = false;
                ComponentWithProperties.keepAliveCounter--;
                if (ComponentWithProperties.debug) console.log('Total components kept alive: ' + ComponentWithProperties.keepAliveCounter);
            } else {
                if (ComponentWithProperties.debug) console.warn('About to mount a component that was not destroyed properly ' + this.component.name);

                // Destroy the old vnode (unless keep alive), we should not reuse this one
                this.destroy(this.vnode);
            }
        }
    }

    onUnmounted() {
        // this.navigationRoutes = [];
    }

    getHistoryIndex() {
        if (this.component) return this.historyIndex;
    }

    deleteHistoryIndex() {
        this.historyIndex = null;
    }

    hasHistoryIndex() {
        return this.historyIndex !== null;
    }

    canHaveFocus() {
        return this.hasHistoryIndex() || unref(this.forceCanHaveFocus);
    }

    /**
     * This will get called when the component has been pushed somewhere that should count as a new history state
     */
    assignHistoryIndex() {
        if (!HistoryManager.active) {
            return;
        }
        const state = HistoryManager.getCurrentState();

        if (this.historyIndex !== null) {
            this.returnToHistoryIndex();
            return;
        }
        this.historyIndex = new HistoryIndex(state.index);

        if (ComponentWithProperties.debug) console.warn('Assigned index to component', this.component.name ?? this, state.index);
        ComponentWithProperties.historyIndexOwners.set(state.index, this);
    }

    inheritHistoryIndex(index: HistoryIndex) {
        // This sets the default history index
        if (this.historyIndex === null) {
            this.historyIndex = index;
        }
    }

    ownsHistoryIndex() {
        return this.historyIndex !== null && ComponentWithProperties.historyIndexOwners.get(this.historyIndex.index) === this;
    }

    overrideUrl(url: HistoryUrl, title?: string) {
        this.provide.reactive_navigation_url = url;
        this.setUrl(url, title);
    }

    setUrl(url: HistoryUrl, title?: string) {
        if (this.historyIndex === null) {
            if (ComponentWithProperties.debug) console.warn('Tried calling .setUrl on a component that was never assigned a history index. Check if you displayed this component using .show or .present');
            return;
        }

        if (!HistoryManager.active) {
            return;
        }

        if (!this.ownsHistoryIndex()) {
            return;
        }

        HistoryManager.setUrl(url, title, this.historyIndex.index);
    }

    setTitle(title: string) {
        if (!title) {
            return;
        }

        if (this.historyIndex === null) {
            if (ComponentWithProperties.debug) console.warn('Tried calling .setTitle on a component that was never assigned a history index. Check if you displayed this component using .show or .present');
            return;
        }

        if (!HistoryManager.active) {
            return;
        }

        // This does not need to own the history index
        // a decendant of a view can set the title

        HistoryManager.setTitle(title, this.historyIndex.index);
    }

    /**
     * This will get called when the user returned to this component
     */
    returnToHistoryIndex(): boolean {
        if (!HistoryManager.active) {
            return false;
        }

        // It is possible that we don't contain the latest history index, e.g. if we are a navigation controller
        const instance = this.componentInstance() as any;
        if (instance?.returnToHistoryIndex) {
            const worked = instance?.returnToHistoryIndex();
            if (ComponentWithProperties.debug) console.log('returning to instance that has an instance with custom returnToHistoryIndex method', this.component.name, worked);
            if (worked === true) {
                return true;
            }
        }

        if (this.historyIndex === null) {
            if (ComponentWithProperties.debug) console.warn('Returning to a component that has no history index assigned. Has this component been pushed to a navigation controller properly before returning to it?', this.component.name);
            return false;
        }

        if (ComponentWithProperties.debug) console.warn('Returned to component', this.component.name ?? this);
        HistoryManager.returnToHistoryIndex(this.historyIndex.index);
        return true;
    }

    componentInstance(): ComponentPublicInstance | null {
        if (!this.vnode?.component) {
            return null;
        }
        // proxy is not always the one we should use - because vue also has exposeProxy, which contains exposed properties too
        return getExposeProxy(this.vnode?.component) || this.vnode?.component?.proxy;
    }

    /**
     * Consults the mounted view's exposed `shouldNavigateAway(): boolean | Promise<boolean>`.
     * Missing guards allow leaving. A false result vetoes removal; rejected promises propagate.
     * Controllers call this for pop, dismiss and replacement unless `force` is true,
     * not when merely covering a view with another view.
     */
    async shouldNavigateAway(): Promise<boolean> {
        const instance = this.componentInstance() as any;
        if (instance && instance.shouldNavigateAway) {
            const promise = instance.shouldNavigateAway();
            if (typeof promise === 'boolean') {
                if (!promise) {
                    return false;
                }
            } else if (promise.then && promise.catch) {
                const r = (await promise) as boolean;
                if (!r) {
                    return false;
                }
            }
        }
        return true;
    }

    destroy(vnode: VNode) {
        if (this.vnode) {
            if (vnode !== this.vnode) {
                if (ComponentWithProperties.debug) console.warn('Received destroy event from old/different vnode', this.vnode, vnode);
                return;
            }
            if (this.keepAlive) {
                this.keepAlive = false;

                if (!this.isKeptAlive) {
                    this.isKeptAlive = true;
                    ComponentWithProperties.keepAliveCounter++;
                    if (ComponentWithProperties.debug) console.log('Kept component alive ' + this.component.name);
                    if (ComponentWithProperties.debug) console.log('Total components kept alive: ' + ComponentWithProperties.keepAliveCounter);
                }
                return;
            }

            if (this.isKeptAlive) {
                this.isKeptAlive = false;
                ComponentWithProperties.keepAliveCounter--;
                if (ComponentWithProperties.debug) console.log('Freed component from alive stack ' + this.component.name);
                if (ComponentWithProperties.debug) console.log('Total components kept alive: ' + ComponentWithProperties.keepAliveCounter);
            }

            if (ComponentWithProperties.debug) console.log('Destroyed component ' + this.component.name, this.vnode);

            if (this.unmount) {
                this.unmount(this.vnode);

                // Remove reference to unmount method
                this.unmount = null;
            } else {
                console.error('No unmount function for component ' + this.vnode);
            }
            this.deleteHistoryIndex();
            this.vnode = null;

            if (!this.keepNavigationRoutes) {
                this.navigationRoutes = [];
            }
        }
    }

    /**
     * @deprecated
     */
    setDisplayStyle(style: ModalDisplayStyle): ComponentWithProperties {
        this.modalDisplayStyle = style;
        return this;
    }

    /**
     * @deprecated
     */
    setAnimated(animated: boolean): ComponentWithProperties {
        this.animated = animated;
        return this;
    }
}
