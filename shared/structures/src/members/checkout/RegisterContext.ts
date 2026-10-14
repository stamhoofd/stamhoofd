import type { Group } from '../../Group.js';
import type { Organization } from '../../Organization.js';
import type { PlatformMember } from '../PlatformMember.js';

export type RegisterContext = {
    members: PlatformMember[];
    groups: Group[];
    organizations: Organization[];
};
