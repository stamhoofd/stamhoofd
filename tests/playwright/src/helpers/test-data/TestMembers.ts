import {
    Group,
    MemberFactory,
    Organization,
    RegistrationFactory,
} from '@stamhoofd/models';
import { GroupPrice } from '@stamhoofd/structures';

export class TestMembers {
    static async defaultMember({
        firstName,
        lastName,
        organization,
        group,
        groupPrice,
    }: {
        firstName: string;
        lastName: string;
        organization: Organization;
        group?: Group;
        groupPrice?: GroupPrice;
    }) {
        const member = await new MemberFactory({
            firstName,
            lastName,
            organization,
        }).create();

        if (group) {
            // create registration
            await new RegistrationFactory({
                member,
                group,
                groupPrice,
            }).create();
        }

        return member;
    }

    static async defaultMemberFromId(settings: {
        id: number;
        organization: Organization;
        group?: Group;
        groupPrice?: GroupPrice;
    }) {
        return TestMembers.defaultMember({
            ...settings,
            firstName: `lid-${settings.id}`,
            lastName: `achternaam-${settings.id}`,
        });
    }
}
