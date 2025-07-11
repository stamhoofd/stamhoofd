import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';
import { User } from '../User.js';

export class OrganizationAdmins extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(User) })
    users: User[] = [];
}
