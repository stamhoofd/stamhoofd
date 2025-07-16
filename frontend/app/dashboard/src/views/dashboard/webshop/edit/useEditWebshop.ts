import { Decoder } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, GlobalEventBus, Toast, useContext, useErrors, usePatch } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { PrivateWebshop, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
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

    const isNew = computed(() => getProps().webshopManager === undefined);
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

                if (props.savedHandler) {
                    await props.savedHandler(response.data);
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


                // Save to database
                const manager = new WebshopManager(context.value, preview);
                await manager.storeWebshop(response.data);
                manager.close();

                // Send system wide notification that we might need an update in data
                await GlobalEventBus.sendEvent('new-webshop', response.data);
                new Toast(
                    response.data.meta.ticketType === WebshopTicketType.Tickets
                        ? $t(`2ce11748-a9c0-439c-af8b-8115243568eb`)
                        : $t(`878cc081-df24-46b7-a56b-fb91feb631ff`)
                    , 'success green').show();
            }
            else {
                await props.webshopManager!.patchWebshop(patch.value);

                if (afterSave) {
                    await afterSave();
                }

                if (props.savedHandler && props.webshopManager!.webshop) {
                    await props.savedHandler(props.webshopManager!.webshop);
                }

                new Toast($t(`482f0710-b031-4d4d-90b9-41c6e6ea89a2`), 'success green').show();

                // Clear the patch
                reset();
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
        return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
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
