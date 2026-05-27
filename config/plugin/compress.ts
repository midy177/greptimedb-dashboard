/**
 * Used to package and output gzip/brotli.
 * https://github.com/anncwb/vite-plugin-compression
 */
import type { Plugin } from 'vite'
import compressPlugin from 'vite-plugin-compression'

export default function configCompressPlugin(deleteOriginFile = false): Plugin[] {
  return [
    compressPlugin({
      ext: '.gz',
      algorithm: 'gzip',
      deleteOriginFile,
    }),
    compressPlugin({
      ext: '.br',
      algorithm: 'brotliCompress',
      deleteOriginFile,
    }),
  ]
}
