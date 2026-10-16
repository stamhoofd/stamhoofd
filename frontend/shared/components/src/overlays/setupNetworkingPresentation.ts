import { configureNetworkingPresentation } from '@stamhoofd/networking/NetworkingPresentation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';

export function setupNetworkingPresentation() {
    configureNetworkingPresentation({
        notify(message, icon, hideAfter) {
            const toast = new Toast(message, icon);
            if (hideAfter !== undefined) {
                toast.setHide(hideAfter);
            }
            return toast.show();
        },
        notifyError(error, hideAfter) {
            const toast = Toast.fromError(error);
            if (hideAfter !== undefined) {
                toast.setHide(hideAfter);
            }
            return toast.show();
        },
        confirm: options => CenteredMessage.confirm(options),
    });
}
