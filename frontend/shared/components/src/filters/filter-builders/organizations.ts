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
            name: $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
            key: 'firstName',
        }),
        new StringFilterBuilder({
            name: $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
            key: 'lastName',
        }),
        new StringFilterBuilder({
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
            key: 'email',
        }),
    ];

    return builders;
};

export function useGetOrganizationUIFilterBuilders() {
    const platform = usePlatform();

    const setupStepFilterNameMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('b0cb950d-856f-4068-bf2f-9636927020f4'),
        [SetupStepType.Companies]: $t('6313a021-6795-4b7e-842c-f4574e433324'),
        [SetupStepType.Groups]: $t('5271f407-ec58-4802-ac69-7f357bc3cfc7'),
        [SetupStepType.Premises]: $t('7f531562-9609-456e-a8c3-2b373cad3f29'),
        [SetupStepType.Emails]: $t('1363c0ee-0f4b-43f8-a9ee-a2a6091e5d96'),
        [SetupStepType.Payment]: $t('12b644c9-c1a7-4930-afb2-79f62648d243'),
        [SetupStepType.Registrations]: $t('3f4c9896-7f02-4b49-ad29-2d363a8af71f'),
    };

    const getOrganizationUIFilterBuilders = (user: User | null) => {
        const all = [
            new StringFilterBuilder({
                name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
                key: 'name',
            }),

            new StringFilterBuilder({
                name: $t(`3f4f6c6a-e2c5-4bee-83a3-77d8e55a1e60`),
                key: 'city',
            }),

            new StringFilterBuilder({
                name: $t(`5ed579c6-bfe4-453b-bc13-5e38690849e1`),
                key: 'postalCode',
            }),

            new StringFilterBuilder({
                name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                key: 'uri',
            }),

            new GroupUIFilterBuilder({
                name: $t(`19da8d23-acea-43c2-bfdd-742447ca57f1`),
                description: $t('6bf80a05-84b0-47ba-ad41-66e2a106669b'),
                builders: getOrganizationMemberUIFilterBuilders(),
                wrapper: {
                    members: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`079afc7a-6ccb-4c7f-b739-24198b0cfec2`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`079afc7a-6ccb-4c7f-b739-24198b0cfec2`), 1),
                    new MultipleChoiceUIFilterOption($t(`33906077-a1d8-4daa-9914-ce129538f68c`), 0),
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
                name: $t(`2b09865c-4f3c-44ab-b001-03fc1d5a0ce9`),
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
                    name: $t('0be39baa-0b8e-47a5-bd53-0feeb14a0f93'),
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
