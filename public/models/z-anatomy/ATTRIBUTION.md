# Z-Anatomy assets and names

These GLB and JSON packages are derived from the locally supplied `Z-Anatomy/Startup.blend`. The original file is not modified. Its SHA-256, the selection recipe checksum, Blender version and each generated file checksum are recorded in `manifest.json`.

## Authors and licenses

[Z-Anatomy upstream credits](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/Readme.md) name Gauthier Kervyn (anatomy, design and 3D work), Marcin Zielinski (Blender add-on), Lluis Vinent (Unity) and translation contributors. Upstream distributes the project content under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). These adapted model packages retain that license, subject to the component notices below.

The project builds on BodyParts3D by the Database Center for Life Science. Z-Anatomy's upstream notice credits its original BodyParts3D inputs under [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/). This is the provenance of this supplied Blender source; it is distinct from the newer BodyParts3D 4.0 downloads previously used by this app.

Upstream also identifies these third-party inputs:

- Cranial nerves and foramina: University of Dundee, CAHID, CC BY 4.0.
- Inner ear: University of Dundee, CAHID, CC BY-NC-SA 4.0.
- Kidney contribution: Lissie Cowley, CC BY-NC 4.0.
- Brain contributions: Brainder and University of Washington white matter work; consult the upstream credits for their provenance and applicable terms.

The upstream general license does not remove the noncommercial conditions of individual contributions. The supplied blend does not provide a complete, independently verified object-to-license mapping. Preserve these notices with redistribution and resolve component terms before commercial distribution. A credited contribution is not proof that its geometry is present in this particular blend.

The packages retain anatomical names and matching Latin terms from the `Translations` table, but no longer include description text from Blender text blocks. Existing Wikipedia URLs are retained separately in `content/wikipedia-references.json` as unverified mappings. The app reads Wikipedia in a remote iframe; article text and images are not redistributed in these packages. Upstream warns that translated names can contain errors.

The original Z-Anatomy Blender add-on has a separate GPL-3.0-or-later header. It is not copied into the app or executed by the importer. Blender loads the source with automatic scripts disabled, using only its bundled glTF exporter.

## Changes for this app

- Nine numbered source collections define the main categories. Detailed collection children define the nested navigation; collection order/names are retained. The root-to-detailed-collection correspondence is explicit in `content/z-anatomy-selections.json`; numbered anatomy collections are covered, with objects without evaluated surface polygons explicitly listed as exclusions.
- Meshes and curves are evaluated with Blender modifiers and exported to separate, selectable structures. Blender mesh validation repairs invalid mesh data on export copies; affected source objects and before/after counts are recorded in the manifest. Annotation text, helper profiles, guide curves and reference planes are excluded. No new anatomical surfaces are invented.
- Source positions and sizes are retained; Blender's glTF exporter converts Z-up to Y-up, in metres. Camera centering happens only in the viewer.
- Subcategory geometry uses collection membership, exact source-name matches for otherwise empty leaf folders, and the union of child memberships, restricted to its numbered root. Unassigned anatomy stays available at root; an empty subcategory does not prove absence of that anatomy elsewhere in the source. No anatomical synonyms or manual reassignment are inferred.
- Source names, parents, collection membership, laterality and optional Latin terms are retained as GLB node extras and companion JSON. `za:` IDs are SHA-256 prefixes of source object names, stable for this source version; they are not official FMA or TA2 identifiers.
- Material base colors, roughness and alpha are converted to simple nonmetallic PBR materials. Procedural Blender shaders, vertex color effects, comic effects, clipping and lighting are not reproduced. Materials lacking a usable Principled shader use their stored diffuse color and are listed in the manifest. No tissue texture maps or simulation are added.
- The viewer isolates, hides and focuses all mesh primitives belonging to a structure together. Definitions are rendered as text, not HTML or executable source code.

This source depicts adult male reference anatomy. Empty female collections, skin-layer folders or other named groups are not evidence of available 3D geometry. It does not provide every microscopic or internal organ structure. The supplied file reports an oesophagus/profile dependency cycle when evaluated in Blender 5.2; valid GLB output does not establish anatomical fidelity of modifier evaluation. Neither the source nor these selections have received an independent medical review in this project.
