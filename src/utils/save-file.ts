async function saveFile(data: string, defaultName: string): Promise<boolean> {
  const { isTauri } = await import('@tauri-apps/api/core')
  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (!filePath) return false
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(filePath, data)
      return true
    } catch (e: any) {
      if (e?.name === 'AbortError') return false
      // fallback to browser download
    }
  }
  const { default: fileDownload } = await import('js-file-download')
  fileDownload(data, defaultName)
  return true
}

export default saveFile
