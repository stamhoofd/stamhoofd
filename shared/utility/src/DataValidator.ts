
export class DataValidator {
    static isEmailValid(str: string) {
        const blockList = ["gmail.be", "gmail.nl", "hotmail.c", "hotmail.co", "gmail.co", "gmail.c", "gmail.co", "gmal.com", "glail.com", "gmail.col", "gamil.com", "gmail.con", "icloud.be"]
        const regex = /^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
        
        if (!regex.test(str)) {
            return false
        }

        for (const l of blockList) {
            if (str.endsWith("@"+l)) {
                return false
            }
        }

        return true
    }
}