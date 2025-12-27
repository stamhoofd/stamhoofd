import { Group, GroupFactory, Organization, RegistrationPeriod } from "@stamhoofd/models";
import { TranslatedString } from "@stamhoofd/structures";

export type GroupCreator = (organization: Organization) => Promise<Group>;

export class TestGroups {
    static defaultGroup(name: string) {
        return async (organization: Organization, period?: RegistrationPeriod) => {
            const group = await new GroupFactory({
                organization,
                period,
                price: 500000,
                reducedPrice: 400000,
                name: new TranslatedString(name),
            }).create();

            return group;
        };
    }
}
