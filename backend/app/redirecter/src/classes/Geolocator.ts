import { Country } from "@stamhoofd/structures";
import fs from "fs";
import readline from "readline";

function fromIP(ip: string): Buffer {
    const splitted = ip.split(".")
    if (splitted.length != 4) {
        throw new Error("Invalid ipv4 address " + ip)
    }

    return Buffer.from(splitted.map(s => parseInt(s)))
}

class IPRange {
    start: Buffer
    end: Buffer // included

    carrier: string

    constructor(start: string, end: string, carrier: string) {
        this.start = fromIP(start)
        this.end = fromIP(end)
        this.carrier = carrier
    }

    includes(ip: Buffer): boolean {
        return this.start.compare(ip) <= 0 && this.end.compare(ip) >= 0
    }
}

export class Geolocator {
    static shared = new Geolocator()

    ranges: Map<Country, IPRange[]> = new Map()

    async load(file: string, country: Country) {
        const lineReader = readline.createInterface({
            input: fs.createReadStream(file, { encoding: "utf-8" })
        });

        const range = this.ranges.get(country) ?? []
        this.ranges.set(country, range)

        for await (const line of lineReader) {
            const splitted = line.split(",")
            if (splitted.length < 2) {
                console.error(`Failed to parse line: ${line}`);
                continue;
            }
            const from = splitted[0]
            const to = splitted[1]

            console.log("From ", from, "to", to)
            range.push(new IPRange(from, to, splitted[4] ?? ""))
        }
    }

    getCountry(ip: string): Country | undefined {
        const parsed = fromIP(ip)

        for (const [country, ranges] of this.ranges) {
            for (const range of ranges) {
                if (range.includes(parsed)) {
                    return country
                }
            }
        }
    }

    getInfo(ip: string): { country: Country, carrier: string } | undefined {
        const parsed = fromIP(ip)

        for (const [country, ranges] of this.ranges) {
            for (const range of ranges) {
                if (range.includes(parsed)) {
                    return {country, carrier: range.carrier}
                }
            }
        }
    }
}