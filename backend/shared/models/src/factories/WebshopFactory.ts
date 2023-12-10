import { Factory } from "@simonbackx/simple-database";
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { Address,Country,OrganizationMetaData, OrganizationType, Product, WebshopMetaData } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility"; 
import { Webshop } from "../models";

import { Organization } from "../models/Organization";
import { OrganizationFactory } from "./OrganizationFactory";

class Options {
    organizationId?: string
    name?: string
    meta?: WebshopMetaData|AutoEncoderPatchType<WebshopMetaData>
    products?: Product[]
}

export class WebshopFactory extends Factory<Options, Webshop> {
    async create(): Promise<Webshop> {
        const organizationId = this.options.organizationId ?? (await new OrganizationFactory({}).create()).id;

        const webshop = new Webshop();
        webshop.organizationId = organizationId;
        webshop.meta = WebshopMetaData.create({
            name: this.options?.name ?? ("Webshop " + (new Date().getTime() + Math.floor(Math.random() * 999999)))
        });
        webshop.uri = Formatter.slug(this.randomString(20));

        if (this.options.meta) {
            webshop.meta.patchOrPut(this.options.meta);
        }

        if (this.options.products) {
            webshop.products = this.options.products;
        }
       
        await webshop.save();
        return webshop;
    }
}
