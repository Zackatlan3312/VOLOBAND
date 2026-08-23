#!/usr/bin/env python3
"""Empaqueta src/ en un archivo de lugar .rbxlx que Roblox Studio abre directo.

Uso:  python3 build/build_place.py

Lee el árbol de src/ (shared, server, client) y escribe
dist/LaHoraDelMercado.rbxlx con cada módulo ya colocado en su servicio.
Es la alternativa a Rojo para quien no quiera instalar herramientas.
"""

from __future__ import annotations

import pathlib
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DIST = ROOT / "dist"

_referent = 0


def next_referent() -> str:
    global _referent
    _referent += 1
    return f"RBX{_referent}"


def item(parent: ET.Element | None, class_name: str, name: str) -> ET.Element:
    el = ET.Element("Item", {"class": class_name, "referent": next_referent()})
    props = ET.SubElement(el, "Properties")
    ET.SubElement(props, "string", {"name": "Name"}).text = name
    if parent is not None:
        parent.append(el)
    return el


def props_of(el: ET.Element) -> ET.Element:
    found = el.find("Properties")
    assert found is not None
    return found


def add_script(parent: ET.Element, class_name: str, name: str, source: str) -> ET.Element:
    el = item(parent, class_name, name)
    props = props_of(el)
    # ProtectedString guarda el código; ElementTree escapa &, < y > por sí solo.
    ET.SubElement(props, "ProtectedString", {"name": "Source"}).text = source
    if class_name in ("Script", "LocalScript"):
        ET.SubElement(props, "bool", {"name": "Disabled"}).text = "false"
    return el


def script_class_for(path: pathlib.Path, side: str) -> tuple[str, str]:
    """Devuelve (clase de Roblox, nombre de la instancia) para un archivo .luau."""
    stem = path.stem
    if stem.endswith(".server"):
        return "Script", stem[: -len(".server")]
    if stem.endswith(".client"):
        return "LocalScript", stem[: -len(".client")]
    return "ModuleScript", stem


def add_tree(parent: ET.Element, directory: pathlib.Path, side: str) -> None:
    """Copia recursivamente una carpeta de src/ dentro del árbol XML."""
    for child in sorted(directory.iterdir(), key=lambda p: (p.is_file(), p.name)):
        if child.is_dir():
            folder = item(parent, "Folder", child.name)
            add_tree(folder, child, side)
        elif child.suffix == ".luau":
            class_name, name = script_class_for(child, side)
            add_script(parent, class_name, name, child.read_text(encoding="utf-8"))


def build() -> pathlib.Path:
    roblox = ET.Element("roblox", {"version": "4"})

    # ── Lighting ──
    # Technology = Future (token 4). Es la única propiedad que no puede fijarse
    # desde un script en tiempo de ejecución; el resto la pone LightingRig.
    lighting = item(roblox, "Lighting", "Lighting")
    ET.SubElement(props_of(lighting), "token", {"name": "Technology"}).text = "4"

    # ── ReplicatedStorage/Shared ──
    rs = item(roblox, "ReplicatedStorage", "ReplicatedStorage")
    shared = item(rs, "Folder", "Shared")
    add_tree(shared, SRC / "shared", "shared")

    # ── ServerScriptService/Server ──
    sss = item(roblox, "ServerScriptService", "ServerScriptService")
    server = item(sss, "Folder", "Server")
    add_tree(server, SRC / "server", "server")

    # ── StarterPlayer/StarterPlayerScripts/Client ──
    sp = item(roblox, "StarterPlayer", "StarterPlayer")
    sps = item(sp, "StarterPlayerScripts", "StarterPlayerScripts")
    client = item(sps, "Folder", "Client")
    add_tree(client, SRC / "client", "client")

    ET.indent(roblox, space="  ")
    DIST.mkdir(exist_ok=True)
    out = DIST / "LaHoraDelMercado.rbxlx"
    ET.ElementTree(roblox).write(out, encoding="utf-8", xml_declaration=True)
    return out


if __name__ == "__main__":
    path = build()
    size_kb = path.stat().st_size / 1024
    print(f"Escrito {path.relative_to(ROOT)} ({size_kb:.1f} KB)")
