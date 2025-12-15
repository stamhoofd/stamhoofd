import { FilterWrapperMarker, SetupStepType, StamhoofdFilter, User } from '@stamhoofd/structures';
import { usePlatform } from '../../hooks';
import { getOrganizationCompanyFilterBuilders } from '../filterBuilders';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import { UIFilterBuilders } from '../UIFilter';

const getOrganizationMemberUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
            key: 'firstName',
        }),
        new StringFilterBuilder({
            name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
            key: 'lastName',
        }),
        new StringFilterBuilder({
            name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
            key: 'email',
        }),
    ];

    return builders;
};

export function useGetOrganizationUIFilterBuilders() {
    const platform = usePlatform();

    const setupStepFilterNameMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('be92d7b0-92ad-42d6-b9e2-b414671ac57d'),
        [SetupStepType.Companies]: $t('6313a021-6795-4b7e-842c-f4574e433324'),
        [SetupStepType.Groups]: $t('b6458e9c-2ddf-4cb0-8051-fb6a220c4127'),
        [SetupStepType.Premises]: $t('7f531562-9609-456e-a8c3-2b373cad3f29'),
        [SetupStepType.Emails]: $t('36a44efc-4cb0-4180-8678-938cc51d3ae8'),
        [SetupStepType.Payment]: $t('d951a3d6-58f6-4e56-a482-2b8652ddd3bf'),
        [SetupStepType.Registrations]: $t('98a4f650-2fc9-455f-8454-dfe7a8140faa'),
    };

    const getOrganizationUIFilterBuilders = (user: User | null) => {
        const all = [
            new StringFilterBuilder({
                name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
                key: 'name',
            }),

            new StringFilterBuilder({
                name: $t(`54b992a4-20e1-4232-8d2e-93c9353c6af3`),
                key: 'city',
            }),

            new StringFilterBuilder({
                name: $t(`5ed579c6-bfe4-453b-bc13-5e38690849e1`),
                key: 'postalCode',
            }),

            new StringFilterBuilder({
                name: $t('5e99e2aa-a240-4894-8de3-f8f0fef20068'),
                key: 'uri',
            }),

            new GroupUIFilterBuilder({
                name: $t(`97dc1e85-339a-4153-9413-cca69959d731`),
                description: $t('6bf80a05-84b0-47ba-ad41-66e2a106669b'),
                builders: getOrganizationMemberUIFilterBuilders(),
                wrapper: {
                    members: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`1bb1402a-c26b-4516-bbe1-08aff32ee3e8`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`1bb1402a-c26b-4516-bbe1-08aff32ee3e8`), 1),
                    new MultipleChoiceUIFilterOption($t(`ddfa1e2d-bb72-4781-8754-d5002249f30d`), 0),
                ],
                wrapper: {
                    active: {
                        $in: FilterWrapperMarker,
                    },
                },
            }),

            new MultipleChoiceFilterBuilder({
                name: $t(`95fc75cf-bf23-4895-bb64-dfec3944596c`),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                    mode: MultipleChoiceUIFilterMode.And,
                    showOptionSelectAll: true,
                },
                options: Object.entries(setupStepFilterNameMap).map(
                    ([k, v]) =>
                        new MultipleChoiceUIFilterOption(
                            v,
                            k as SetupStepType,
                        ),
                ),
                wrapFilter: (f: StamhoofdFilter) => {
                    const choices = Array.isArray(f) ? f : [f];

                    return {
                        setupSteps: {
                            $elemMatch: {
                                periodId: {
                                    $eq: platform.value.period.id,
                                },
                                ...Object.fromEntries(
                                    Object.values(SetupStepType)
                                        .filter(
                                            x => choices.includes(x),
                                        )
                                        .map((setupStep) => {
                                            return [
                                                setupStep,
                                                {
                                                    reviewedAt: {
                                                        $neq: null,
                                                    },
                                                    complete: true,
                                                },
                                            ];
                                        }),
                                ),
                            },
                        },
                    };
                },
                unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
                    if (typeof f !== 'object') return null;

                    const elemMatch = (f as any).setupSteps?.$elemMatch;
                    if (!elemMatch) return null;

                    const periodId = elemMatch.periodId?.$eq;

                    if (periodId !== platform.value.period.id) return null;

                    const enumValues = Object.values(SetupStepType);
                    const stringifiedValueToMatch = JSON.stringify({
                        reviewedAt: { $neq: null },
                        complete: true,
                    });

                    const results: SetupStepType[] = [];

                    for (const [key, value] of Object.entries(elemMatch as object)) {
                        if (enumValues.includes(key as SetupStepType)) {
                            if (JSON.stringify(value) === stringifiedValueToMatch) {
                                results.push(key as SetupStepType);
                            }
                            else {
                                return null;
                            }
                        }
                        else if (key !== 'periodId') {
                            return null;
                        }
                    }

                    if (results.length) {
                        return results;
                    }

                    return null;
                },
            }),
            new GroupUIFilterBuilder({
                name: $t(`d6244dd4-a0b6-4063-9f93-91c5ab91905c`),
                description: $t('1ca52417-1476-4cbb-a240-335a18fedf45'),
                builders: getOrganizationCompanyFilterBuilders(),
                wrapper: {
                    companies: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
        ];

        if (user?.permissions?.platform !== null) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('ec2de613-f06f-4d9a-888a-40f98b6b3727'),
                    multipleChoiceConfiguration: {
                        isSubjectPlural: true,
                    },
                    options: platform.value.config.tags.map((tag) => {
                        return new MultipleChoiceUIFilterOption(tag.name, tag.id);
                    }),
                    wrapper: {
                        tags: {
                            $in: FilterWrapperMarker,
                        },
                    },
                }),
            );
        }

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };

    return { getOrganizationUIFilterBuilders };
}
