import { type DefineComponent, inject, type Ref } from 'vue';

import NavigationController from './NavigationController.vue';
import type Popup from './Popup.vue';
import { useNavigationController } from './useNavigationController';
import { useSplitViewController } from './useSplitViewController';
import { injectHooks } from './utils/injectHooks';
import { type NavigationOptions, useCanDismiss, useCanPop, useDismiss, useFocused, useNavigate, usePop, usePresent, useShow, useShowDetail, useUrl } from './utils/navigationHooks';
import { useModalStackComponent } from './utils/useModalStackComponent';

// WARNING: do not add this mixin as a dependency in components that the navigationMixin also depens on -> circular dependency
// Inject the navigation hooks into the component manually in that case

/**
 * @returns To detect whether you are in a popup
 */
export function usePopup(): Ref<InstanceType<typeof Popup> | null> | InstanceType<typeof Popup> | null {
    return inject('reactive_popup', null) as Ref<InstanceType<typeof Popup> | null> | InstanceType<typeof Popup> | null;
}

type Unref<T> = T extends Ref<infer U> ? U : T;

declare module 'vue' {
    interface ComponentCustomOptions {
        navigation?: NavigationOptions<any>;
    }
}

const navigationMethods = {
    setTitle() {
        const navigationOptions = (this as any).$options?.navigation as NavigationOptions<any> | undefined;
        if (!navigationOptions) return;

        // Process routes
        const title = navigationOptions.title;
        if (typeof title === 'function') {
            (this as any).$url.setTitle(title.call(this));
        }
        else {
            (this as any).$url.setTitle(title ?? '');
        }
    },
};

export const NavigationMixin = {
    created(this: any) {
        // we cannot use setup in mixins, but we want to avoid having to duplicate the 'use' hooks logic.
        // so this is a workaround
        const definitions: any = {
            pop: usePop(),
            showDetail: useShowDetail(),
            show: useShow(),
            present: usePresent(),
            dismiss: useDismiss(),
            canPop: useCanPop(),
            canDismiss: useCanDismiss(),
            isFocused: useFocused(),
            emitParents: () => {
                throw new Error('emitParents has been removed and should no longer be needed');
            },
            popup: usePopup(),
            modalStackComponent: useModalStackComponent(),
            navigationController: useNavigationController(),
            splitViewController: useSplitViewController(),
            $url: useUrl(),
            $navigate: useNavigate(),
        };

        injectHooks(this, definitions);
    },
    computed: {
        modalNavigationController(this: any) {
            return this.modalStackComponent.navigationController;
        },
    },
    activated() {
        navigationMethods.setTitle.call(this);
    },
    // eslint-disable-next-line @typescript-eslint/ban-types
} as any as DefineComponent<{}, {}, {
    canPop: Unref<ReturnType<typeof useCanPop>>;
    canDismiss: Unref<ReturnType<typeof useCanDismiss>>;
    isFocused: Unref<ReturnType<typeof useFocused>>;
    popup: Unref<ReturnType<typeof usePopup>>;
    modalStackComponent: Unref<ReturnType<typeof useModalStackComponent>>;
    navigationController: Unref<ReturnType<typeof useNavigationController>>;
    splitViewController: Unref<ReturnType<typeof useSplitViewController>>;
    modalNavigationController: () => InstanceType<typeof NavigationController>;
    $url: Unref<ReturnType<typeof useUrl>>;
    $navigate: Unref<ReturnType<typeof useNavigate>>;
}, {}, {
    show: ReturnType<typeof useShow>;
    showDetail: ReturnType<typeof useShowDetail>;
    present: ReturnType<typeof usePresent>;
    pop: ReturnType<typeof usePop>;
    dismiss: ReturnType<typeof useDismiss>;
}>;
