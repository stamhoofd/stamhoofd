export type NetworkingNotification = {
    hide(): void;
};

export type NetworkingConfirmation = {
    title: string;
    confirmText: string;
    description?: string;
};

export type NetworkingPresentationCallbacks = {
    notify(message: string, icon: string, hideAfter?: number | null): NetworkingNotification;
    notifyError(error: unknown, hideAfter?: number | null): NetworkingNotification;
    confirm(options: NetworkingConfirmation): Promise<boolean>;
};

// Headless consumers cannot approve an impersonation confirmation.
export const NetworkingPresentation: NetworkingPresentationCallbacks = {
    notify: () => ({ hide() {} }),
    notifyError: () => ({ hide() {} }),
    confirm: async () => false,
};

export function configureNetworkingPresentation(callbacks: NetworkingPresentationCallbacks) {
    Object.assign(NetworkingPresentation, callbacks);
}
