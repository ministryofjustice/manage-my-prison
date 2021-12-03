#! /usr/bin/env npx ts-node
/* eslint import/no-extraneous-dependencies: "off" */
import {writeFileSync} from 'fs'

import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'
import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'

type BuildOptions = {
  watch?: boolean
  verbose?: boolean
}

function build({watch = false, verbose = false}: BuildOptions = {}) {
  const logLevel: esbuild.LogLevel = verbose ? 'verbose' : 'info'
  esbuild
    .build({
      logLevel,
      entryPoints: ['ts/index.ts'],
      outdir: 'js',
      watch,
      platform: 'browser',
      target: 'es2016', // TODO: es5?
      format: 'iife',
      bundle: true,
      minify: !watch,
      sourcemap: watch ? false : 'external',
      metafile: true,
    })
    .then(result => writeMetafile(result, 'js'))

  esbuild
    .build({
      logLevel,
      plugins: [
        sassPlugin({
          outputStyle: watch ? 'expanded' : 'compressed',
          sourceMap: watch ? false : 'external',
        }),
      ],
      entryPoints: ['sass/index.scss'],
      outdir: 'stylesheets',
      watch,
      metafile: true,
    })
    .then(result => writeMetafile(result, 'stylesheets'))
}

function writeMetafile(result: esbuild.BuildResult, outdir: string): void {
  writeFileSync(`${outdir}/.meta.json`, JSON.stringify(result))
}

const argv = yargs(hideBin(process.argv))
  .option('watch', {
    alias: 'w',
    default: false,
    type: 'boolean',
    description: 'Automatically rebuild if files change',
  })
  .option('verbose', {
    alias: 'v',
    default: false,
    type: 'boolean',
    description: 'Verbose logging',
  })
  .alias({h: 'help'})
  .strict(true)
  .parse()
build(argv as BuildOptions)
