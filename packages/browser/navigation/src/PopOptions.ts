export interface PopOptions {
    /**
     * Use animations if possible. Default to true.
     */
    animated?: boolean;

    /**
     * Bypass the exposed shouldNavigateAway guards of removed views. Defaults to false.
     * Use after a successful save only when discarding the view is safe.
     */
    force?: boolean;

    /**
     * Default behaviour should be 'true'. Set to true to indicate that the popped component(s) should get removed from the
     * vdom. If you set this to false, they will be kept in memory. This will set keepAlive to 'true' for the removed
     * components, making it possible to move them around in the DOM.
     */
    destroy?: boolean;

    /**
     * How many components you need to pop on the same level. E.g. to pop multiple components from a navigation controller.
     * This doesn't work across modal controllers, specifying 2 will only pop 1 component if the parent navigation controller
     * only has one child component.
     * Default to 1.
     */
    count?: number;
}
