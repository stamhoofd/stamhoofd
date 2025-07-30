import { AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { PermissionsByRole } from './PermissionsByRole.js';

export class GroupPrivateSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, version: 10 })
    defaultEmailId: string | null = null;

    /**
     * Default setting for admin registrations:
     * send an email to members when an admin registers a member
     */
    @field({ decoder: BooleanDecoder, version: 378 })
    sendConfirmationEmailForManualRegistrations = false;

    @field({ decoder: PermissionsByRole, version: 60, optional: true })
    permissions = PermissionsByRole.create({});
}

export const GroupPrivateSettingsPatch = GroupPrivateSettings.patchType();
