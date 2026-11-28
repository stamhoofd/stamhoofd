import { AutoEncoder, EmailDecoder, field } from '@stamhoofd/common-encoding';

export class ForgotPasswordRequest extends AutoEncoder {
    @field({ decoder: EmailDecoder })
    email: string;
}
