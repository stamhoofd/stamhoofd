import type { Ref } from 'vue';
import type { ComponentWithProperties, ModalDisplayStyle } from './ComponentWithProperties.js';
import type { ReactiveUrl } from './utils/navigationHooks.js';

export interface PushOptions {
    /**
     * Insert one or multiple components. Only the last one is animated if animations are required
     */
    components: ComponentWithProperties[];

    /**
     * The url for this new route.
     * Set to null to specifically ignore or extending url (displayed view will copy the previous url - which is not the same as the url of the previous view)
     */
    url?: ReactiveUrl | string | null | undefined | Ref<ReactiveUrl | string | null>;
    // query?: URLSearchParams | null | undefined | Ref<URLSearchParams | null>;

    /**
     * Whether we should push a new real state in the browser history
     */
    adjustHistory?: boolean | undefined;

    /**
     * When the user will click back, the page will reload if this set is true, instead of doing js based navigation
     */
    invalidHistory?: boolean | undefined;

    /**
     * Whether this component was pushed as result of a url reconstruction.
     * Setting this will allow the component to build further on the url reconstruction
     */
    checkRoutes?: boolean | undefined;

    /**
     * Use animations if possible. Default value is the animated property of ComponentWithProperties.
     * In the future, we might remove the animated property of ComponentWithProperties and enable animations by default here.
     */
    animated?: boolean | undefined;

    /**
     * Bypass the exposed shouldNavigateAway guards of replaced views. Defaults to false.
     * Use after a successful save only when discarding the old view is safe.
     */
    force?: boolean | undefined;

    /**
     * Default behaviour should be 'true'. Set to true to indicate that the popped component(s) should get removed from the
     * vdom. If you set this to false, they will be kept in memory. This will set keepAlive to 'true' for the removed
     * components, making it possible to move them around in the DOM.
     */
    destroy?: boolean | undefined;

    /**
     * How many components that need to be popped first (in the same animations, so the pop is invisible). Defaults to 0
     */
    replace?: number | undefined;

    /**
     * Reverse the animation if possible. Defaults to false
     */
    reverse?: boolean | undefined;

    /**
     * Ignore client width checks, always display as modal, also on mobile devices.
     */
    forceModalDisplay?: boolean | undefined;
    /** Requested presentation style; defaults to the component's style, then 'cover'. Popup/sheet may cover on narrow screens. */
    modalDisplayStyle?: ModalDisplayStyle | undefined;
    modalClass?: string | undefined;
    modalCssStyle?: string | undefined;

}
