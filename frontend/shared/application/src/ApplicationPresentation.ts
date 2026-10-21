export type ApplicationPresentationCallbacks = {
    setPrimaryColor(color: string): void;
};

let callbacks: ApplicationPresentationCallbacks | undefined;

/** Install presentation before preparing sessions or creating theme managers. */
export function configureApplicationPresentation(presentation: ApplicationPresentationCallbacks) {
    callbacks = presentation;
}

export function getApplicationPresentation(): ApplicationPresentationCallbacks {
    if (!callbacks) {
        throw new Error('Configure application presentation before using application services');
    }
    return callbacks;
}
