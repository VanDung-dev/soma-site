use crate::{Bounds, Primitive, Scene};
use glam::{Mat3, Mat4, Vec3};
use serde::Deserialize;
use std::collections::HashSet;
use std::io::Read;

#[derive(Deserialize)]
#[serde(default)]
struct Surface {
    source_specular: f32,
    source_subsurface: f32,
}

impl Default for Surface {
    fn default() -> Self {
        Self {
            source_specular: 0.04,
            source_subsurface: 0.0,
        }
    }
}

impl Scene {
    pub fn from_glb(bytes: &[u8], expected: &[String]) -> Result<Self, String> {
        let mut decoded = Vec::new();
        let bytes = if bytes.starts_with(b"glTF") {
            bytes
        } else {
            let limit = 128 * 1024 * 1024;
            brotli_decompressor::Decompressor::new(bytes, 4096)
                .take(limit + 1)
                .read_to_end(&mut decoded)
                .map_err(|e| format!("Invalid Brotli model: {e}"))?;
            if decoded.len() as u64 > limit {
                return Err("Decompressed model exceeds 128 MiB".into());
            }
            &decoded
        };
        let gltf = gltf::Gltf::from_slice(bytes).map_err(|e| e.to_string())?;
        let blob = gltf.blob.as_deref().ok_or("GLB has no binary buffer")?;
        // shortcut: static, untextured GLB packages; extend the loader when assets gain textures or animation.
        if gltf
            .buffers()
            .any(|b| !matches!(b.source(), gltf::buffer::Source::Bin) || b.length() > blob.len())
            || gltf.textures().next().is_some()
            || gltf.animations().next().is_some()
            || gltf.skins().next().is_some()
            || gltf.extensions_required().next().is_some()
        {
            return Err("Unsupported GLB: external buffers, textures, skins, animation or required extensions".into());
        }
        for view in gltf.views() {
            if view
                .offset()
                .checked_add(view.length())
                .is_none_or(|end| end > view.buffer().length())
            {
                return Err("Buffer view exceeds binary buffer".into());
            }
        }
        for accessor in gltf.accessors() {
            let view = accessor.view().ok_or("Accessor has no buffer view")?;
            let stride = view.stride().unwrap_or(accessor.size());
            let end = accessor
                .count()
                .saturating_sub(1)
                .checked_mul(stride)
                .and_then(|offset| offset.checked_add(accessor.offset()))
                .and_then(|offset| offset.checked_add(accessor.size()));
            if accessor.sparse().is_some()
                || accessor.count() == 0
                || stride < accessor.size()
                || end.is_none_or(|end| end > view.length())
            {
                return Err("Invalid or unsupported accessor bounds".into());
            }
        }
        let mut parts = Vec::new();
        let scene = gltf
            .default_scene()
            .or_else(|| gltf.scenes().next())
            .ok_or("GLB has no scene")?;
        for node in scene.nodes() {
            load_node(
                node,
                Mat4::IDENTITY,
                None,
                blob,
                &mut HashSet::new(),
                &mut parts,
            )?;
        }
        let identities: HashSet<_> = parts.iter().map(|p| p.source_id.as_str()).collect();
        let expected_ids: HashSet<_> = expected.iter().map(String::as_str).collect();
        if parts.is_empty() || expected_ids.len() != expected.len() || identities != expected_ids {
            return Err("Geometry and metadata structure IDs do not match".into());
        }
        let bounds = parts
            .iter()
            .map(|p| p.bounds)
            .reduce(Bounds::union)
            .ok_or("Empty geometry")?;
        if !bounds.radius().is_finite() || bounds.radius() <= 0.0 {
            return Err("Invalid model bounds".into());
        }
        Ok(Self { parts, bounds })
    }
}

fn load_node(
    node: gltf::Node<'_>,
    parent: Mat4,
    inherited_id: Option<&str>,
    blob: &[u8],
    path: &mut HashSet<usize>,
    parts: &mut Vec<Primitive>,
) -> Result<(), String> {
    if path.len() >= 128 || !path.insert(node.index()) {
        return Err("Cyclic or excessively deep scene hierarchy".into());
    }
    let transform = parent * Mat4::from_cols_array_2d(&node.transform().matrix());
    if !transform.is_finite() || transform.determinant().abs() < 1e-12 {
        return Err("Invalid node transform".into());
    }
    let extras: serde_json::Value = node
        .extras()
        .as_ref()
        .map(|raw| serde_json::from_str(raw.get()))
        .transpose()
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let id = extras
        .get("source_id")
        .and_then(|v| v.as_str())
        .or(inherited_id);
    if let Some(mesh) = node.mesh() {
        let id = id
            .filter(|s| !s.is_empty())
            .ok_or("Mesh has no structure ID")?;
        let normal_matrix = Mat3::from_mat4(transform).inverse().transpose();
        for primitive in mesh.primitives() {
            if primitive.mode() != gltf::mesh::Mode::Triangles
                || primitive.morph_targets().next().is_some()
            {
                return Err("Only static triangle geometry is supported".into());
            }
            let reader = primitive.reader(|_| Some(blob));
            let positions: Vec<_> = reader
                .read_positions()
                .ok_or("Missing positions")?
                .collect();
            let normals: Vec<_> = reader.read_normals().ok_or("Missing normals")?.collect();
            if positions.is_empty() || positions.len() != normals.len() {
                return Err("Invalid position/normal counts".into());
            }
            let mut indices: Vec<u32> = reader
                .read_indices()
                .map(|i| i.into_u32().collect())
                .unwrap_or_else(|| (0..positions.len() as u32).collect());
            if indices.is_empty()
                || !indices.len().is_multiple_of(3)
                || indices.iter().any(|&i| i as usize >= positions.len())
            {
                return Err("Invalid triangle indices".into());
            }
            if transform.determinant() < 0.0 {
                for tri in indices.chunks_exact_mut(3) {
                    tri.swap(1, 2);
                }
            }
            let mut bounds = Bounds {
                min: Vec3::splat(f32::INFINITY),
                max: Vec3::splat(f32::NEG_INFINITY),
            };
            let mut vertices = Vec::with_capacity(positions.len() * 6);
            for (p, n) in positions.into_iter().zip(normals) {
                let p = transform.transform_point3(Vec3::from_array(p));
                let n = (normal_matrix * Vec3::from_array(n)).normalize_or_zero();
                if !p.is_finite() || !n.is_finite() || n.length_squared() < 0.5 {
                    return Err("Non-finite positions or invalid normals".into());
                }
                bounds.min = bounds.min.min(p);
                bounds.max = bounds.max.max(p);
                vertices.extend_from_slice(&p.to_array());
                vertices.extend_from_slice(&n.to_array());
            }
            let material = primitive.material();
            let pbr = material.pbr_metallic_roughness();
            let surface: Surface = material
                .extras()
                .as_ref()
                .map(|extras| serde_json::from_str(extras.get()))
                .transpose()
                .map_err(|e| format!("Invalid material parameters: {e}"))?
                .unwrap_or_default();
            if !surface.source_specular.is_finite()
                || !(0.0..=1.0).contains(&surface.source_specular)
                || !surface.source_subsurface.is_finite()
                || !(0.0..=1.0).contains(&surface.source_subsurface)
            {
                return Err("Invalid material parameters".into());
            }
            parts.push(Primitive {
                source_id: id.into(),
                vertices,
                indices,
                bounds,
                color: pbr.base_color_factor(),
                roughness: pbr.roughness_factor(),
                metallic: pbr.metallic_factor(),
                specular: surface.source_specular,
                subsurface: surface.source_subsurface,
                double_sided: material.double_sided(),
                blend: material.alpha_mode() == gltf::material::AlphaMode::Blend,
                alpha_cutoff: if material.alpha_mode() == gltf::material::AlphaMode::Mask {
                    material.alpha_cutoff().unwrap_or(0.5)
                } else {
                    0.0
                },
                active: true,
                visible: true,
            });
        }
    }
    for child in node.children() {
        load_node(child, transform, id, blob, path, parts)?;
    }
    path.remove(&node.index());
    Ok(())
}
