import type { Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { Toast } from '#overlays/Toast.ts';
import { useContext } from '#hooks/useContext.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { EmailPreview } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { isRef, ref, unref } from 'vue';

export function useUpdateEmail(email: EmailPreview | Ref<EmailPreview>) {
    const updating = ref(false);
    const context = useContext();
    const owner = useRequestOwner();

    async function updateEmail() {
        if (updating.value) {
            return;
        }

        updating.value = true;

        try {
            const model = unref(email);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/email/' + model.id,
                decoder: EmailPreview as Decoder<EmailPreview>,
                owner,
                shouldRetry: true,
            });

            model.deepSet(response.data);
            if (isRef(email)) {
                email.value = model;
            }
        }
        catch (e) {
            console.error(e);
            if (!Request.isNetworkError(e)) {
                Toast.fromError(e).setHide(2000).show();
            }
        }

        updating.value = false;
    }

    return { updateEmail, updating };
}
