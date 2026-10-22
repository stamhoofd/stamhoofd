export type SessionPresentationCallbacks = {
    confirm(options: { title: string; confirmText: string; description?: string }): Promise<boolean>;
};

let callbacks: SessionPresentationCallbacks | undefined;

/** Install presentation before interactive authentication flows start. */
export function configureSessionPresentation(presentation: SessionPresentationCallbacks) {
    callbacks = presentation;
}

export function getSessionPresentation(): SessionPresentationCallbacks {
    if (!callbacks) {
        throw new Error('Configure session presentation before using interactive session flows');
    }
    return callbacks;
}
