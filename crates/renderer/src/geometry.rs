use glam::Vec3;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Bounds {
    pub min: Vec3,
    pub max: Vec3,
}

impl Bounds {
    pub fn center(self) -> Vec3 {
        (self.min + self.max) * 0.5
    }
    pub fn radius(self) -> f32 {
        (self.max - self.min).length() * 0.5
    }

    pub fn union(self, other: Self) -> Self {
        Self {
            min: self.min.min(other.min),
            max: self.max.max(other.max),
        }
    }
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Primitive {
    pub source_id: String,
    #[serde(skip)]
    pub vertices: Vec<f32>,
    #[serde(skip)]
    pub indices: Vec<u32>,
    pub bounds: Bounds,
    pub color: [f32; 4],
    pub roughness: f32,
    pub metallic: f32,
    pub specular: f32,
    pub subsurface: f32,
    pub double_sided: bool,
    pub blend: bool,
    pub alpha_cutoff: f32,
    pub active: bool,
    pub visible: bool,
}
