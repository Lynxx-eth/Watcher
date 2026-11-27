# Optional 3D models

The scanner works out of the box with a **procedurally built** holographic figure
(`src/three/body/ProceduralBody.tsx`). To use a real anatomy mesh instead:

1. Get a human body model you're licensed to use, e.g. a CC0/CC-BY model from
   Sketchfab (check the licence and credit the author), or export a base mesh
   from MakeHuman (CC0 output) / Blender.
2. In Blender: pose it standing with arms slightly away from the body, apply
   transforms, decimate to roughly 30–60k triangles, then export as **glTF Binary (.glb)**
   (enable Draco compression if you like; the loader supports it).
3. Save it here as **`human.glb`**.

The app detects the file automatically and switches the scanner to it ("Model: GLB"
appears in the scanner corner). It's normalised to the platform height, given the
same holographic shader, and regions are picked by hit height/width.
If the file is missing or fails to load, the procedural figure is used.
