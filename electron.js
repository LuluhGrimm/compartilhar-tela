const {
    app,
    BrowserWindow,
    desktopCapturer,
    ipcMain,
    session
} = require("electron");

const path = require("path");

const {
    spawn,
    execFile
} = require("child_process");


// ==========================================================
// SERVIDOR LOCAL
// ==========================================================

require("./server.js");


// ==========================================================
// VARIÁVEIS
// ==========================================================

let janelaPrincipal =
    null;

let fonteSelecionada =
    null;

let processoAudio =
    null;

let pidAudioAtual =
    null;


// ==========================================================
// LISTAR FONTES
// ==========================================================

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


// ==========================================================
// CAMINHO DO LULUHGO AUDIO
// ==========================================================

function obterCaminhoAudioHelper() {

    if (
        app.isPackaged
    ) {

        return path.join(
            process.resourcesPath,
            "LuluhGoAudio.exe"
        );

    }


    return path.join(
        __dirname,
        "audio-capture",
        "build",
        "Release",
        "LuluhGoAudio.exe"
    );

}


// ==========================================================
// EXECUTAR POWERSHELL
// ==========================================================

function executarPowerShell(
    comando
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            execFile(
                "powershell.exe",
                [
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    comando
                ],

                {
                    windowsHide: true
                },

                (
                    erro,
                    stdout,
                    stderr
                ) => {

                    if (
                        erro
                    ) {

                        reject(
                            new Error(
                                stderr
                                ||
                                erro.message
                            )
                        );

                        return;

                    }


                    resolve(
                        String(
                            stdout
                            ||
                            ""
                        ).trim()
                    );

                }
            );

        }
    );

}


// ==========================================================
// ESCAPAR TEXTO PARA POWERSHELL
// ==========================================================

function escaparPowerShell(
    texto
) {

    return String(
        texto
        ||
        ""
    ).replace(
        /'/g,
        "''"
    );

}


// ==========================================================
// TENTAR OBTER PID PELO ID DA JANELA
// ==========================================================

async function obterPidPorFonteId(
    fonteId
) {

    if (
        !fonteId
        ||
        !fonteId.startsWith(
            "window:"
        )
    ) {

        return null;

    }


    const partes =
        fonteId.split(":");


    if (
        partes.length < 2
    ) {

        return null;

    }


    const hwndTexto =
        partes[1];


    if (
        !/^\d+$/.test(
            hwndTexto
        )
    ) {

        return null;

    }


    const comando = `

$codigo = @'
using System;
using System.Runtime.InteropServices;

public static class LuluhGoNativeWindow
{
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(
        IntPtr hWnd,
        out uint processId
    );
}
'@

Add-Type -TypeDefinition $codigo -ErrorAction SilentlyContinue

$processoEncontrado = 0

[LuluhGoNativeWindow]::GetWindowThreadProcessId(
    [IntPtr]::new([Int64]${hwndTexto}),
    [ref]$processoEncontrado
) | Out-Null

Write-Output $processoEncontrado

`;


    try {

        const resultado =
            await executarPowerShell(
                comando
            );


        const pid =
            Number(
                resultado
            );


        if (
            Number.isInteger(
                pid
            )
            &&
            pid > 0
        ) {

            return pid;

        }

    }
    catch (
        erro
    ) {

        console.log(
            "Não foi possível descobrir PID pelo HWND:",
            erro.message
        );

    }


    return null;

}


// ==========================================================
// TENTAR OBTER PID PELO NOME DA JANELA
// ==========================================================

async function obterPidPorTitulo(
    titulo
) {

    if (
        !titulo
    ) {

        return null;

    }


    const tituloSeguro =
        escaparPowerShell(
            titulo
        );


    const comandoExato = `

$processo =
    Get-Process |
    Where-Object {
        $_.MainWindowTitle -eq '${tituloSeguro}'
    } |
    Select-Object -First 1

if ($processo) {
    Write-Output $processo.Id
}

`;


    try {

        let resultado =
            await executarPowerShell(
                comandoExato
            );


        let pid =
            Number(
                resultado
            );


        if (
            Number.isInteger(
                pid
            )
            &&
            pid > 0
        ) {

            return pid;

        }


        const comandoParcial = `

$processo =
    Get-Process |
    Where-Object {
        $_.MainWindowTitle -and
        $_.MainWindowTitle.Contains('${tituloSeguro}')
    } |
    Select-Object -First 1

if ($processo) {
    Write-Output $processo.Id
}

`;


        resultado =
            await executarPowerShell(
                comandoParcial
            );


        pid =
            Number(
                resultado
            );


        if (
            Number.isInteger(
                pid
            )
            &&
            pid > 0
        ) {

            return pid;

        }

    }
    catch (
        erro
    ) {

        console.log(
            "Não foi possível descobrir PID pelo título:",
            erro.message
        );

    }


    return null;

}


// ==========================================================
// DESCOBRIR PID DA FONTE
// ==========================================================

async function descobrirPidFonte() {

    if (
        !fonteSelecionada
    ) {

        return null;

    }


    if (
        !fonteSelecionada.id
        ||
        !fonteSelecionada.id.startsWith(
            "window:"
        )
    ) {

        return null;

    }


    let pid =
        await obterPidPorFonteId(
            fonteSelecionada.id
        );


    if (
        pid
    ) {

        console.log(
            "PID encontrado pela janela:",
            pid
        );


        return pid;

    }


    pid =
        await obterPidPorTitulo(
            fonteSelecionada.name
        );


    if (
        pid
    ) {

        console.log(
            "PID encontrado pelo título:",
            pid
        );


        return pid;

    }


    return null;

}


// ==========================================================
// PARAR CAPTURA DE ÁUDIO
// ==========================================================

function pararAudioAplicativo() {

    if (
        processoAudio
    ) {

        console.log(
            "Encerrando LuluhGoAudio..."
        );


        try {

            processoAudio.kill();

        }
        catch (
            erro
        ) {

            console.log(
                "Erro encerrando capturador:",
                erro.message
            );

        }

    }


    processoAudio =
        null;

    pidAudioAtual =
        null;


    return true;

}


// ==========================================================
// INICIAR CAPTURA DE ÁUDIO DO APLICATIVO
// ==========================================================

async function iniciarAudioAplicativo() {

    pararAudioAplicativo();


    if (
        !fonteSelecionada
    ) {

        return {

            ok: false,

            erro:
                "Nenhuma janela foi selecionada."

        };

    }


    if (
        !fonteSelecionada.id.startsWith(
            "window:"
        )
    ) {

        return {

            ok: false,

            erro:
                "O áudio por aplicativo funciona ao selecionar uma janela, não a tela inteira."

        };

    }


    const pid =
        await descobrirPidFonte();


    if (
        !pid
    ) {

        return {

            ok: false,

            erro:
                "Não foi possível identificar o processo da janela selecionada."

        };

    }


    const caminhoHelper =
        obterCaminhoAudioHelper();


    console.log(
        "Iniciando áudio exclusivo."
    );


    console.log(
        "Executável:",
        caminhoHelper
    );


    console.log(
        "PID:",
        pid
    );


    try {

        processoAudio =
            spawn(
                caminhoHelper,

                [
                    String(
                        pid
                    ),

                    "--stdout"
                ],

                {

                    windowsHide:
                        true,

                    stdio: [
                        "ignore",
                        "pipe",
                        "pipe"
                    ]

                }
            );

    }
    catch (
        erro
    ) {

        processoAudio =
            null;


        return {

            ok: false,

            erro:
                "Não foi possível iniciar o LuluhGoAudio.exe: "
                +
                erro.message

        };

    }


    pidAudioAtual =
        pid;


    processoAudio.stdout.on(
        "data",
        dados => {

            if (
                !janelaPrincipal
                ||
                janelaPrincipal.isDestroyed()
            ) {

                return;

            }


            /*
            O Buffer precisa virar Uint8Array
            para atravessar o IPC com segurança.
            */

            const pcm =
                new Uint8Array(
                    dados
                );


            janelaPrincipal
                .webContents
                .send(
                    "audio-pcm",
                    pcm
                );

        }
    );


    processoAudio.stderr.on(
        "data",
        dados => {

            const texto =
                dados
                    .toString()
                    .trim();


            if (
                texto
            ) {

                console.log(
                    "[LuluhGoAudio]",
                    texto
                );

            }

        }
    );


    processoAudio.on(
        "error",
        erro => {

            console.error(
                "Erro no LuluhGoAudio:",
                erro
            );


            if (
                janelaPrincipal
                &&
                !janelaPrincipal.isDestroyed()
            ) {

                janelaPrincipal
                    .webContents
                    .send(
                        "audio-erro",
                        erro.message
                    );

            }


            processoAudio =
                null;

            pidAudioAtual =
                null;

        }
    );


    processoAudio.on(
        "close",
        codigo => {

            console.log(
                "LuluhGoAudio encerrado. Código:",
                codigo
            );


            if (
                janelaPrincipal
                &&
                !janelaPrincipal.isDestroyed()
            ) {

                janelaPrincipal
                    .webContents
                    .send(
                        "audio-encerrado",
                        codigo
                    );

            }


            processoAudio =
                null;

            pidAudioAtual =
                null;

        }
    );


    return {

        ok: true,

        pid:
            pid,

        nome:
            fonteSelecionada.name,

        formato: {

            sampleRate:
                48000,

            channels:
                2,

            bitsPerSample:
                16

        }

    };

}


// ==========================================================
// IPC - LISTAR FONTES
// ==========================================================

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
                        ?
                        fonte.appIcon
                            .toDataURL()
                        :
                        null

            })
        );

    }
);


// ==========================================================
// IPC - SELECIONAR FONTE
// ==========================================================

ipcMain.handle(
    "selecionar-fonte",

    async (
        evento,
        id
    ) => {

        const fontes =
            await listarFontes();


        const fonte =
            fontes.find(
                item =>
                    item.id ===
                    id
            );


        if (
            !fonte
        ) {

            fonteSelecionada =
                null;


            console.log(
                "Fonte não encontrada:",
                id
            );


            return false;

        }


        fonteSelecionada = {

            id:
                fonte.id,

            name:
                fonte.name

        };


        console.log(
            "Fonte escolhida:",
            fonteSelecionada.id
        );


        console.log(
            "Nome:",
            fonteSelecionada.name
        );


        return true;

    }
);


// ==========================================================
// IPC - INICIAR ÁUDIO
// ==========================================================

ipcMain.handle(
    "iniciar-audio-aplicativo",

    async () => {

        return await iniciarAudioAplicativo();

    }
);


// ==========================================================
// IPC - PARAR ÁUDIO
// ==========================================================

ipcMain.handle(
    "parar-audio-aplicativo",

    async () => {

        pararAudioAplicativo();


        return true;

    }
);


// ==========================================================
// IPC - INFORMAÇÃO DE ÁUDIO
// ==========================================================

ipcMain.handle(
    "status-audio-aplicativo",

    async () => {

        return {

            ativo:
                !!processoAudio,

            pid:
                pidAudioAtual,

            fonte:
                fonteSelecionada

        };

    }
);


// ==========================================================
// CRIAR JANELA PRINCIPAL
// ==========================================================

function criarJanela() {

    janelaPrincipal =
        new BrowserWindow({

            width:
                1280,

            height:
                850,

            minWidth:
                900,

            minHeight:
                600,

            title:
                "LuluhGo",

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


    janelaPrincipal.on(
        "closed",
        () => {

            pararAudioAplicativo();


            janelaPrincipal =
                null;

        }
    );

}


// ==========================================================
// ELECTRON PRONTO
// ==========================================================

app.whenReady().then(

    async () => {

        /*
        ======================================================
        CAPTURA DE TELA/JANELA

        IMPORTANTE:

        Não usamos mais:
            audio: "loopback"

        O vídeo continua vindo do Electron.

        O áudio será capturado pelo LuluhGoAudio.exe
        exclusivamente do processo escolhido.
        ======================================================
        */

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
                                    fonteSelecionada
                                    &&
                                    item.id ===
                                    fonteSelecionada.id
                            );


                        if (
                            !fonte
                        ) {

                            console.log(
                                "Nenhuma fonte escolhida."
                            );


                            callback(
                                {}
                            );


                            return;

                        }


                        /*
                        SOMENTE VÍDEO.

                        Não colocar "loopback" aqui.
                        */

                        callback({

                            video:
                                fonte

                        });

                    }
                    catch (
                        erro
                    ) {

                        console.error(
                            "Erro na captura:",
                            erro
                        );


                        callback(
                            {}
                        );

                    }

                },

                {

                    useSystemPicker:
                        false

                }

            );


        /*
        Pequeno tempo para o servidor local
        ficar disponível antes de abrir a interface.
        */

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
                        .length ===
                    0
                ) {

                    criarJanela();

                }

            }
        );

    }
);


// ==========================================================
// ENCERRAR
// ==========================================================

app.on(
    "before-quit",

    () => {

        pararAudioAplicativo();

    }
);


app.on(
    "window-all-closed",

    () => {

        pararAudioAplicativo();


        if (
            process.platform !==
            "darwin"
        ) {

            app.quit();

        }

    }
);