import { AutoEncoder, EmailDecoder, field } from '@common/encoding';

export class ForgotPasswordRequest extends AutoEncoder {
    @field({ decoder: EmailDecoder })
    email: string;
}
