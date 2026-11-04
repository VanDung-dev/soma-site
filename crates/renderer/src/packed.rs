use crate::{Bounds, Scene};
use serde::{Deserialize, Serialize};

/// Geometry is transferred separately from this small worker-produced descriptor.
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PackedScene {
    pub scene: Scene,
    pub draws: Vec<(i32, i32)>,
    pub vertex_count: usize,
    pub index_count: usize,
}

impl PackedScene {
    pub fn validate(&self, vertex_floats: usize, index_count: usize) -> Result<(), String> {
        let bounds_valid =
            |b: Bounds| b.min.is_finite() && b.max.is_finite() && b.min.cmple(b.max).all();
        if self.scene.parts.is_empty()
            || self.draws.len() != self.scene.parts.len()
            || vertex_floats == 0
            || !vertex_floats.is_multiple_of(6)
            || self.vertex_count != vertex_floats / 6
            || self.index_count != index_count
            || !bounds_valid(self.scene.bounds)
            || !self.scene.bounds.radius().is_finite()
            || self.scene.bounds.radius() <= 0.0
            || self.scene.parts.iter().any(|p| {
                p.source_id.is_empty()
                    || !bounds_valid(p.bounds)
                    || p.color
                        .iter()
                        .any(|v| !v.is_finite() || !(0.0..=1.0).contains(v))
                    || !p.roughness.is_finite()
                    || !(0.0..=1.0).contains(&p.roughness)
                    || !p.metallic.is_finite()
                    || !(0.0..=1.0).contains(&p.metallic)
                    || !p.specular.is_finite()
                    || !(0.0..=1.0).contains(&p.specular)
                    || !p.subsurface.is_finite()
                    || !(0.0..=1.0).contains(&p.subsurface)
                    || !p.alpha_cutoff.is_finite()
                    || !(0.0..=1.0).contains(&p.alpha_cutoff)
                    || !p.active
                    || !p.visible
            })
        {
            return Err("Invalid prepared scene descriptor".into());
        }
        let mut end = 0usize;
        for &(count, offset) in &self.draws {
            if count <= 0
                || count % 3 != 0
                || offset < 0
                || end.checked_mul(4) != Some(offset as usize)
            {
                return Err("Invalid prepared draw range".into());
            }
            end = end
                .checked_add(count as usize)
                .ok_or("Index buffer too large")?;
        }
        if end != index_count {
            return Err("Prepared index count differs".into());
        }
        Ok(())
    }
}

impl Scene {
    pub fn pack(mut self) -> Result<(PackedScene, Vec<f32>, Vec<u32>), String> {
        let mut vertices = Vec::new();
        let mut indices: Vec<u32> = Vec::new();
        let mut draws = Vec::new();
        for part in &mut self.parts {
            let base = u32::try_from(vertices.len() / 6).map_err(|e| e.to_string())?;
            let offset = i32::try_from(
                indices
                    .len()
                    .checked_mul(4)
                    .ok_or("Index buffer too large")?,
            )
            .map_err(|e| e.to_string())?;
            draws.push((
                i32::try_from(part.indices.len()).map_err(|e| e.to_string())?,
                offset,
            ));
            vertices.append(&mut std::mem::take(&mut part.vertices));
            for index in std::mem::take(&mut part.indices) {
                indices.push(index.checked_add(base).ok_or("Vertex buffer too large")?);
            }
        }
        let packed = PackedScene {
            scene: self,
            draws,
            vertex_count: vertices.len() / 6,
            index_count: indices.len(),
        };
        packed.validate(vertices.len(), indices.len())?;
        Ok((packed, vertices, indices))
    }
}
