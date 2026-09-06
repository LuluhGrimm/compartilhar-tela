const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");


// ==========================================
// EXPRESS
// ==========================================

const app = express();


// Permite requisições vindas do Electron
// local e do próprio site do Render.
app.use((req, res, next) => {

    res.header(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );

    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );


    if (req.method === "OPTIONS") {

        return res.sendStatus(204);

    }


    next();

});


// ==========================================
// SERVIDOR HTTP
// ==========================================

const server =
    http.createServer(app);


// ==========================================
// SOCKET.IO
// ==========================================

const io =
    new Server(
        server,
        {

            path:
                "/socket.io",

            cors: {

                origin:
                    "*",

                methods: [
                    "GET",
                    "POST"
                ],

                allowedHeaders: [
                    "Content-Type"
                ],

                credentials:
                    false

            },

            transports: [
                "polling",
                "websocket"
            ],

            allowEIO3:
                true

        }
    );


// ==========================================
// SITE
// ==========================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// Teste simples do servidor
app.get(
    "/status",
    (req, res) => {

        res.json({

            online:
                true,

            socketio:
                true,

            mensagem:
                "Servidor funcionando"

        });

    }
);


// ==========================================
// CONEXÕES
// ==========================================

io.on(
    "connection",
    socket => {

        console.log(
            "✅ Socket conectado:",
            socket.id
        );


        // ----------------------------------
        // ENTRAR NA SALA
        // ----------------------------------

        socket.on(
            "entrar-sala",
            sala => {

                if (!sala)
                    return;


                socket.join(
                    sala
                );


                console.log(
                    socket.id,
                    "entrou na sala",
                    sala
                );


                socket
                    .to(sala)
                    .emit(
                        "usuario-entrou",
                        socket.id
                    );

            }
        );


        // ----------------------------------
        // WEBRTC OFFER
        // ----------------------------------

        socket.on(
            "offer",
            dados => {

                if (
                    !dados
                    ||
                    !dados.sala
                )
                    return;


                socket
                    .to(dados.sala)
                    .emit(
                        "offer",
                        dados.offer
                    );

            }
        );


        // ----------------------------------
        // WEBRTC ANSWER
        // ----------------------------------

        socket.on(
            "answer",
            dados => {

                if (
                    !dados
                    ||
                    !dados.sala
                )
                    return;


                socket
                    .to(dados.sala)
                    .emit(
                        "answer",
                        dados.answer
                    );

            }
        );


        // ----------------------------------
        // ICE CANDIDATE
        // ----------------------------------

        socket.on(
            "ice-candidate",
            dados => {

                if (
                    !dados
                    ||
                    !dados.sala
                )
                    return;


                socket
                    .to(dados.sala)
                    .emit(
                        "ice-candidate",
                        dados.candidate
                    );

            }
        );


        // ----------------------------------
        // ENCERRAR TRANSMISSÃO
        // ----------------------------------

        socket.on(
            "encerrar-transmissao",
            sala => {

                if (!sala)
                    return;


                socket
                    .to(sala)
                    .emit(
                        "transmissao-encerrada"
                    );

            }
        );


        // ----------------------------------
        // DESCONECTOU
        // ----------------------------------

        socket.on(
            "disconnect",
            motivo => {

                console.log(
                    "❌ Socket desconectado:",
                    socket.id,
                    motivo
                );

            }
        );

    }
);


// ==========================================
// PORTA
// ==========================================

const PORT =
    process.env.PORT
    || 3000;


// ==========================================
// INICIAR SERVIDOR
// ==========================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "=================================="
        );

        console.log(
            `Servidor rodando na porta ${PORT}`
        );

        console.log(
            "Socket.IO habilitado em /socket.io"
        );

        console.log(
            "=================================="
        );

    }
);