# Les tests du cœur C++ de LinkFoot pour Unreal, compilés hors d'Unreal.
#
#   cmake -S unreal/tests-coeur -B build/coeur && cmake --build build/coeur && ctest --test-dir build/coeur --output-on-failure
#
# Le cœur est compilé comme Unreal le compile : C++20, sans exception, sans RTTI, et ici
# avec tous les avertissements traités en erreurs (Unreal refuse notamment les variables
# qui en masquent une autre).
cmake_minimum_required(VERSION 3.20)
project(LinkFootCoeurTests CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

set(COEUR ${CMAKE_CURRENT_SOURCE_DIR}/../LinkFoot/Source/LinkFootCore)
file(GLOB COEUR_SOURCES CONFIGURE_DEPENDS ${COEUR}/Private/LFCore/*.cpp)
add_library(lfcoeur STATIC ${COEUR_SOURCES})
target_include_directories(lfcoeur PUBLIC ${COEUR}/Public)
if(MSVC)
  target_compile_options(lfcoeur PRIVATE /W4 /WX /permissive- /EHs-c- /D_HAS_EXCEPTIONS=0 /utf-8)
else()
  target_compile_options(lfcoeur PRIVATE -Wall -Wextra -Wshadow -Wconversion -Wno-sign-conversion -Werror -fno-exceptions -fno-rtti)
endif()

add_executable(tests_coeur tests.cpp)
target_link_libraries(tests_coeur PRIVATE lfcoeur)
if(MSVC)
  target_compile_options(tests_coeur PRIVATE /W4 /utf-8)
else()
  target_compile_options(tests_coeur PRIVATE -Wall -Wextra -Wshadow)
endif()

enable_testing()
find_program(NODE node REQUIRED)
add_test(NAME fixtures COMMAND ${NODE} ${CMAKE_CURRENT_SOURCE_DIR}/generer-fixtures.mjs ${CMAKE_CURRENT_BINARY_DIR}/fixtures)
set_tests_properties(fixtures PROPERTIES FIXTURES_SETUP donnees TIMEOUT 300)
add_test(NAME coeur COMMAND tests_coeur ${CMAKE_CURRENT_BINARY_DIR}/fixtures ${CMAKE_CURRENT_SOURCE_DIR}/../LinkFoot/Content/LinkFoot/Scenes)
set_tests_properties(coeur PROPERTIES FIXTURES_REQUIRED donnees TIMEOUT 600)
