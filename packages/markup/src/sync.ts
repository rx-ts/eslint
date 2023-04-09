import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Target } from '@markuplint/file-resolver'
import { Violation } from '@markuplint/ml-config'
import { createSyncFn } from 'synckit'

const _dirname =
  typeof __dirname === 'undefined'
    ? dirname(fileURLToPath(import.meta.url))
    : __dirname

const workerPath = path.resolve(_dirname, './worker.mjs')

// call `createSyncFn` lazily for performance, it is already cached inside, related #31
export const sync = {
  get markuplintSync() {
    return createSyncFn<
      (
        target: Target,
        fix?: boolean,
      ) => Promise<{ violations: Violation[]; fixedCode: string }>
    >(workerPath)
  },
}
