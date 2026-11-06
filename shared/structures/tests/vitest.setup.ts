// Defines STAMHOOFD before Version.ts is evaluated, so tests run at ReleasedVersion + 1
import '@stamhoofd/test-utils/environment';

import { TestUtils } from '@stamhoofd/test-utils';

// Load NextVersion helper
import '../src/Version.js';

TestUtils.setup();
