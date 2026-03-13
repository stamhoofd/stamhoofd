import { Decoder } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { PermissionLevel, PrivateWebshop, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
import { computed, readonly, Ref, ref } from 'vue';
import { WebshopManager } from '../WebshopManager';

export type UseEditWebshopProps = {
    webshopManager?: WebshopManager;
    initialWebshop?: PrivateWebshop;
    savedHandler?: (webshop: PrivateWebshop) => Promise<void>;
};

export function useEditWebshop({ validate, afterSave, shouldDismiss, getProps }: {
    validate?: () => Promise<void> | void;
    afterSave?: () => Promise<void> | void;
    shouldDismiss?: () => Promise<boolean> | boolean;
    getProps: () => UseEditWebshopProps;
} = { getProps: () => ({}) }) {
    const errors = useErrors();

    const context = useContext();
    const organizationManager = useOrganizationManager();
    const dismiss = useDismiss();

    const webshopManager = ref(getProps().webshopManager);
    const isNew = computed(() => webshopManager.value === undefined);
    const saving = ref(false);

    const originalWebshop: PrivateWebshop = getProps().webshopManager?.webshop ?? getProps().initialWebshop ?? PrivateWebshop.create({});
    const { patched: webshop, patch, addPatch, hasChanges, reset } = usePatch(originalWebshop);

    async function save() {
        if (saving.value) {
            return;
        }

        saving.value = true;
        const props = getProps();

        try {
            if (!await errors.validator.validate()) {
                saving.value = false;
                return;
            }

            if (validate) {
                await validate();
            }

            if (isNew.value) {
                // this logic should probably be moved to WebshopManager
                const response = await context.value.authenticatedServer.request({
                    method: 'POST',
                    path: '/webshop',
                    body: webshop.value,
                    decoder: PrivateWebshop as Decoder<PrivateWebshop>,
                    shouldRetry: false,
                });

                if (afterSave) {
                    await afterSave();
                }

                const preview = WebshopPreview.create(response.data);
                organizationManager.value.organization.webshops.push(preview);

                // Save updated organization to cache
                organizationManager.value.save().catch(console.error);

                // Check if we have in memory full access to the webshop (we should)
                // if not, we need to reload the user
                if (!context.value.auth.canAccessWebshop(preview, PermissionLevel.Full)) {
                    await context.value.fetchUser();
                }

                let afterThrow: Error | undefined;
                if (props.savedHandler) {
                    try {
                        await props.savedHandler(response.data);
                    }
                    catch (e) {
                        afterThrow = e as Error;
                    }
                }

                // Save to database

                // todo: can create problems because the database is not closed
                const manager = new WebshopManager(context.value, preview);
                await manager.saveToDatabase(response.data);
                manager.closeRequests();

                // Send system wide notification that we might need an update in data
                await GlobalEventBus.sendEvent('new-webshop', response.data);
                new Toast(
                    response.data.meta.ticketType === WebshopTicketType.Tickets
                        ? $t(`%Ui`)
                        : $t(`%Uj`)
                    , 'success green').show();

                if (afterThrow) {
                    webshopManager.value = manager;

                    // Clear the patch
                    reset();
                    originalWebshop.deepSet(response.data);
                    throw afterThrow;
                }
            }
            else {
                await webshopManager.value!.patchWebshop(patch.value);

                if (afterSave) {
                    await afterSave();
                }

                let afterThrow: Error | undefined;
                if (props.savedHandler && webshopManager.value!.webshop) {
                    try {
                        await props.savedHandler(webshopManager.value!.webshop as PrivateWebshop);
                    }
                    catch (e) {
                        afterThrow = e as Error;
                    }
                }

                new Toast($t(`%Uk`), 'success green').show();

                // Clear the patch
                reset();
                if (webshopManager.value!.webshop) {
                    originalWebshop.deepSet(webshopManager.value!.webshop! as PrivateWebshop);
                }
                if (afterThrow) {
                    throw afterThrow;
                }
            }

            const dis = shouldDismiss ? await shouldDismiss() : true;
            if (dis) {
                await dismiss({ force: true });
            }
        }
        catch (e) {
            console.error(e);
            errors.errorBox = new ErrorBox(e);
        }

        saving.value = false;
    }

    const shouldNavigateAway = async () => {
        if (!hasChanges.value) {
            return true;
        }
        return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
    };

    return {
        isNew,
        webshop: readonly(webshop) as Readonly<Ref<PrivateWebshop>>,
        addPatch,
        patch,
        hasChanges: readonly(hasChanges),
        save,
        saving: readonly(saving),
        originalWebshop,
        errors,
        shouldNavigateAway,
    };
}
