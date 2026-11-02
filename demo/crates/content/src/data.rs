use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Deserialize, Serialize)]
pub struct Structure {
    pub source_id: String,
    pub source_name: String,
    pub source_object: String,
    pub latin: String,
    pub laterality: String,
    pub collections: Vec<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct Metadata {
    structures: Vec<Structure>,
}

pub fn parse_metadata(json: &str, expected: &[String]) -> Result<Vec<Structure>, String> {
    let metadata: Metadata = serde_json::from_str(json).map_err(|_| "Metadata không hợp lệ")?;
    let ids: HashSet<_> = metadata
        .structures
        .iter()
        .map(|part| &part.source_id)
        .collect();
    if metadata.structures.is_empty()
        || ids.len() != metadata.structures.len()
        || metadata.structures.iter().any(|part| {
            part.source_id.is_empty()
                || part.source_name.is_empty()
                || !["", "left", "right"].contains(&part.laterality.as_str())
        })
    {
        return Err("Metadata không hợp lệ".into());
    }
    let expected_ids: HashSet<_> = expected.iter().collect();
    if expected_ids.len() != expected.len() || ids != expected_ids {
        return Err("Metadata không khớp catalog".into());
    }
    Ok(metadata.structures)
}

pub struct CatalogData {
    catalog: catalog::Catalog,
    structures: Vec<Structure>,
}

impl CatalogData {
    pub fn from_json(json: &str) -> Result<Self, String> {
        Ok(Self {
            catalog: catalog::Catalog::from_json(json).map_err(|e| e.to_string())?,
            structures: Vec::new(),
        })
    }
    pub fn roots(&self) -> Vec<&catalog::StudyTarget> {
        self.catalog
            .targets
            .iter()
            .filter(|target| target.model.is_some())
            .collect()
    }
    pub fn ingest(&mut self, root: &str, json: &str) -> Result<Vec<String>, String> {
        let model = self
            .catalog
            .targets
            .iter()
            .find(|target| target.id == root)
            .and_then(|target| target.model.as_ref())
            .ok_or("Unknown model root")?;
        let parts = parse_metadata(json, &model.structure_ids)?;
        let ids = parts.iter().map(|part| part.source_id.clone()).collect();
        self.structures = parts;
        Ok(ids)
    }
    pub fn identities(&self) -> Vec<&str> {
        self.structures
            .iter()
            .map(|part| part.source_id.as_str())
            .collect()
    }
    pub fn source_name(&self, id: &str) -> Option<&str> {
        self.structures
            .iter()
            .find(|part| part.source_id == id)
            .map(|part| part.source_name.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const CATALOG: &str = include_str!("../../../content/catalog.json");
    const METADATA: &str = include_str!("../../../../public/models/z-anatomy/skeletal-system.json");

    #[test]
    fn presentation_catalog_preserves_membership_and_validated_source_names() {
        let mut data = CatalogData::from_json(CATALOG).unwrap();
        let root = data.roots()[0].id.clone();
        let expected = data.roots()[0]
            .model
            .as_ref()
            .unwrap()
            .structure_ids
            .clone();
        assert_eq!(expected.len(), 277);
        let ids = data.ingest(&root, METADATA).unwrap();
        assert_eq!(
            ids.iter().collect::<HashSet<_>>(),
            expected.iter().collect()
        );
        assert_eq!(data.identities().len(), 277);
        assert!(data.source_name(&ids[0]).is_some());
        assert!(data.source_name("unknown").is_none());
    }

    #[test]
    fn invalid_metadata_never_replaces_loaded_identities() {
        let mut data = CatalogData::from_json(CATALOG).unwrap();
        let root = data.roots()[0].id.clone();
        let ids = data.ingest(&root, METADATA).unwrap();
        for json in ["{", "{\"structures\":[]}"] {
            assert!(data.ingest(&root, json).is_err());
        }
        let mut changed: serde_json::Value = serde_json::from_str(METADATA).unwrap();
        changed["structures"][0]["source_id"] = "unknown".into();
        assert!(data.ingest(&root, &changed.to_string()).is_err());
        assert!(data.ingest("unknown", METADATA).is_err());
        assert_eq!(data.identities(), ids);
        changed["structures"][0] = changed["structures"][1].clone();
        assert!(data.ingest(&root, &changed.to_string()).is_err());
    }
}
