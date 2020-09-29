import { Organization } from './models/Organization';

let isRunningCrons = false

async function checkDNS() {
    let lastId = ""

    while (true) {

        const organizations = await Organization.where({ id: { sign: '>', value: lastId } }, {
            limit: 10,
            sort: ["id"]
        })

        if (organizations.length == 0) {
            break
        }

        for (const organization of organizations) {
            console.log("Checking DNS for "+organization.name)
            await organization.updateDNSRecords()
        }

        lastId = organizations[organizations.length - 1].id
    }
}

// Schedule automatic paynl charges
export const crons = () => {
    if (isRunningCrons) {
        return;
    }
    isRunningCrons = true
    try {
        checkDNS().catch(e => {
            console.error(e)
        }).finally(() => {
            isRunningCrons = false
        })
    } catch (e) {
        console.error(e)
        isRunningCrons = false
    }
};