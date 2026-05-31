import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'WavePlay',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle(
    'save-file',
    async (_event, data: { defaultPath: string; buffer: ArrayBuffer; filters: Electron.FileFilter[] }) => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: data.defaultPath,
        filters: data.filters
      })
      if (canceled || !filePath) return { ok: false as const }
      await writeFile(filePath, Buffer.from(data.buffer))
      return { ok: true as const, filePath }
    }
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
