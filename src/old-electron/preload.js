const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pcbAPI', {
    invoke: async (channel, data) => {
        // whitelist channels
        let validChannels = ["renderStackup", "renderPhoton", "downloadFiles"];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    }
})