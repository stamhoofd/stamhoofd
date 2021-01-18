import zxcvbn from '@zxcvbn-ts/core'
import zxcvbnCommonPackage from '@zxcvbn-ts/language-common'
import zxcvbnNlBePackage from '@zxcvbn-ts/language-nl-be'

const options = {
  translations: zxcvbnNlBePackage.translations,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnNlBePackage.dictionary,
  },
}

export function checkPassword(password: string) {
    return zxcvbn(password, options)
}