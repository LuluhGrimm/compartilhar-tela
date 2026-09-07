const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "electronAPI",
    {

        // ==================================================
        // FONTES DE TELA/JANELA
        // ==================================================

        listarFontes: () =>
            ipcRenderer.invoke(
                "listar-fontes"
            ),


        selecionarFonte: (id) =>
            ipcRenderer.invoke(
                "selecionar-fonte",
                id
            ),


        // ==================================================
        // ÁUDIO POR APLICATIVO
        // ==================================================

        iniciarAudioAplicativo: () =>
            ipcRenderer.invoke(
                "iniciar-audio-aplicativo"
            ),


        pararAudioAplicativo: () =>
            ipcRenderer.invoke(
                "parar-audio-aplicativo"
            ),


        statusAudioAplicativo: () =>
            ipcRenderer.invoke(
                "status-audio-aplicativo"
            ),


        // ==================================================
        // RECEBER PCM DO ELECTRON
        // ==================================================

        aoReceberAudioPCM: (
            callback
        ) => {

            const listener = (
                evento,
                dados
            ) => {

                callback(
                    dados
                );

            };


            ipcRenderer.on(
                "audio-pcm",
                listener
            );


            return () => {

                ipcRenderer.removeListener(
                    "audio-pcm",
                    listener
                );

            };

        },


        // ==================================================
        // ERRO DO CAPTURADOR
        // ==================================================

        aoErroAudio: (
            callback
        ) => {

            const listener = (
                evento,
                mensagem
            ) => {

                callback(
                    mensagem
                );

            };


            ipcRenderer.on(
                "audio-erro",
                listener
            );


            return () => {

                ipcRenderer.removeListener(
                    "audio-erro",
                    listener
                );

            };

        },


        // ==================================================
        // CAPTURADOR ENCERRADO
        // ==================================================

        aoEncerrarAudio: (
            callback
        ) => {

            const listener = (
                evento,
                codigo
            ) => {

                callback(
                    codigo
                );

            };


            ipcRenderer.on(
                "audio-encerrado",
                listener
            );


            return () => {

                ipcRenderer.removeListener(
                    "audio-encerrado",
                    listener
                );

            };

        },


        // ==================================================
        // IDENTIFICAÇÃO
        // ==================================================

        ehElectron:
            true

    }
);