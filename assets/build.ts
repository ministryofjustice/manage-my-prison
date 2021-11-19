#! /usr/bin/env npx ts-node
import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

async function build(watch = false) {
  await Promise.all([
    esbuild.build({
      logLevel: 'info',
      entryPoints: ['ts/index.ts'],
      outfile: 'js/app.js',
      platform: 'browser',
      target: 'es2016', // es5?
      format: 'iife',
      bundle: true,
      metafile: true,
      minify: !watch,
      sourcemap: watch ? false : 'external',
      watch: watch,
    }),

    esbuild.build({
      logLevel: 'info',
      plugins: [sassPlugin({
        outputStyle: watch ? 'expanded' : 'compressed',
        sourceMap: true,
      })],
      entryPoints: ['sass/application.scss'],
      outfile: 'stylesheets/application.css',
      watch: watch,
    }),
  ])
}

(async () => {
  const watch = process.argv.slice(2).includes('--watch')
  await build(watch)
})()
