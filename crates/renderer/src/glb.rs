mod node;
mod validate;

use crate::{Bounds, Scene};
use glam::Mat4;
use std::collections::HashSet;

impl Scene {
    pub fn from_glb(bytes: &[u8], expected: &[String]) -> Result<Self, String> {
        let decoded = validate::decode(bytes)?;
        let gltf = gltf::Gltf::from_slice(&decoded).map_err(|e| e.to_string())?;
        let blob = gltf.blob.as_deref().ok_or("GLB has no binary buffer")?;
        // shortcut: static, untextured GLB packages; extend the loader when assets gain textures or animation.
        validate::validate(&gltf, blob)?;
        let mut parts = Vec::new();
        let scene = gltf
            .default_scene()
            .or_else(|| gltf.scenes().next())
            .ok_or("GLB has no scene")?;
        for node in scene.nodes() {
            node::load_node(
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
