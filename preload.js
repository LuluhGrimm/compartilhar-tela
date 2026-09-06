const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "electronAPI",
    {

        listarFontes: () =>
            ipcRenderer.invoke(
                "listar-fontes"
            ),

        selecionarFonte: (id) =>
            ipcRenderer.invoke(
                "selecionar-fonte",
                id
            ),

        ehElectron: true

    }
);