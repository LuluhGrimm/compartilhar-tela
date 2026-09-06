const express =
    require("express");

const http =
    require("http");

const { Server } =
    require("socket.io");

const path =
    require("path");


const app =
    express();

const server =
    http.createServer(app);

const io =
    new Server(server);


app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


io.on(
    "connection",
    socket => {

        console.log(
            "Conectado:",
            socket.id
        );


        socket.on(
            "entrar-sala",
            sala => {

                socket.join(sala);

                console.log(
                    socket.id,
                    "entrou em",
                    sala
                );

            }
        );


        socket.on(
            "offer",
            dados => {

                socket
                    .to(dados.sala)
                    .emit(
                        "offer",
                        dados.offer
                    );

            }
        );


        socket.on(
            "answer",
            dados => {

                socket
                    .to(dados.sala)
                    .emit(
                        "answer",
                        dados.answer
                    );

            }
        );


        socket.on(
            "ice-candidate",
            dados => {

                socket
                    .to(dados.sala)
                    .emit(
                        "ice-candidate",
                        dados.candidate
                    );

            }
        );

    }
);


const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Servidor rodando na porta ${PORT}`
    );

});