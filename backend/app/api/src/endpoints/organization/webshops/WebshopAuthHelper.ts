import { SimpleError } from '@simonbackx/simple-errors';
import type { Order, Webshop } from '@stamhoofd/models';
import { WebshopAuthType } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';

export class WebshopAuthHelper {
    static async optionalAuthenticateForWebshop(webshop: Webshop) {
        await Context.optionalAuthenticate();

        if (webshop.meta.authType === WebshopAuthType.Required && !Context.user) {
            throw new SimpleError({
                code: 'not_authenticated',
                message: 'Not authenticated',
                human: $t(`%w5`),
                statusCode: 401,
            });
        }
    }

    static async checkOrderAccess(webshop: Webshop, order: Order) {
        await this.optionalAuthenticateForWebshop(webshop);

        if (webshop.meta.authType !== WebshopAuthType.Required) {
            return;
        }

        if (order.userId !== Context.user?.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Order not found',
                human: $t(`%FY`),
            });
        }
    }
}
