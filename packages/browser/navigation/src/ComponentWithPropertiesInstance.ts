// eslint-disable-next-line vue/prefer-import-from-vue
import { invokeArrayFns, ShapeFlags } from '@vue/shared';
import { callWithAsyncErrorHandling, type ComponentInternalInstance, type ComponentOptions, computed, defineComponent, type ElementNamespace, ErrorCodes, getCurrentInstance, h, inject, onActivated, onBeforeMount, onBeforeUnmount, onMounted, onUnmounted, onUpdated, provide, queuePostFlushCb, type RendererElement, type RendererNode, setTransitionHooks, shallowRef, unref, type VNode, warn } from 'vue';
import { ComponentWithProperties, HistoryIndex } from './ComponentWithProperties';
import { ReactiveUrl } from './utils/navigationHooks';

export function invokeVNodeHook(
    hook: any,
    instance: ComponentInternalInstance | null,
    vnode: VNode,
    prevVNode: VNode | null = null,
) {
    callWithAsyncErrorHandling(hook, instance, ErrorCodes.VNODE_HOOK, [
        vnode,
        prevVNode,
    ]);
}

function getInnerChild(vnode: VNode) {
    return vnode.shapeFlag & ShapeFlags.SUSPENSE ? (vnode as any).ssContent! : vnode;
}

export interface ComponentRenderContext {
    [key: string]: any;
    _: ComponentInternalInstance;
}

export interface KeepAliveContext extends ComponentRenderContext {
    activate: (
        vnode: VNode,
        container: RendererElement,
        anchor: RendererNode | null,
        namespace: ElementNamespace,
        optimized: boolean,
    ) => void;
    deactivate: (vnode: VNode) => void;
}

export enum MoveType {
    ENTER,
    LEAVE,
    REORDER,
}

function resetShapeFlag(vnode: VNode) {
    // bitwise operations to remove keep alive flags
    vnode.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
    vnode.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE;
}

// extend ComponentInternalInstance type with provides attribute
declare module '@vue/runtime-core' {
    interface ComponentInternalInstance {
        provides: Record<string, unknown>;
        children: ComponentInternalInstance[] | undefined | null;
    }
}

/**
 * Because 'inject()' just returns a reference that isn't reactive, this creates the issue that when a component swithces
 * location in the component tree, the 'injects' don't read the new value when the parent provides change.
 */
function makeProvidesParentReactive(instance: ComponentInternalInstance) {
    // This makes instance / parent reactive
    const reactiveInstance = shallowRef(instance);
    const originalProvides = instance.provides;

    // Detect own provides (because these won't need to be proxied)
    const ownProvides = instance.provides === instance.parent?.provides ? [] : Object.getOwnPropertyNames(originalProvides);

    // Warning: this is complex an relies on the fact that vue
    // extends object provides with Object.create every time a
    // component provides a key for the first time
    const proxyProvider = new Proxy({}, {
        get(_target: any, key: string) {
            if (typeof key !== 'string' || !key.startsWith('reactive_')) {
                return originalProvides[key];
            }

            // We'll only make values reactive if the user supports this, meaning that they are already a reference or reactive object.
            if (key in ownProvides) {
                return originalProvides[key];
            }

            // key here is that the parent of instance could have changed
            // so that is why we need computed, so all provides will return the correct value
            // return instance.parent?.provides[key];
            return computed(() => {
                return unref(reactiveInstance.value.parent?.provides[key]);
            });
        },
        // Vue valides keys using 'a' in obj, so we need to handle this correctly
        has() {
            // All keys are accessible because we are reactive and can add them at any time later
            return true;
        },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    instance.provides = Object.create(proxyProvider);

    // Returns reactive property to change instance (which happens every time the parent changes)
    return reactiveInstance;
}

export default defineComponent({
    name: 'ComponentWithPropertiesInstance',
    props: {
        component: {
            type: ComponentWithProperties,
            required: true,
        },
        customProvide: {
            required: false,
            type: Object,
            default: null,
        },
    },
    __isKeepAlive: true,
    setup(props: { component: ComponentWithProperties; customProvide?: Record<string, unknown> }, context) {
        const instance = getCurrentInstance()! as any;
        const sharedContext = (instance as any).ctx as KeepAliveContext;

        // Provides needs to be made reactive before adding new provides
        const reactiveInstance = makeProvidesParentReactive(instance);

        if (props.customProvide) {
            for (const key in props.customProvide) {
                if (key.startsWith('reactive_')) {
                    provide(key, computed(() => unref(props.customProvide?.[key])));
                }
                else {
                    provide(key, props.customProvide[key]);
                }
            }
        }

        provide('navigation_currentComponent', props.component);

        const parentHistory = inject<HistoryIndex | null>('navigation_historyIndex', null);
        if (parentHistory !== null) {
            props.component.inheritHistoryIndex(parentHistory);
        }
        const parent = inject<ComponentWithProperties | null>('navigation_parent', null);
        if (parent !== null) {
            props.component.inheritFromParent(parent);
        }
        provide('navigation_parentComponent', parent);
        provide('navigation_historyIndex', props.component.historyIndex);

        // Make sure decendents can inherit the provides
        provide('navigation_parent', props.component);

        const combinedProvide = props.component.combinedProvide;
        for (const key in combinedProvide) {
            provide(key, combinedProvide[key]);
        }

        const disableUrl = inject<boolean | null>('reactive_navigation_disable_url', null);
        const inheritedUrlRaw = inject<ReactiveUrl | null>('reactive_navigation_url', null);

        const updateUrl = () => {
            // We cannot inherit here because url could be set on component itself
            // if not set, we are probably the root view, so we can set the url to an empty url
            const url: ReactiveUrl | null = unref(props.component.combinedProvide.reactive_navigation_url) ?? unref(inheritedUrlRaw) ?? null;

            const disableUrlUnwrapped = unref(disableUrl) ?? false;

            if (!disableUrlUnwrapped) {
                if (url && !(url instanceof ReactiveUrl)) {
                    console.error('Unexpected reactive_navigation_url', url);
                }
                else {
                    props.component.setUrl(url);
                }
            }
        };

        onActivated(() => {
            updateUrl();
        });

        // onActivated is not always called reliably here
        onMounted(() => {
            updateUrl();
        });

        const {
            renderer: {
                p: patch,
                m: move,
                um: _unmount,
            },
        } = sharedContext;
        const parentSuspense = (instance as any).suspense;

        sharedContext.activate = (
            vnode,
            container,
            anchor,
            namespace,
            optimized,
        ) => {
            const instance = vnode.component! as any;
            move(vnode, container, anchor, MoveType.ENTER, parentSuspense);

            // We never allow to change props 🙏, so we can skip the patch
            // in case props have changed
            patch(
                instance.vnode,
                vnode,
                container,
                anchor,
                instance,
                parentSuspense,
                namespace,
                (vnode as any).slotScopeIds,
                optimized,
            );
            queuePostFlushCb(() => {
                instance.isDeactivated = false;
                if (instance.a) {
                    invokeArrayFns(instance.a);
                }
                const vnodeHook = vnode.props && vnode.props.onVnodeMounted;
                if (vnodeHook) {
                    invokeVNodeHook(vnodeHook, instance.parent, vnode);
                }
            });

            // if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            //     // Update components tree
            //     devtoolsComponentAdded(instance)
            // }
        };

        sharedContext.deactivate = (vnode: VNode) => {
            const instance = vnode.component! as any;

            // This causes an issue with leave animations because the element is removed from the DOM
            // move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)
            queuePostFlushCb(() => {
                if (instance.da) {
                    invokeArrayFns(instance.da);
                }
                const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted;
                if (vnodeHook) {
                    invokeVNodeHook(vnodeHook, instance.parent, vnode);
                }
                instance.isDeactivated = true;
            });
        };

        function unmount(vnode: VNode) {
            if (current) {
                const { subTree } = instance;
                const _innerVnode = getInnerChild(subTree);

                if (vnode.type === _innerVnode.type && vnode.key === _innerVnode.key) {
                    // current instance will be unmounted as part of keep-alive's unmount
                    // so we should not call unmount manually - only the deactivate hook will be called manually
                    resetShapeFlag(_innerVnode);
                    // but invoke its deactivated hook here
                    const da = _innerVnode.component!.da;
                    da && queuePostFlushCb(da);
                    return;
                }
            }

            resetShapeFlag(vnode);

            // reset the shapeFlag so it can be properly unmounted
            _unmount(vnode, instance, parentSuspense, true);
        }

        let current: VNode | null = null;

        function getChildVNode() {
            return instance.vnode?.component?.subTree?.component?.vnode;
        }

        onBeforeUnmount(() => {
            if (!current) {
                // Not yet correctly mounted, or already unmounted.
                return;
            }

            const child = getChildVNode();
            if (!child) {
                console.error('No child found in ComponentWithPropertiesInstance.beforeUnmount');
                return;
            }

            // we need to know this inside the .destroy method, so we can properly unmount it
            if (props.component.unmount === unmount) {
                props.component.destroy(getChildVNode());
            }
            else {
                console.warn('ComponentWithPropertiesInstance unmount called with different unmount function');
            }

            // The componentWithPropertiesInstance is unmounted and won't get reused, but the vnode internally might
            // the reference to the unmount method will still get used to properly unmount the kept alive vnode.
            current = null;
        });

        onBeforeMount(() => {
            props.component.beforeMount();
        });
        onUnmounted(() => {
            props.component.onUnmounted();
        });

        let pendingCacheKey: any | null = null;

        // cache sub tree after render
        const cacheSubtree = () => {
            if (current && pendingCacheKey != null) {
                const child = getChildVNode();
                if (!child) {
                    console.error('No child found in ComponentWithPropertiesInstance.cacheSubtree');
                    return;
                }
                props.component.vnode = child;
                props.component.unmount = unmount;
                if (!(child as any)._reactiveInstance) {
                    (child as any)._reactiveInstance = reactiveInstance;
                }
            }
        };
        onMounted(cacheSubtree);
        onUpdated(cacheSubtree);

        return () => {
            pendingCacheKey = null;

            if (!props.component) {
                warn('No component provided to ComponentWithPropertiesInstance');
                current = null;
                return null;
            }

            props.component.component.inheritAttrs = false;

            const vnode = h(props.component.component, { ...props.component.properties, ...context.attrs });
            const comp = vnode.type;
            const key = vnode.key == null ? comp : vnode.key;
            pendingCacheKey = key;

            // If we have a cached vnode: copy the mounted state
            if (props.component.vnode) {
                const cachedVNode = props.component.vnode;
                // Alias for better readability
                const parent = instance;

                // copy over mounted state
                vnode.el = cachedVNode.el;
                vnode.component = cachedVNode.component;

                if (!(cachedVNode as any)._reactiveInstance) {
                    console.warn('Missing _reactiveInstance on vnode');
                }
                else {
                    (cachedVNode as any)._reactiveInstance.value = parent;
                }

                if (vnode.transition) {
                    // recursively update transition hooks on subTree
                    setTransitionHooks(vnode, vnode.transition!);
                }

                // avoid vnode being mounted as fresh
                vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
            }

            // avoid vnode being unmounted
            vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;

            // We'll only cache the vnode on the mount/update hooks because the vnode might still get swapped by vue
            current = vnode;
            return vnode;
        };
    },
}) as unknown as ComponentOptions; // required when using this component in 'components' property
