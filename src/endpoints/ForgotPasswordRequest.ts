import { AutoEncoder, EmailDecoder,field } from '@simonbackx/simple-encoding';

export class ForgotPasswordRequest extends AutoEncoder {
    @field({ decoder: EmailDecoder })
    email: string;
}
