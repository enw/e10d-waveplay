export interface ElectronAPI {
  saveFile: (data: {
    defaultPath: string
    buffer: ArrayBuffer
    filters: { name: string; extensions: string[] }[]
  }) => Promise<{ ok: boolean; filePath?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
