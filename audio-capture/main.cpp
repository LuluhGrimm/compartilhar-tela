#include <Windows.h>
#include <Audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <wrl.h>
#include <wrl/implements.h>

#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <cstdint>

using Microsoft::WRL::ComPtr;
using Microsoft::WRL::FtmBase;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;
using Microsoft::WRL::ClassicCom;


/*
============================================================
LuluhGo Audio

Modos disponíveis:

1) TESTE WAV
   LuluhGoAudio.exe PID arquivo.wav [segundos]

   Exemplo:
   LuluhGoAudio.exe 1234 teste.wav 10


2) STREAM AO VIVO
   LuluhGoAudio.exe PID --stdout

   Nesse modo:
   - stdout = SOMENTE áudio PCM bruto
   - stderr = mensagens/logs

   Formato do PCM:
   - 48000 Hz
   - Stereo
   - 16 bits
   - Little Endian

IMPORTANTE:
Nunca escrever mensagens em stdout no modo --stdout,
pois o Electron receberá stdout como áudio.
============================================================
*/


class ActivationHandler :
    public RuntimeClass<
        RuntimeClassFlags<ClassicCom>,
        FtmBase,
        IActivateAudioInterfaceCompletionHandler>
{
public:

    ActivationHandler()
    {
        completedEvent =
            CreateEventW(
                nullptr,
                TRUE,
                FALSE,
                nullptr
            );
    }


    ~ActivationHandler()
    {
        if (completedEvent)
        {
            CloseHandle(
                completedEvent
            );
        }
    }


    STDMETHODIMP ActivateCompleted(
        IActivateAudioInterfaceAsyncOperation* operation
    ) override
    {
        HRESULT activateResult =
            E_FAIL;

        ComPtr<IUnknown> audioInterface;


        HRESULT hr =
            operation->GetActivateResult(
                &activateResult,
                &audioInterface
            );


        if (
            SUCCEEDED(hr)
            &&
            SUCCEEDED(activateResult)
        )
        {
            hr =
                audioInterface.As(
                    &audioClient
                );
        }
        else if (
            SUCCEEDED(hr)
        )
        {
            hr =
                activateResult;
        }


        result =
            hr;


        SetEvent(
            completedEvent
        );


        return S_OK;
    }


    HANDLE completedEvent =
        nullptr;

    HRESULT result =
        E_FAIL;

    ComPtr<IAudioClient>
        audioClient;
};


/*
============================================================
FUNÇÕES WAV
============================================================
*/


void WriteUInt16(
    std::ofstream& file,
    uint16_t value
)
{
    file.write(
        reinterpret_cast<const char*>(
            &value
        ),
        sizeof(value)
    );
}


void WriteUInt32(
    std::ofstream& file,
    uint32_t value
)
{
    file.write(
        reinterpret_cast<const char*>(
            &value
        ),
        sizeof(value)
    );
}


void WriteWavHeader(
    std::ofstream& file,
    uint32_t dataSize,
    uint16_t channels,
    uint32_t sampleRate,
    uint16_t bitsPerSample
)
{
    const uint32_t byteRate =
        sampleRate
        *
        channels
        *
        bitsPerSample
        /
        8;


    const uint16_t blockAlign =
        channels
        *
        bitsPerSample
        /
        8;


    file.seekp(
        0,
        std::ios::beg
    );


    file.write(
        "RIFF",
        4
    );

    WriteUInt32(
        file,
        36 + dataSize
    );


    file.write(
        "WAVE",
        4
    );


    file.write(
        "fmt ",
        4
    );

    WriteUInt32(
        file,
        16
    );


    // PCM
    WriteUInt16(
        file,
        1
    );


    WriteUInt16(
        file,
        channels
    );


    WriteUInt32(
        file,
        sampleRate
    );


    WriteUInt32(
        file,
        byteRate
    );


    WriteUInt16(
        file,
        blockAlign
    );


    WriteUInt16(
        file,
        bitsPerSample
    );


    file.write(
        "data",
        4
    );


    WriteUInt32(
        file,
        dataSize
    );
}


/*
============================================================
ESCREVER PCM NO STDOUT
============================================================
*/


bool WritePcmToStdout(
    const BYTE* data,
    DWORD bytes
)
{
    if (
        data == nullptr
        ||
        bytes == 0
    )
    {
        return true;
    }


    HANDLE stdoutHandle =
        GetStdHandle(
            STD_OUTPUT_HANDLE
        );


    if (
        stdoutHandle == nullptr
        ||
        stdoutHandle ==
            INVALID_HANDLE_VALUE
    )
    {
        return false;
    }


    DWORD totalWritten =
        0;


    while (
        totalWritten < bytes
    )
    {
        DWORD written =
            0;


        BOOL result =
            WriteFile(
                stdoutHandle,
                data + totalWritten,
                bytes - totalWritten,
                &written,
                nullptr
            );


        if (
            !result
            ||
            written == 0
        )
        {
            return false;
        }


        totalWritten +=
            written;
    }


    return true;
}


/*
============================================================
MAIN
============================================================
*/


int wmain(
    int argc,
    wchar_t* argv[]
)
{
    /*
    --------------------------------------------------------
    ARGUMENTOS
    --------------------------------------------------------
    */

    if (
        argc < 3
    )
    {
        std::wcerr
            << L"\n"
            << L"LuluhGo Audio\n\n"

            << L"Modo WAV:\n"
            << L"LuluhGoAudio.exe PID arquivo.wav [segundos]\n\n"

            << L"Modo ao vivo:\n"
            << L"LuluhGoAudio.exe PID --stdout\n\n"

            << L"Exemplo WAV:\n"
            << L"LuluhGoAudio.exe 1234 teste.wav 10\n\n"

            << L"Exemplo stream:\n"
            << L"LuluhGoAudio.exe 1234 --stdout\n";


        return 1;
    }


    DWORD targetPid =
        0;


    try
    {
        targetPid =
            std::stoul(
                argv[1]
            );
    }
    catch (...)
    {
        std::wcerr
            << L"PID invalido.\n";


        return 1;
    }


    if (
        targetPid == 0
    )
    {
        std::wcerr
            << L"PID invalido.\n";


        return 1;
    }


    std::wstring segundoArgumento =
        argv[2];


    bool stdoutMode =
        (
            segundoArgumento ==
            L"--stdout"
        );


    std::wstring outputPath;


    int durationSeconds =
        10;


    if (
        !stdoutMode
    )
    {
        outputPath =
            segundoArgumento;


        if (
            argc >= 4
        )
        {
            try
            {
                durationSeconds =
                    std::stoi(
                        argv[3]
                    );
            }
            catch (...)
            {
                durationSeconds =
                    10;
            }
        }


        if (
            durationSeconds <= 0
        )
        {
            durationSeconds =
                10;
        }
    }


    /*
    --------------------------------------------------------
    COM
    --------------------------------------------------------
    */

    HRESULT hr =
        CoInitializeEx(
            nullptr,
            COINIT_MULTITHREADED
        );


    if (
        FAILED(hr)
    )
    {
        std::wcerr
            << L"Erro ao inicializar COM: 0x"
            << std::hex
            << hr
            << L"\n";


        return 1;
    }


    /*
    --------------------------------------------------------
    PROCESS LOOPBACK
    --------------------------------------------------------
    */

    AUDIOCLIENT_ACTIVATION_PARAMS
        activationParams = {};


    activationParams.ActivationType =
        AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;


    activationParams
        .ProcessLoopbackParams
        .TargetProcessId =
            targetPid;


    activationParams
        .ProcessLoopbackParams
        .ProcessLoopbackMode =
            PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;


    PROPVARIANT activateParams =
        {};


    activateParams.vt =
        VT_BLOB;


    activateParams.blob.cbSize =
        sizeof(
            activationParams
        );


    activateParams.blob.pBlobData =
        reinterpret_cast<BYTE*>(
            &activationParams
        );


    auto handler =
        Make<ActivationHandler>();


    if (
        !handler
    )
    {
        std::wcerr
            << L"Nao foi possivel criar "
            << L"o manipulador de audio.\n";


        CoUninitialize();


        return 1;
    }


    ComPtr<
        IActivateAudioInterfaceAsyncOperation
    >
        asyncOperation;


    hr =
        ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            __uuidof(IAudioClient),
            &activateParams,
            handler.Get(),
            &asyncOperation
        );


    if (
        FAILED(hr)
    )
    {
        std::wcerr
            << L"Erro em ActivateAudioInterfaceAsync: 0x"
            << std::hex
            << hr
            << L"\n";


        CoUninitialize();


        return 1;
    }


    WaitForSingleObject(
        handler->completedEvent,
        INFINITE
    );


    if (
        FAILED(
            handler->result
        )
    )
    {
        std::wcerr
            << L"Erro ao ativar captura: 0x"
            << std::hex
            << handler->result
            << L"\n";


        CoUninitialize();


        return 1;
    }


    /*
    --------------------------------------------------------
    AUDIO CLIENT
    --------------------------------------------------------
    */

    ComPtr<IAudioClient>
        audioClient =
            handler->audioClient;


    if (
        !audioClient
    )
    {
        std::wcerr
            << L"IAudioClient nao foi criado.\n";


        CoUninitialize();


        return 1;
    }


    /*
    --------------------------------------------------------
    FORMATO FIXO

    PCM
    48 kHz
    Stereo
    16 bits
    --------------------------------------------------------
    */

    WAVEFORMATEX format =
        {};


    format.wFormatTag =
        WAVE_FORMAT_PCM;


    format.nChannels =
        2;


    format.nSamplesPerSec =
        48000;


    format.wBitsPerSample =
        16;


    format.nBlockAlign =
        format.nChannels
        *
        format.wBitsPerSample
        /
        8;


    format.nAvgBytesPerSec =
        format.nSamplesPerSec
        *
        format.nBlockAlign;


    format.cbSize =
        0;


    /*
    --------------------------------------------------------
    FLAGS
    --------------------------------------------------------
    */

    DWORD streamFlags =
        AUDCLNT_STREAMFLAGS_LOOPBACK
        |
        AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM
        |
        AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY;


    hr =
        audioClient->Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            streamFlags,
            0,
            0,
            &format,
            nullptr
        );


    if (
        FAILED(hr)
    )
    {
        std::wcerr
            << L"Erro em IAudioClient::Initialize: 0x"
            << std::hex
            << hr
            << L"\n";


        CoUninitialize();


        return 1;
    }


    /*
    --------------------------------------------------------
    CAPTURE CLIENT
    --------------------------------------------------------
    */

    ComPtr<IAudioCaptureClient>
        captureClient;


    hr =
        audioClient->GetService(
            IID_PPV_ARGS(
                &captureClient
            )
        );


    if (
        FAILED(hr)
    )
    {
        std::wcerr
            << L"Erro ao obter IAudioCaptureClient: 0x"
            << std::hex
            << hr
            << L"\n";


        CoUninitialize();


        return 1;
    }


    /*
    --------------------------------------------------------
    WAV OPCIONAL
    --------------------------------------------------------
    */

    std::ofstream wavFile;


    uint32_t totalDataBytes =
        0;


    if (
        !stdoutMode
    )
    {
        wavFile.open(
            outputPath,
            std::ios::binary
            |
            std::ios::trunc
        );


        if (
            !wavFile
        )
        {
            std::wcerr
                << L"Nao foi possivel criar "
                << L"o arquivo WAV.\n";


            CoUninitialize();


            return 1;
        }


        WriteWavHeader(
            wavFile,
            0,
            format.nChannels,
            format.nSamplesPerSec,
            format.wBitsPerSample
        );
    }


    /*
    --------------------------------------------------------
    INICIAR
    --------------------------------------------------------
    */

    hr =
        audioClient->Start();


    if (
        FAILED(hr)
    )
    {
        std::wcerr
            << L"Erro ao iniciar captura: 0x"
            << std::hex
            << hr
            << L"\n";


        if (
            wavFile.is_open()
        )
        {
            wavFile.close();
        }


        CoUninitialize();


        return 1;
    }


    /*
    --------------------------------------------------------
    LOGS

    ATENÇÃO:
    stderr é usado para os logs porque no modo ao vivo
    stdout contém apenas áudio.
    --------------------------------------------------------
    */

    std::wcerr
        << L"\n====================================\n"
        << L"       LuluhGo Audio\n"
        << L"====================================\n"
        << L"PID: "
        << targetPid
        << L"\n"
        << L"Formato: PCM 48000 Hz / Stereo / 16-bit\n";


    if (
        stdoutMode
    )
    {
        std::wcerr
            << L"Modo: STREAM AO VIVO\n"
            << L"Enviando PCM para stdout...\n\n";
    }
    else
    {
        std::wcerr
            << L"Modo: WAV\n"
            << L"Duracao: "
            << durationSeconds
            << L" segundos\n"
            << L"Arquivo: "
            << outputPath
            << L"\n\n";
    }


    /*
    --------------------------------------------------------
    LOOP DE CAPTURA
    --------------------------------------------------------
    */

    ULONGLONG startTime =
        GetTickCount64();


    bool continuar =
        true;


    while (
        continuar
    )
    {
        /*
        No modo WAV existe tempo limite.

        No modo stdout a captura continua
        até o Electron encerrar o processo
        ou o pipe stdout ser fechado.
        */

        if (
            !stdoutMode
        )
        {
            ULONGLONG elapsed =
                GetTickCount64()
                -
                startTime;


            if (
                elapsed
                >=
                static_cast<ULONGLONG>(
                    durationSeconds
                )
                *
                1000
            )
            {
                break;
            }
        }


        UINT32 packetLength =
            0;


        hr =
            captureClient->GetNextPacketSize(
                &packetLength
            );


        if (
            FAILED(hr)
        )
        {
            std::wcerr
                << L"Erro lendo tamanho "
                << L"do pacote: 0x"
                << std::hex
                << hr
                << L"\n";


            break;
        }


        while (
            packetLength > 0
        )
        {
            BYTE* data =
                nullptr;


            UINT32 framesAvailable =
                0;


            DWORD flags =
                0;


            UINT64 devicePosition =
                0;


            UINT64 qpcPosition =
                0;


            hr =
                captureClient->GetBuffer(
                    &data,
                    &framesAvailable,
                    &flags,
                    &devicePosition,
                    &qpcPosition
                );


            if (
                FAILED(hr)
            )
            {
                std::wcerr
                    << L"Erro em GetBuffer: 0x"
                    << std::hex
                    << hr
                    << L"\n";


                continuar =
                    false;


                break;
            }


            const UINT32 bytes =
                framesAvailable
                *
                format.nBlockAlign;


            /*
            ------------------------------------------------
            BUFFER SILENCIOSO
            ------------------------------------------------
            */

            if (
                flags
                &
                AUDCLNT_BUFFERFLAGS_SILENT
            )
            {
                std::vector<BYTE>
                    silence(
                        bytes,
                        0
                    );


                if (
                    stdoutMode
                )
                {
                    if (
                        !WritePcmToStdout(
                            silence.data(),
                            bytes
                        )
                    )
                    {
                        continuar =
                            false;
                    }
                }
                else
                {
                    wavFile.write(
                        reinterpret_cast<const char*>(
                            silence.data()
                        ),
                        bytes
                    );
                }
            }

            /*
            ------------------------------------------------
            BUFFER COM ÁUDIO
            ------------------------------------------------
            */

            else if (
                data != nullptr
            )
            {
                if (
                    stdoutMode
                )
                {
                    if (
                        !WritePcmToStdout(
                            data,
                            bytes
                        )
                    )
                    {
                        continuar =
                            false;
                    }
                }
                else
                {
                    wavFile.write(
                        reinterpret_cast<const char*>(
                            data
                        ),
                        bytes
                    );
                }
            }


            if (
                !stdoutMode
            )
            {
                totalDataBytes +=
                    bytes;
            }


            captureClient->ReleaseBuffer(
                framesAvailable
            );


            if (
                !continuar
            )
            {
                break;
            }


            hr =
                captureClient->GetNextPacketSize(
                    &packetLength
                );


            if (
                FAILED(hr)
            )
            {
                packetLength =
                    0;


                continuar =
                    false;


                break;
            }
        }


        Sleep(
            5
        );
    }


    /*
    --------------------------------------------------------
    ENCERRAR CAPTURA
    --------------------------------------------------------
    */

    audioClient->Stop();


    /*
    --------------------------------------------------------
    FINALIZAR WAV
    --------------------------------------------------------
    */

    if (
        !stdoutMode
        &&
        wavFile.is_open()
    )
    {
        WriteWavHeader(
            wavFile,
            totalDataBytes,
            format.nChannels,
            format.nSamplesPerSec,
            format.wBitsPerSample
        );


        wavFile.close();


        std::wcerr
            << L"\nCaptura concluida!\n"
            << L"Bytes gravados: "
            << totalDataBytes
            << L"\n";
    }


    /*
    --------------------------------------------------------
    FINAL
    --------------------------------------------------------
    */

    if (
        stdoutMode
    )
    {
        std::wcerr
            << L"\nStream de audio encerrado.\n";
    }


    CoUninitialize();


    return 0;
}