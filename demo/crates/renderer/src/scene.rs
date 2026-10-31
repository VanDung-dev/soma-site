use crate::{Bounds, Primitive};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Scene {
    pub parts: Vec<Primitive>,
    pub bounds: Bounds,
}

impl Scene {
    fn visibility_ids<'a>(&self, ids: &'a [String]) -> Result<HashSet<&'a str>, String> {
        let requested: HashSet<_> = ids.iter().map(String::as_str).collect();
        let known: HashSet<_> = self
            .parts
            .iter()
            .filter(|p| p.active)
            .map(|p| p.source_id.as_str())
            .collect();
        if requested.len() != ids.len() || !requested.is_subset(&known) {
            return Err("Unknown or duplicate visible structure ID".into());
        }
        Ok(requested)
    }

    pub fn set_visibility(&mut self, ids: &[String]) -> Result<(), String> {
        let visible = self.visibility_ids(ids)?;
        for part in &mut self.parts {
            part.visible = part.active && visible.contains(part.source_id.as_str());
        }
        Ok(())
    }
    pub fn bounds_for(&self, ids: &[String]) -> Result<Option<Bounds>, String> {
        let requested: HashSet<_> = ids.iter().map(String::as_str).collect();
        let parts: Vec<_> = self
            .parts
            .iter()
            .filter(|p| p.active && requested.contains(p.source_id.as_str()))
            .collect();
        let known: HashSet<_> = parts.iter().map(|p| p.source_id.as_str()).collect();
        if requested.len() != ids.len() || requested != known {
            return Err("Unknown or duplicate focus structure ID".into());
        }
        Ok(parts.into_iter().map(|p| p.bounds).reduce(Bounds::union))
    }
}
