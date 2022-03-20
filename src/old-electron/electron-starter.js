const electron = require('electron');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');
const renderStackup = require("./stackup-renderer");
const renderToPhoton = require("./render-to-photon");
const downloadFiles = require("./download-files");

if (require('electron-squirrel-startup')) return app.quit();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        title: "PCB to Photon",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });

    mainWindow.removeMenu();

    const startUrl = process.env.ELECTRON_START_URL || url.format({
        pathname: path.join(__dirname, '/../build/index.html'),
        protocol: 'file:',
        slashes: true
    });
    mainWindow.loadURL(startUrl);

    // // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    // mainWindow.webContents.setWindowOpenHandler(({url}) => {
    //     require('electron').shell.openExternal(url);
    //     return { action: 'deny' };
    // });

    if (process.env.ELECTRON_START_URL) mainWindow.webContents.openDevTools();

    electron.ipcMain.handle("renderStackup", async (event, args) => {
        return await renderStackup(...args);
    });

    electron.ipcMain.handle("renderPhoton", async (event, args) => {
        return await renderToPhoton(...args);
    });

    electron.ipcMain.handle("downloadFiles", async (event, args) => {
        return await downloadFiles(...args);
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
});
