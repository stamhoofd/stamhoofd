import { fiscal } from '@stamhoofd/dashboard/src/views/dashboard/documents/definitions/fiscal';
import { participation } from '@stamhoofd/dashboard/src/views/dashboard/documents/definitions/participation';
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
            name: $t(`274b2697-e44a-43bb-a635-79d9721e8581`),
            key: 'name',
        }),
        new NumberFilterBuilder({
            name: $t(`ab2e45a8-4c85-4c10-95b3-cc8da7d40e34`),
            key: 'year',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`45d95ed4-349b-4f6d-8b4b-417467099f3e`),
            options: [fiscal, participation]
                .map((definition) => {
                    return new MultipleChoiceUIFilterOption(
                        definition.name,
                        definition.type,
                    );
                }),
            wrapper: {
                type: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
        new DateFilterBuilder({
            name: $t(`52961dd4-be19-47a1-abe6-1e3c34e8157c`),
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
