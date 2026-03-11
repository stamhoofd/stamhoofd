import { DocumentStatus, DocumentStatusHelper, FilterWrapperMarker } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import { UIFilter, UIFilterBuilder } from '../UIFilter';

export function getDocumentTemplateUIFilterBuilders(): UIFilterBuilder<UIFilter>[] {
    const all: UIFilterBuilder<UIFilter>[] = [
        new StringFilterBuilder({
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            key: 'name',
        }),
        new NumberFilterBuilder({
            name: $t(`ab2e45a8-4c85-4c10-95b3-cc8da7d40e34`),
            key: 'year',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`23671282-34da-4da9-8afd-503811621055`),
            options: [
                new MultipleChoiceUIFilterOption(
                    $t(`2e2c43a8-3709-4947-83e0-3b0345cd7b44`),
                    'fiscal',
                ),
                new MultipleChoiceUIFilterOption(
                    $t(`c2fe9ab5-f728-4898-a36c-18ba68ea7057`),
                    'participation',
                ),
            ],
            wrapper: {
                type: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
        new DateFilterBuilder({
            name: $t(`10fd24bb-43dd-4174-9a23-db3ac54af9be`),
            key: 'createdAt',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`62a07ea0-53ad-4962-88ff-26ea1ab493b0`),
            options: Object.values(DocumentStatus)
                .filter(status => [DocumentStatus.Draft, DocumentStatus.Published].includes(status))
                .map((status) => {
                    return new MultipleChoiceUIFilterOption(
                        Formatter.capitalizeFirstLetter(DocumentStatusHelper.getName(status)),
                        status,
                    );
                }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
    ];

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}
