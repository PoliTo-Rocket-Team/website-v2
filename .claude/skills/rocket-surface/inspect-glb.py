#!/usr/bin/env python3
"""Print a GLB's meshes (with material and UV presence) and materials.

Usage: python3 inspect-glb.py path/to/model.glb
"""
import json
import struct
import sys


def main(path: str) -> None:
    data = open(path, "rb").read()
    if data[:4] != b"glTF":
        sys.exit("not a binary glTF")
    json_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20 : 20 + json_len])

    materials = gltf.get("materials", [])
    names = [m.get("name", f"material{i}") for i, m in enumerate(materials)]
    accessors = gltf.get("accessors", [])

    print("== meshes")
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            attrs = prim["attributes"]
            mat = names[prim["material"]] if "material" in prim else "-"
            uv = "uv" if "TEXCOORD_0" in attrs else "NO UV"
            acc = accessors[attrs["POSITION"]]
            size = [round(b - a, 4) for a, b in zip(acc["min"], acc["max"])]
            flat = " ZERO-THICKNESS" if min(size) == 0 else ""
            print(f"{mesh.get('name', '?'):28} {mat:14} {uv:6} bbox {size}{flat}")

    print("== materials")
    for m in materials:
        pbr = m.get("pbrMetallicRoughness", {})
        base = pbr.get("baseColorFactor")
        base_s = "texture" if "baseColorTexture" in pbr else (
            "[" + ", ".join(f"{v:.3f}" for v in base[:3]) + "]" if base else "white"
        )
        metal = pbr.get("metallicFactor", 1.0)
        rough = pbr.get("roughnessFactor", 1.0)
        ext = ",".join(k.replace("KHR_materials_", "") for k in m.get("extensions", {}))
        print(f"{m.get('name', '?'):14} base {base_s:24} metal {metal:<5} rough {rough:<6} {ext}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
