import type { Group, Organization, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory } from '@stamhoofd/models';
import { TranslatedText } from '@stamhoofd/structures';

export type GroupCreator = (organization: Organization) => Promise<Group>;

export class TestGroups {
    static defaultGroup(name: string) {
        return async (organization: Organization, period?: RegistrationPeriod) => {
            const group = await new GroupFactory({
                organization,
                period,
                price: 500000,
                reducedPrice: 400000,
                name: TranslatedText.create(name),
            }).create();

            return group;
        };
    }
}
