const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { getLatestRelease, validateReleaseUrl } = require('./github-updates');

function assertTrustedRenderer(event) {
    const senderUrl = new URL(event.senderFrame.url);
    if (senderUrl.protocol !== 'file:' || !senderUrl.pathname.endsWith('/index.html')) {
        throw new Error('Solicitud rechazada: origen de la aplicación no válido.');
    }
}

function registerUpdateHandlers() {
    ipcMain.handle('updates:version', event => {
        assertTrustedRenderer(event);
        return app.getVersion();
    });
    ipcMain.handle('updates:latest', async event => {
        assertTrustedRenderer(event);
        return getLatestRelease(app.getVersion());
    });
    ipcMain.handle('updates:open-release', async (event, url) => {
        assertTrustedRenderer(event);
        await shell.openExternal(validateReleaseUrl(url));
    });
}

function createWindow() {
    const window = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
    registerUpdateHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
