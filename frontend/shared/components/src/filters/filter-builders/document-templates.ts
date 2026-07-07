import { DocumentStatus, DocumentStatusHelper, FilterWrapperMarker } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { useAppContext } from '#context/appContext.ts';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilter, UIFilterBuilder } from '../UIFilter';

export function useDocumentTemplateUIFilterBuilders(): UIFilterBuilder<UIFilter>[] {
    const app = useAppContext();

    const all: UIFilterBuilder<UIFilter>[] = [
        new StringFilterBuilder({
            name: $t(`%1Os`),
            key: 'name',
        }),
        new NumberFilterBuilder({
            name: $t(`%1Ic`),
            key: 'year',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`%1LP`),
            options: [
                new MultipleChoiceUIFilterOption(
                    $t(`%xX`),
                    'fiscal',
                ),
                new MultipleChoiceUIFilterOption(
                    $t(`%yB`),
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
            name: $t(`%1JJ`),
            key: 'createdAt',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`%17`),
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
        new MultipleChoiceFilterBuilder({
            name: $t(`%ZbW`),
            options: [
                new MultipleChoiceUIFilterOption($t(`%wo`), 1),
                new MultipleChoiceUIFilterOption($t(`%18s`), 0),
            ],
            wrapper: {
                updatesEnabled: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
    ];

    if (app === 'admin') {
        all.push(
            new MultipleChoiceFilterBuilder({
                name: $t(`%Bb`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`%wo`), 1),
                    new MultipleChoiceUIFilterOption($t(`%18s`), 0),
                ],
                wrapper: {
                    isLocked: {
                        $in: FilterWrapperMarker,
                    },
                },
            }),
        );
    }

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}
