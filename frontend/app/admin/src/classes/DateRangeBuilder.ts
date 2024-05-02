import { DateOption } from "@stamhoofd/components";

export function buildDateRangeOptions() {
    const options: DateOption[] = []
    const reference = new Date()
    reference.setHours(23, 59, 59, 999)

    // Fill options here
    const month = new Date(reference)
    month.setMonth(reference.getMonth() - 1)
    options.push(new DateOption("Afgelopen maand", { start: month, end: reference }))

    // Fill options here
    const months3 = new Date(reference)
    months3.setMonth(reference.getMonth() - 3)
    options.push(new DateOption("Afgelopen 3 maanden", { start: months3, end: reference }))

    // Fill options here
    const months6 = new Date(reference)
    months6.setMonth(reference.getMonth() - 6)
    options.push(new DateOption("Afgelopen 6 maanden", { start: months6, end: reference }))

    // Fill options here
    const year = new Date(reference)
    year.setFullYear(reference.getFullYear() - 1)
    options.push(new DateOption("Afgelopen jaar", { start: year, end: reference }))

    // Fill options here
    const year2 = new Date(reference)
    year2.setFullYear(reference.getFullYear() - 2)
    options.push(new DateOption("Afgelopen 2 jaren", { start: year2, end: reference }))


    // Fill options here
    const years = new Date(reference)
    years.setFullYear(reference.getFullYear() - 3)
    options.push(new DateOption("Afgelopen jaren", { start: years, end: reference }))

    return options
}