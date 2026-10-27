import { ArrayDecoder, AutoEncoder, field } from '@common/encoding';
import { User } from '../User.js';

export class OrganizationAdmins extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(User) })
    users: User[] = [];
}
