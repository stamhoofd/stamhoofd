import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { City as CityStruct, Country, Province as ProvinceStruct,SearchRegions } from "@stamhoofd/structures";
import { StringCompare } from '@stamhoofd/utility';

import { City } from '@stamhoofd/models';
import { Province } from '@stamhoofd/models';

type Params = {};
class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    query: string
}
type Body = undefined;
type ResponseBody = SearchRegions;

export class SearchRegionsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>
    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/address/search", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
         // Escape query
        const query = request.query.query.replace(/([-+><()~*"@\s]+)/g, " ").replace(/[^\w\d]+$/, "")
        if (query.length == 0) {
            // Do not try searching...
            return new Response(SearchRegions.create({
                cities: [],
                provinces: [],
                countries: [],
            }));
        }

        const match = {
            sign: "MATCH",
            value: query + "*", // We replace special operators in boolean mode with spaces since special characters aren't indexed anyway
            mode: "BOOLEAN"
        };

        // We had to add an order by in the query to fix the limit. MySQL doesn't want to limit the results correctly if we don't explicitly sort the results on their relevance
        const cities = await City.where({ name: match }, {
            limit: 5,
            sort: [
                {
                    column: { name: match },
                    direction: "DESC"
                }
            ]
        });
        const loadedCities: (City & { province: Province })[] = []

        // We had to add an order by in the query to fix the limit. MySQL doesn't want to limit the results correctly if we don't explicitly sort the results on their relevance
        const allProvinces = await Province.all();

        for (const city of cities) {
            const province = allProvinces.find(p => p.id == city.provinceId);
            if (!province) {
                continue;
            }
            loadedCities.push(city.setRelation(City.province, province))
        }

        const provinces: Province[] = []
        for (const province of allProvinces) {
            if (StringCompare.typoCount(request.query.query, province.name) < 3) {
                provinces.push(province)
            }
        }

        const countries: Country[] = []
        if (StringCompare.typoCount(request.query.query, "België") < 3) {
            countries.push("BE")
        }

        if (StringCompare.typoCount(request.query.query, "Nederland") < 3) {
            countries.push("NL")
        }
        
        return new Response(SearchRegions.create({
            cities: loadedCities.map(c => CityStruct.create(Object.assign({...c}, { province: ProvinceStruct.create(c.province) }))),
            provinces: provinces.map(c => ProvinceStruct.create(c)),
            countries: countries
        }));
    }
}
