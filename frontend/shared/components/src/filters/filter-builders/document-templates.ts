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
            name: $t(`Naam`),
            key: 'name',
        }),
        new NumberFilterBuilder({
            name: $t(`Kalenderjaar`),
            key: 'year',
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
