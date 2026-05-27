import { Organization, OrganizationFactory, Platform } from '@stamhoofd/models';

export async function initMembershipOrganization() {
    const platform = await Platform.getForEditing();
    if (platform.membershipOrganizationId) {
        return await Organization.getByID(platform.membershipOrganizationId, true);
    }

    const membershipOrganization =  await new OrganizationFactory({}).create();
    platform.membershipOrganizationId = membershipOrganization.id;
    await platform.save()
    return membershipOrganization
}
