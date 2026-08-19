import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '#filters/MultipleChoiceUIFilter.ts';
import type { UIFilterBuilder, UIFilter } from '#filters/UIFilter.ts';
import { FilterWrapperMarker } from '@stamhoofd/structures';
import type { GroupOptionMenu } from '@stamhoofd/structures';

export function getFilterBuildersForOptionMenus(optionMenus: GroupOptionMenu[], prefix = '') {
    const all: UIFilterBuilder<UIFilter>[] = [];

    for (const optionMenu of optionMenus) {
        all.push(
            new MultipleChoiceFilterBuilder({
                name: prefix + optionMenu.name,
                options: optionMenu.options.map(o => new MultipleChoiceUIFilterOption(o.name.toString(), o.id)),
                wrapper: {
                    optionMenu: {
                        id: optionMenu.id,
                    },
                    option: {
                        id: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            }),
        );
    }

    return all;
}
