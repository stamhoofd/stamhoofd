import type { Country } from '@stamhoofd/types/Country';
import { IPRangeSet } from '@stamhoofd/utility/IPRange.js';
import { readFile } from 'fs/promises';

export class Geolocator {
    static shared = new Geolocator();

    ranges: Map<Country, IPRangeSet> = new Map();

    async load(file: string, country: Country) {
        let set = this.ranges.get(country);
        if (!set) {
            set = new IPRangeSet();
            this.ranges.set(country, set);
        }

        const text = await readFile(file, { encoding: 'utf-8' });
        set.addText(text, (line, error) => {
            console.error(`Failed to parse line: ${line}`, error);
        });
    }

    getCountry(ip: string): Country | undefined {
        for (const [country, set] of this.ranges) {
            if (set.includes(ip)) {
                return country;
            }
        }
    }
}
