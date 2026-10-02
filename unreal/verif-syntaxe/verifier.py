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

Il relit aussi les en-têtes avec quelques règles connues de l'Unreal Header Tool, celles
qu'une erreur de frappe enfreint le plus souvent (regles_uht) : le .generated.h en dernier et
au nom du fichier, les préfixes des classes et des structures, un UENUM(BlueprintType) sur
uint8, aucune propriété lue par les Blueprints dans une section privée sans AllowPrivateAccess,
aucun type que la réflexion ne connaît pas (int, std::, lf::...) derrière un UPROPERTY. Et une
règle de la maison : les littéraux TEXT("...") restent en ASCII (un texte accentué passe par
UTF8_TO_TCHAR, ou par ULFMatchSubsystem::Texte), pour ne pas dépendre de l'encodage source.
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


RE_TYPE_INTERDIT = re.compile(r"^\s*(?:const\s+)?(?:int|unsigned|long|short|char|size_t|std::|lf::|TUniquePtr|TSharedPtr)\b")


def regles_uht(source: pathlib.Path) -> list:
    """Les règles de l'Unreal Header Tool qu'on peut vérifier sans lui, en-tête par en-tête."""
    erreurs = []
    for h in sorted(p for m in MODULES_UE for p in (source / m).rglob("*.h")):
        nom = h.relative_to(source)
        lignes = h.read_text(encoding="utf-8").splitlines()
        reflechi = any(re.match(r"\s*(UCLASS|USTRUCT|UENUM)\(", l) for l in lignes)
        includes = [(i, l) for i, l in enumerate(lignes) if l.startswith("#include")]
        generes = [(i, l) for i, l in includes if l.rstrip().endswith('.generated.h"')]
        if reflechi:
            attendu = f'#include "{h.stem}.generated.h"'
            if not generes:
                erreurs.append(f"{nom} : pas de {attendu}")
            elif generes[0][1].strip() != attendu:
                erreurs.append(f"{nom} : {generes[0][1].strip()} au lieu de {attendu}")
            elif includes[-1][0] != generes[0][0]:
                erreurs.append(f"{nom} : le .generated.h doit être le dernier #include")
        genre = ""		# « class » ou « struct » du prochain corps réfléchi
        acces = "public"
        i = 0
        while i < len(lignes):
            l = lignes[i].strip()
            if l.startswith("UCLASS("):
                genre = "class"
            elif l.startswith("USTRUCT("):
                genre = "struct"
            elif l.startswith("UENUM("):
                suite = lignes[i + 1].strip() if i + 1 < len(lignes) else ""
                if "BlueprintType" in l and not re.match(r"enum\s+class\s+\w+\s*:\s*uint8\b", suite):
                    erreurs.append(f"{nom}:{i + 2} : un UENUM(BlueprintType) doit être « enum class X : uint8 »")
                if not re.match(r"enum\s+class\s+E\w+", suite):
                    erreurs.append(f"{nom}:{i + 2} : le nom d'un UENUM commence par E")
            m = re.match(r"(class|struct)\s+(?:\w+_API\s+)?(\w+)\s*(?::|$)", l)
            if m and genre and not l.endswith(";"):
                prefixes = "UA" if genre == "class" else "F"
                if m.group(2)[0] not in prefixes or not m.group(2)[1:2].isupper():
                    erreurs.append(f"{nom}:{i + 1} : {m.group(2)} n'a pas le préfixe attendu ({' ou '.join(prefixes)})")
            if l.startswith("GENERATED_BODY()"):
                # GENERATED_BODY laisse une classe en privé, une structure en public
                acces = "private" if genre == "class" else "public"
                genre = ""
            elif l in ("public:", "protected:", "private:"):
                acces = l[:-1]
            elif l.startswith("UPROPERTY("):
                decl = l
                j = i
                while decl.count("(") > decl.count(")") and j + 1 < len(lignes):
                    j += 1
                    decl += " " + lignes[j].strip()
                membre = lignes[j + 1] if j + 1 < len(lignes) else ""
                if re.search(r"Blueprint(ReadOnly|ReadWrite|Assignable)", decl) and acces == "private" and "AllowPrivateAccess" not in decl:
                    erreurs.append(f"{nom}:{i + 1} : propriété lue par les Blueprints dans une section privée")
                if RE_TYPE_INTERDIT.match(membre):
                    erreurs.append(f"{nom}:{j + 2} : type inconnu de la réflexion derrière un UPROPERTY : {membre.strip()}")
                i = j
            i += 1
    for f in sorted(p for m in MODULES_UE for p in (source / m).rglob("*") if p.suffix in (".h", ".cpp")):
        for n, l in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            for lit in re.findall(r'TEXT\("((?:[^"\\]|\\.)*)"\)', l):
                if not lit.isascii():
                    erreurs.append(f"{f.relative_to(source)}:{n} : TEXT(\"{lit}\") n'est pas en ASCII")
    return erreurs


def main() -> int:
    erreurs_uht = regles_uht(SOURCE)
    for e in erreurs_uht:
        print("  ÉCHEC UHT " + e)
    if not erreurs_uht:
        print("  ok     règles de l'Unreal Header Tool (en-têtes réfléchis)")
    with tempfile.TemporaryDirectory() as tmp:
        copie = pathlib.Path(tmp) / "Source"
        shutil.copytree(SOURCE, copie)
        preparer(copie)
        inclusions = ["-I", str(SIMULE), "-I", str(copie / "LinkFootCore" / "Public")]
        for m in MODULES_UE:
            inclusions += ["-I", str(copie / m / "Public"), "-I", str(copie / m / "Private")]
        echecs = len(erreurs_uht)
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
