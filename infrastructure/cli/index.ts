#!/usr/bin/env node --no-warnings --loader ts-node/esm
import {main} from './lib/main.js'
import {setCliPath, scriptParentDirectory} from './lib/paths.js'

setCliPath(scriptParentDirectory(import.meta.url))

await main()
