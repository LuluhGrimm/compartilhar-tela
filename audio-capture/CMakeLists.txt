cmake_minimum_required(VERSION 3.20)

project(LuluhGoAudio LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(LuluhGoAudio
    main.cpp
)

target_compile_definitions(LuluhGoAudio PRIVATE
    UNICODE
    _UNICODE
    WIN32_LEAN_AND_MEAN
    NOMINMAX
)

target_link_libraries(LuluhGoAudio PRIVATE
    ole32
    uuid
    mmdevapi
    avrt
)