import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { GroupPriceDiscount } from './GroupPriceDiscount.js';
import { TranslatedString } from './TranslatedString.js';

export class BundleDiscount extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field(TranslatedString.field({}))
    name = new TranslatedString('');

    @field({ decoder: new ArrayDecoder(GroupPriceDiscount) })
    discounts: GroupPriceDiscount[] = []; // second, third, fourth...

    /**
     * Whether all registrations of the family are counted together (true), or they are all counted separately per member (false).
     */
    @field({ decoder: BooleanDecoder })
    countWholeFamily = false;

    /**
     * Whether all registrations are counted together regardless the group (false), or each group is counted separately (true).
     * Note: this is always false (ignored) if countWholeFamily is false. Because a member cannot register for the same group multiple times.
     */
    @field({ decoder: BooleanDecoder })
    countPerGroup = false;

    get humanDescription() {
        if (this.countWholeFamily) {
            if (this.countPerGroup) {
                return $t('%178');
            }
            return $t('%179');
        }

        return $t('%17A');
    }

    static discountsToText(discounts: GroupPriceDiscount[]) {
        if (discounts.length === 0) {
            return $t('%17B');
        }
        return discounts.map((d, i) => {
            if (i === discounts.length - 1) {
                return $t('%17C', {
                    '5%': d.toString(),
                    '2': i + 2,
                });
            }
            return $t('%17D', {
                '5%': d.toString(),
                '2': i + 2,
            });
        }).join(', ');
    }

    get discountsText() {
        return BundleDiscount.discountsToText(this.discounts);
    }
}
