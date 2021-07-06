import { MemberWithRegistrations } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import XLSX from "xlsx";

export class MemberExcelExport {
    static export(members: MemberWithRegistrations[]) {
        const wsName = "Leden";
        const wb = XLSX.utils.book_new();

        /* make worksheet */
        const wsData = [
            [
                "Voornaam",
                "Achternaam",
                "Geslacht",
                "Geboortedatum",
                "GSM",
                "E-mailadres",
                "Adres",
                "Naam ouder",
                "GSM ouder",
                "E-mailadres ouder",
                "Adres ouder",
            ],
        ];

        members.forEach((m: MemberWithRegistrations) => {
            if (!m.details) {
                return;
            }
            const member = m.details

            const firstParent = member.parents[0];
            wsData.push([
                member.firstName,
                member.lastName,
                member.gender,
                member.birthDay ? Formatter.dateNumber(member.birthDay) : "/",
                member.phone ? member.phone : "",
                member.email ? member.email : "",
                member.address ? member.address.toString() : "",

                firstParent ? firstParent.name : "/",
                firstParent && firstParent.phone ? firstParent.phone : "/",
                firstParent && firstParent.email ? firstParent.email : "/",
                firstParent && firstParent.address ? firstParent.address.toString() : "/",
            ]);

            for (let index = 1; index < member.parents.length; index++) {
                const parent = member.parents[index];
                wsData.push([
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    parent.name,
                    parent.phone ? parent.phone : "/",
                    parent.email ? parent.email : "/",
                    parent.address ? parent.address.toString() : "/",
                ]);
            }
        });

        // Delete empty columns
        for (let index = wsData[0].length - 1; index >= 0; index--) {
            let empty = true
            for (const row of wsData.slice(1)) {
                if (row[index].length == 0 || row[index] == "/") {
                    continue;
                }
                empty = false
                break
            }
            if (empty) {
               for (const row of wsData) {
                    row.splice(index, 1)
                } 
            }
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column width
        ws['!cols'] = []
        for (const column of wsData[0]) {
            if (column.toLowerCase().startsWith("naam")) {
                ws['!cols'].push({width: 20});
            } else if (column.toLowerCase().includes("naam")) {
                ws['!cols'].push({width: 15});
            } else if (column.toLowerCase().includes("e-mail")) {
                ws['!cols'].push({width: 25});
            } else if (column.toLowerCase().includes("adres")) {
                ws['!cols'].push({width: 30});
            } else if (column.toLowerCase().includes("gsm")) {
                ws['!cols'].push({width: 16});
            } else {
                ws['!cols'].push({width: 13});
            }
        }

        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, ws, wsName);

        // Fix for app
        if ((navigator as any).nativeShare) {
            /* bookType can be any supported output type */
            const wbout = XLSX.write(wb, { bookType:'xlsx', bookSST: false, type: 'base64' });
            (navigator as any).nativeShare({
                data: wbout,
                fileName: "leden.xlsx"
            })
            .then(() => console.log('Share was successful.'))
            .catch((error) => console.log('Sharing failed', error));
        } else {
            XLSX.writeFile(wb, "leden.xlsx");
        }

    }
}
