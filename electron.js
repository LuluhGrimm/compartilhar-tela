const {
    app,
    BrowserWindow,
    desktopCapturer,
    ipcMain,
    session
} = require("electron");

const path = require("path");


// O Electron usa a interface local.
// A comunicação da sala será feita
// diretamente com o Render.
require("./server.js");


let janelaPrincipal = null;
let fonteSelecionada = null;


async function listarFontes() {

    return await desktopCapturer.getSources({

        types: [
            "screen",
            "window"
        ],

        thumbnailSize: {
            width: 320,
            height: 180
        },

        fetchWindowIcons: true

    });

}


ipcMain.handle(
    "listar-fontes",
    async () => {

        const fontes =
            await listarFontes();


        return fontes.map(
            fonte => ({

                id:
                    fonte.id,

                nome:
                    fonte.name,

                thumbnail:
                    fonte.thumbnail
                        .toDataURL(),

                icone:
                    fonte.appIcon
                        ? fonte.appIcon.toDataURL()
                        : null

            })
        );

    }
);


ipcMain.handle(
    "selecionar-fonte",
    async (evento, id) => {

        fonteSelecionada = id;

        console.log(
            "Fonte escolhida:",
            id
        );

        return true;

    }
);


function criarJanela() {

    janelaPrincipal =
        new BrowserWindow({

            width: 1280,
            height: 850,

            minWidth: 900,
            minHeight: 600,

            title:
                "Compartilhar Tela",

            backgroundColor:
                "#0f0f0f",

            autoHideMenuBar:
                true,

            webPreferences: {

                preload:
                    path.join(
                        __dirname,
                        "preload.js"
                    ),

                contextIsolation:
                    true,

                nodeIntegration:
                    false,

                webSecurity:
                    true

            }

        });


    janelaPrincipal.loadURL(
        "http://localhost:3000"
    );

}


app.whenReady().then(
    async () => {

        session.defaultSession
            .setDisplayMediaRequestHandler(

                async (
                    request,
                    callback
                ) => {

                    try {

                        const fontes =
                            await listarFontes();


                        const fonte =
                            fontes.find(
                                item =>
                                    item.id ===
                                    fonteSelecionada
                            );


                        if (!fonte) {

                            console.log(
                                "Nenhuma fonte escolhida."
                            );

                            callback({});

                            return;
                        }


                        callback({

                            video:
                                fonte,

                            audio:
                                "loopback"

                        });

                    }
                    catch (erro) {

                        console.error(
                            "Erro na captura:",
                            erro
                        );

                        callback({});

                    }

                },

                {
                    useSystemPicker:
                        false
                }

            );


        setTimeout(
            () => {

                criarJanela();

            },
            800
        );


        app.on(
            "activate",
            () => {

                if (
                    BrowserWindow
                        .getAllWindows()
                        .length === 0
                ) {

                    criarJanela();

                }

            }
        );

    }
);


app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !==
            "darwin"
        ) {

            app.quit();

        }

    }
);