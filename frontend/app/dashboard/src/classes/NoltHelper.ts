import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, Toast } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';

class ResponseBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    jwt: string;
}

export async function openNolt($context: SessionContext, check = false) {
    if (check) {
        let url: URL | null = null;
        if (document.referrer) {
            try {
                url = new URL(document.referrer);
            }
            catch (e) {
                console.error(e);
            }
        }

        // Request permission if coming from an untrusted domain
        if (!url || (url.hostname !== STAMHOOFD.NOLT_URL && url.hostname !== 'www.stamhoofd.be' && url.hostname !== 'www.stamhoofd.nl')) {
            if (!await CenteredMessage.confirm($t(`Wil je inloggen in het feedback systeem?`), $t(`Ja, open Feedback`), $t(`Je logt in op het feedback systeem met dit account: {email}. Je kan eerst van vereniging veranderen als je met een ander account wilt inloggen.`, { email: $context.user!.email }), undefined, false)) {
                return;
            }
        }
    }

    // Create token
    const toast = new Toast($t(`Feedback systeem openen...`), $t(`spinner`)).setHide(null).show();
    try {
        const response = await $context.authenticatedServer!.request({
            method: 'POST',
            path: '/nolt/create-token',
            decoder: ResponseBody as Decoder<ResponseBody>,
            shouldRetry: false,
        });
        window.location.href = 'https://' + STAMHOOFD.NOLT_URL + '/sso/' + encodeURIComponent(response.data.jwt);
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
    toast.hide();
}
