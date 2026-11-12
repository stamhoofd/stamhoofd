import { createOxlintConfig } from 'oxlint-plugin-stamhoofd';
import eslint from './eslint.config.mjs';

export default await createOxlintConfig(eslint);
