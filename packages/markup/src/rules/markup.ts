import { Rule } from 'eslint'
import { exec as execAsync } from 'markuplint'
import { exec } from 'markuplint-sync'
import { createSyncFn } from 'synckit'

import { getPhysicalFilename, resolveConfig } from '../helpers'

const workerPath = require.resolve('../worker')

// call `creatSyncFn` lazily for performance, it is already cached inside, related #31
const _ = {
  get execSync() {
    return createSyncFn<typeof execAsync>(workerPath)
  },
}

const brokenCache = new Map<string, true>()

const BROKEN_ERROR_PATTERN =
  /^`(verify|fix)Sync` finished async. Use `\1` instead$/

export const markup: Rule.RuleModule = {
  meta: {
    fixable: 'code',
    type: 'problem',
  },
  create(context) {
    const filename = context.getFilename()
    const sourceText = context.getSourceCode().text

    const config = resolveConfig(getPhysicalFilename(filename))

    const execOptions = {
      sourceCodes: sourceText,
      names: filename,
      config,
    }

    return {
      // eslint-disable-next-line sonarjs/cognitive-complexity
      Program() {
        if (!config) {
          return
        }

        let broken = brokenCache.get(config)

        const runMarkuplint = (fix?: boolean) => {
          const options = {
            ...execOptions,
            fix,
          }

          if (broken) {
            return _.execSync(options)
          }

          try {
            return exec(options)
          } catch (err) {
            /* istanbul ignore else */
            if (BROKEN_ERROR_PATTERN.test((err as Error).message)) {
              brokenCache.set(config, (broken = true))
              return _.execSync(options)
            }
            // eslint-disable-next-line no-else-return -- https://github.com/istanbuljs/istanbuljs/issues/605
            else {
              throw err
            }
          }
        }

        const resultInfos = runMarkuplint()

        if (resultInfos.length === 0) {
          return
        }

        let fixed = 0

        for (const { ruleId, severity, message, line, col } of resultInfos[0]
          .results) {
          context.report({
            message: JSON.stringify({ severity, message, ruleId }),
            loc: {
              line,
              // ! eslint ast column is 0-indexed, but markuplint is 1-indexed
              column: col - 1,
            },
            fix() {
              if (fixed++) {
                return null
              }
              const { fixedCode } = runMarkuplint(true)[0]
              return sourceText === fixedCode
                ? null
                : {
                    range: [0, sourceText.length],
                    text: fixedCode,
                  }
            },
          })
        }
      },
    }
  },
}
