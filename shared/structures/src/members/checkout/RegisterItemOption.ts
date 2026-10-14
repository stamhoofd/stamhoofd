import { AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { GroupOption, GroupOptionMenu } from '../../GroupSettings.js';

export class RegisterItemOption extends AutoEncoder {
    @field({ decoder: GroupOption })
    option: GroupOption;

    @field({ decoder: GroupOptionMenu })
    optionMenu: GroupOptionMenu;

    @field({ decoder: IntegerDecoder })
    amount = 1;
}
