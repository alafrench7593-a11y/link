#!/usr/bin/env python3
"""Vérification de syntaxe de la couche Unreal de LinkFoot, HORS d'Unreal.

    python3 unreal/verif-syntaxe/verifier.py

Ce que ça fait : copie unreal/LinkFoot/Source dans un dossier temporaire, remplace ce que
l'Unreal Header Tool génère (GENERATED_BODY, les fichiers .generated.h) par le strict minimum,
puis compile chaque fichier .cpp avec g++ en mode -fsyntax-only, contre les déclarations
simulées de ue-simule/ (le sous-ensemble de l'API d'Unreal 5.8 que nous utilisons, recopié de
la référence d'Epic).

Ce que ça prouve : notre code est cohérent avec lui-même et avec les signatures relevées
(noms, types, constance, includes de nos propres fichiers, conversions entre le cœur et Unreal).
Ce que ça ne prouve pas : que l'API réelle d'Unreal 5.8 est celle que nous avons relevée, ni
que l'Unreal Header Tool accepte nos déclarations réfléchies. Seule une compilation par
l'Unreal Build Tool, sur un poste qui a Unreal 5.8, le prouve (unreal/README.md).
"""
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ICI = pathlib.Path(__file__).resolve().parent
SOURCE = ICI.parent / "LinkFoot" / "Source"
SIMULE = ICI / "ue-simule"
MODULES_UE = ["LinkFootMatch", "LinkFootPlayer", "LinkFootDebug", "LinkFoot"]

RE_CLASSE = re.compile(r"class\s+(?:\w+_API\s+)?(\w+)\s*:\s*public\s+(\w+)\s*\{\s*GENERATED_BODY\(\)", re.S)
RE_STRUCT = re.compile(r"(struct\s+(?:\w+_API\s+)?\w+\s*\{)\s*GENERATED_BODY\(\)", re.S)


def preparer(dossier: pathlib.Path) -> None:
    for h in list(dossier.rglob("*.h")) + list(dossier.rglob("*.cpp")):
        texte = h.read_text(encoding="utf-8")
        texte = re.sub(r'#include\s+"[^"]+\.generated\.h"\n', "", texte)
        texte = RE_CLASSE.sub(lambda m: (f"class {m.group(1)} : public {m.group(2)}\n{{\npublic:\n\tusing Super = {m.group(2)};\n"
                                         f"\tstatic UClass* StaticClass() {{ return nullptr; }}\nprivate:"), texte)
        texte = RE_STRUCT.sub(lambda m: m.group(1), texte)
        if "GENERATED_BODY" in texte:
            raise SystemExit(f"GENERATED_BODY non reconnu dans {h}")
        h.write_text(texte, encoding="utf-8")


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        copie = pathlib.Path(tmp) / "Source"
        shutil.copytree(SOURCE, copie)
        preparer(copie)
        inclusions = ["-I", str(SIMULE), "-I", str(copie / "LinkFootCore" / "Public")]
        for m in MODULES_UE:
            inclusions += ["-I", str(copie / m / "Public"), "-I", str(copie / m / "Private")]
        echecs = 0
        fichiers = sorted(p for m in MODULES_UE for p in (copie / m).rglob("*.cpp"))
        for cpp in fichiers:
            cmd = ["g++", "-std=c++20", "-fsyntax-only", "-Wall", "-Wextra", "-Wshadow", "-Wno-unused-parameter", *inclusions, str(cpp)]
            r = subprocess.run(cmd, capture_output=True, text=True)
            nom = cpp.relative_to(copie)
            if r.returncode != 0 or r.stderr.strip():
                echecs += 1 if r.returncode != 0 else 0
                print(("  ÉCHEC " if r.returncode != 0 else "  avert. ") + str(nom))
                print(r.stderr.replace(str(copie), "Source"))
            else:
                print("  ok     " + str(nom))
        # La compilation « unity » d'Unreal colle les fichiers d'un module en un seul : deux
        # fonctions de même nom dans des espaces anonymes de deux fichiers s'y heurtent.
        for m in MODULES_UE:
            unite = pathlib.Path(tmp) / f"Unity_{m}.cpp"
            unite.write_text("".join(f'#include "{p}"\n' for p in sorted((copie / m).rglob("*.cpp"))), encoding="utf-8")
            r = subprocess.run(["g++", "-std=c++20", "-fsyntax-only", "-Wno-unused-parameter", *inclusions, str(unite)], capture_output=True, text=True)
            if r.returncode != 0:
                echecs += 1
                print(f"  ÉCHEC unité {m} (fichiers collés comme le fait Unreal)")
                print(r.stderr.replace(str(copie), "Source"))
            else:
                print(f"  ok     unité {m} (fichiers collés comme le fait Unreal)")
        print(f"\n{'ÉCHEC' if echecs else 'OK'} : {len(fichiers)} fichiers de la couche Unreal, {echecs} en échec "
              "(syntaxe contre des déclarations simulées, pas une compilation Unreal)")
        return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
