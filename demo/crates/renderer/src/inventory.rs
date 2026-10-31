use crate::{Bounds, Scene};
use glam::Vec3;
use std::collections::{BTreeMap, HashMap};

impl Scene {
    pub fn inventory_layout(&self, aspect: f32) -> Result<(Vec<Vec3>, Bounds), String> {
        if !aspect.is_finite() || aspect <= 0.0 {
            return Err("Invalid inventory aspect ratio".into());
        }
        let scene = self;
        let mut structures = BTreeMap::<&str, Bounds>::new();
        for part in scene.parts.iter().filter(|part| part.visible) {
            structures
                .entry(&part.source_id)
                .and_modify(|bounds| *bounds = bounds.union(part.bounds))
                .or_insert(part.bounds);
        }
        let scale = scene.bounds.radius();
        let center = scene.bounds.center();
        let gap = scale * 0.04;
        let mut cards: Vec<_> = structures
            .into_iter()
            .map(|(id, bounds)| {
                let size = bounds.max - bounds.min;
                (
                    id,
                    bounds,
                    size.x.max(scale * 0.035) + gap,
                    size.y.max(scale * 0.035) + gap,
                )
            })
            .collect();
        cards.sort_by(|a, b| b.3.total_cmp(&a.3).then_with(|| a.0.cmp(b.0)));
        let area: f32 = cards.iter().map(|c| c.2 * c.3).sum();
        let width = cards
            .iter()
            .map(|c| c.2)
            .fold(scale * 0.3, f32::max)
            .max((area * aspect.clamp(0.5, 1.5)).sqrt() * 1.18);
        let (mut x, mut y, mut row, mut used_width) = (0.0_f32, 0.0_f32, 0.0_f32, 0.0_f32);
        let mut cells = HashMap::new();
        for (id, bounds, w, h) in cards {
            if x > 0.0 && x + w > width {
                x = 0.0;
                y += row;
                row = 0.0;
            }
            cells.insert(id, (Vec3::new(x + w * 0.5, -y - h * 0.5, 0.0), bounds));
            x += w;
            used_width = used_width.max(x);
            row = row.max(h);
        }
        let shift = center + Vec3::new(-used_width * 0.5, (y + row) * 0.5, 0.0);
        let offsets: Vec<_> = scene
            .parts
            .iter()
            .map(|part| {
                cells
                    .get(part.source_id.as_str())
                    .map_or(Vec3::ZERO, |(cell, bounds)| *cell + shift - bounds.center())
            })
            .collect();
        let bounds = scene
            .parts
            .iter()
            .zip(&offsets)
            .filter(|(part, _)| part.visible)
            .map(|(part, offset)| Bounds {
                min: part.bounds.min + *offset,
                max: part.bounds.max + *offset,
            })
            .reduce(Bounds::union)
            .ok_or("Empty inventory")?;
        Ok((offsets, bounds))
    }
}
