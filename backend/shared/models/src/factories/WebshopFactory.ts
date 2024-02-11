import { Factory } from "@simonbackx/simple-database";
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { Product, WebshopMetaData, WebshopPrivateMetaData } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { Webshop } from "../models";
import { OrganizationFactory } from "./OrganizationFactory";

class Options {
    organizationId?: string
    name?: string
    meta?: WebshopMetaData|AutoEncoderPatchType<WebshopMetaData>
    privateMeta?: WebshopPrivateMetaData|AutoEncoderPatchType<WebshopPrivateMetaData>
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

        if (this.options.privateMeta) {
            webshop.privateMeta.patchOrPut(this.options.privateMeta);   
        }

        if (this.options.products) {
            webshop.products = this.options.products;
        }
       
        await webshop.save();
        return webshop;
    }
}
