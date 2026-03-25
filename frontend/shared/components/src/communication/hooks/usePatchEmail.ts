import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '#hooks/useContext.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { Email} from '@stamhoofd/structures';
import { EmailPreview } from '@stamhoofd/structures';

export function usePatchEmail() {
    const context = useContext();
    const owner = useRequestOwner();

    async function patchEmail(email: EmailPreview, patch: AutoEncoderPatchType<EmailPreview> | AutoEncoderPatchType<Email>) {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/email/' + email.id,
            body: patch,
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false,
        });

        email.deepSet(response.data);
    }

    return { patchEmail };
}
