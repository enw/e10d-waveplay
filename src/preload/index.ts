import { contextBridge, ipcRenderer } from 'electron'

export interface SaveFileRequest {
  defaultPath: string
  buffer: ArrayBuffer
  filters: { name: string; extensions: string[] }[]
}

export interface SaveFileResult {
  ok: boolean
  filePath?: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data: SaveFileRequest): Promise<SaveFileResult> => ipcRenderer.invoke('save-file', data)
})
