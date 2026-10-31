//! Study navigation metadata, independent of UI and rendering.
//! Catalog IDs identify study entries, not anatomical concepts or mesh instances.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use thiserror::Error;

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub schema_version: u32,
    pub groups: Vec<Group>,
    pub targets: Vec<StudyTarget>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Group {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StudyTarget {
    pub id: String,
    pub title: String,
    pub group_id: String,
    pub source_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub structure_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<Model>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Model {
    pub path: String,
    pub scope: String,
    /// IDs physically stored in this asset; study folders may also reference other assets.
    pub structure_ids: Vec<String>,
}

#[derive(Debug, Error)]
pub enum CatalogError {
    #[error("Catalog JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Unsupported catalog schema version: {0}")]
    UnsupportedVersion(u32),
    #[error("Catalog entries must have nonempty IDs and titles")]
    EmptyField,
    #[error("Duplicate catalog ID: {0}")]
    DuplicateId(String),
    #[error("Study entry {target_id} references unknown group {group_id}")]
    UnknownGroup { target_id: String, group_id: String },
    #[error("Invalid local model descriptor: {0}")]
    InvalidModel(String),
    #[error("Invalid source hierarchy or structure membership: {0}")]
    InvalidHierarchy(String),
}

impl Catalog {
    pub fn from_json(json: &str) -> Result<Self, CatalogError> {
        let catalog: Self = serde_json::from_str(json)?;
        if catalog.schema_version != 4 {
            return Err(CatalogError::UnsupportedVersion(catalog.schema_version));
        }
        let mut ids = HashSet::new();
        for (id, title) in catalog
            .groups
            .iter()
            .map(|g| (&g.id, &g.title))
            .chain(catalog.targets.iter().map(|t| (&t.id, &t.title)))
        {
            if id.trim().is_empty() || title.trim().is_empty() {
                return Err(CatalogError::EmptyField);
            }
            if !ids.insert(id) {
                return Err(CatalogError::DuplicateId(id.clone()));
            }
        }
        let groups: HashSet<_> = catalog.groups.iter().map(|g| &g.id).collect();
        let targets: HashMap<_, _> = catalog.targets.iter().map(|t| (&t.id, t)).collect();
        let asset_members: HashSet<_> = catalog
            .targets
            .iter()
            .filter_map(|t| t.model.as_ref())
            .flat_map(|m| &m.structure_ids)
            .collect();
        for target in &catalog.targets {
            if !groups.contains(&target.group_id) {
                return Err(CatalogError::UnknownGroup {
                    target_id: target.id.clone(),
                    group_id: target.group_id.clone(),
                });
            }
            let members: HashSet<_> = target.structure_ids.iter().collect();
            if target.source_name.trim().is_empty()
                || members.len() != target.structure_ids.len()
                || !members.is_subset(&asset_members)
                || !members.iter().all(|id| {
                    id.strip_prefix("za:")
                        .is_some_and(|s| s.len() == 16 && s.bytes().all(|b| b.is_ascii_hexdigit()))
                })
            {
                return Err(CatalogError::InvalidHierarchy(target.id.clone()));
            }
            if let Some(parent_id) = &target.parent_id {
                let Some(parent) = targets.get(parent_id) else {
                    return Err(CatalogError::InvalidHierarchy(target.id.clone()));
                };
                let parent_members: HashSet<_> = parent.structure_ids.iter().collect();
                if parent.group_id != target.group_id
                    || target.model.is_some()
                    || !members.is_subset(&parent_members)
                {
                    return Err(CatalogError::InvalidHierarchy(target.id.clone()));
                }
                let mut visited = HashSet::from([&target.id]);
                let mut ancestor = Some(parent_id);
                while let Some(id) = ancestor {
                    if !visited.insert(id) {
                        return Err(CatalogError::InvalidHierarchy(target.id.clone()));
                    }
                    let Some(entry) = targets.get(id) else {
                        return Err(CatalogError::InvalidHierarchy(target.id.clone()));
                    };
                    ancestor = entry.parent_id.as_ref();
                }
            } else if target.model.is_none() || members.is_empty() {
                return Err(CatalogError::InvalidHierarchy(target.id.clone()));
            }
            if let Some(model) = &target.model {
                let filename = model.path.strip_prefix("models/z-anatomy/");
                if model.scope.trim().is_empty()
                    || model.structure_ids.is_empty()
                    || model.structure_ids.iter().collect::<HashSet<_>>().len()
                        != model.structure_ids.len()
                    || !model.structure_ids.iter().all(|id| members.contains(id))
                    || !filename.is_some_and(|name| {
                        (name.ends_with(".glb") || name.ends_with(".glb.br"))
                            && name.trim_end_matches(".br").len() > 4
                            && name
                                .bytes()
                                .all(|b| b.is_ascii_lowercase() || b == b'.' || b == b'-')
                            && !name.contains("..")
                    })
                {
                    return Err(CatalogError::InvalidModel(target.id.clone()));
                }
            }
        }
        if catalog.groups.iter().any(|g| {
            catalog
                .targets
                .iter()
                .filter(|t| t.group_id == g.id && t.parent_id.is_none())
                .count()
                != 1
        }) {
            return Err(CatalogError::InvalidHierarchy(
                "Each group needs one source root".into(),
            ));
        }
        Ok(catalog)
    }
}

/// Both native and WebAssembly adapters expose this validated catalog.
pub fn catalog_json() -> Result<String, CatalogError> {
    let catalog = Catalog::from_json(include_str!("../../../content/catalog.json"))?;
    Ok(serde_json::to_string(&catalog)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    const STARTER: &str = include_str!("../../../content/upstream-catalog.json");

    #[test]
    fn demo_catalog_is_valid_and_contains_only_the_skeletal_asset() {
        let demo = Catalog::from_json(&catalog_json().unwrap()).unwrap();
        assert_eq!(demo.groups.len(), 1);
        let roots: Vec<_> = demo
            .targets
            .iter()
            .filter(|target| target.model.is_some())
            .collect();
        assert_eq!(roots.len(), 1);
        assert_eq!(
            roots[0].model.as_ref().unwrap().path,
            "models/z-anatomy/skeletal-system.glb.br"
        );
        assert_eq!(roots[0].model.as_ref().unwrap().structure_ids.len(), 277);
    }

    #[test]
    fn accepts_glb_and_brotli_model_paths_and_rejects_other_formats() {
        assert!(Catalog::from_json(STARTER).is_ok());
        assert!(
            changed(|v| {
                let path = v["targets"][0]["model"]["path"].as_str().unwrap();
                v["targets"][0]["model"]["path"] = path.trim_end_matches(".br").into();
            })
            .is_ok()
        );
        assert!(matches!(
            changed(|v| v["targets"][0]["model"]["path"] = "models/z-anatomy/model.glb.gz".into()),
            Err(CatalogError::InvalidModel(_))
        ));
    }

    #[test]
    fn source_catalog_has_nine_roots_and_deep_navigation() {
        let catalog = Catalog::from_json(STARTER).unwrap();
        assert_eq!(catalog.groups.len(), 9);
        assert_eq!(catalog.targets.len(), 1981);
        assert_eq!(
            catalog.targets.iter().filter(|t| t.model.is_some()).count(),
            9
        );
        assert_eq!(catalog.targets[0].source_name, "1: Skeletal system");
        assert!(
            catalog
                .targets
                .iter()
                .any(|t| t.source_name == "Right atrium")
        );
        assert!(catalog.targets.iter().any(|t| t.structure_ids.is_empty()));
    }

    fn changed(edit: impl FnOnce(&mut serde_json::Value)) -> Result<Catalog, CatalogError> {
        let mut value = serde_json::from_str(STARTER).unwrap();
        edit(&mut value);
        Catalog::from_json(&serde_json::to_string(&value).unwrap())
    }

    #[test]
    fn rejects_incompatible_and_ambiguous_data() {
        assert!(matches!(
            changed(|v| v["schema_version"] = 1.into()),
            Err(CatalogError::UnsupportedVersion(1))
        ));
        assert!(matches!(
            changed(|v| v["targets"][1]["id"] = v["targets"][0]["id"].clone()),
            Err(CatalogError::DuplicateId(_))
        ));
        assert!(matches!(
            changed(|v| v["targets"][0]["group_id"] = "missing".into()),
            Err(CatalogError::UnknownGroup { .. })
        ));
        assert!(matches!(
            changed(|v| v["targets"][0]["title"] = " ".into()),
            Err(CatalogError::EmptyField)
        ));
        assert!(matches!(
            Catalog::from_json("{"),
            Err(CatalogError::Json(_))
        ));
        assert!(matches!(
            changed(|v| v["targets"][0]["model"]["path"] = "https://example.com/model.glb".into()),
            Err(CatalogError::InvalidModel(_))
        ));
    }

    #[test]
    fn rejects_broken_hierarchy_and_membership() {
        for edit in [
            (|v: &mut serde_json::Value| v["targets"][1]["parent_id"] = "missing".into())
                as fn(&mut serde_json::Value),
            |v| v["targets"][1]["parent_id"] = v["targets"][1]["id"].clone(),
            |v| v["targets"][1]["group_id"] = v["groups"][1]["id"].clone(),
            |v| v["targets"][1]["structure_ids"] = serde_json::json!(["za:ffffffffffffffff"]),
            |v| v["targets"][1]["structure_ids"] = serde_json::json!(["bad-id"]),
            |v| {
                let id = v["targets"][0]["structure_ids"][0].clone();
                v["targets"][1]["structure_ids"] = serde_json::json!([id, id]);
            },
            |v| {
                v["targets"][0]
                    .as_object_mut()
                    .unwrap()
                    .remove("model")
                    .map(|_| ())
                    .unwrap()
            },
            |v| v["targets"][1]["model"] = v["targets"][0]["model"].clone(),
        ] {
            assert!(matches!(
                changed(edit),
                Err(CatalogError::InvalidHierarchy(_))
            ));
        }
    }

    #[test]
    fn source_folders_can_reference_geometry_from_another_asset() {
        let catalog = Catalog::from_json(STARTER).unwrap();
        let thorax = catalog
            .targets
            .iter()
            .find(|t| t.source_name == "Thorax")
            .unwrap();
        let root = catalog
            .targets
            .iter()
            .find(|t| t.group_id == thorax.group_id && t.model.is_some())
            .unwrap();
        assert!(!thorax.structure_ids.is_empty());
        assert!(
            thorax.structure_ids.iter().any(|id| !root
                .model
                .as_ref()
                .unwrap()
                .structure_ids
                .contains(id))
        );
        assert!(matches!(
            changed(|v| {
                v["targets"][0]["structure_ids"]
                    .as_array_mut()
                    .unwrap()
                    .push("za:ffffffffffffffff".into());
            }),
            Err(CatalogError::InvalidHierarchy(_))
        ));
        for edit in [
            (|v: &mut serde_json::Value| {
                v["targets"][0]["model"]["structure_ids"] = serde_json::json!([])
            }) as fn(&mut serde_json::Value),
            |v| {
                v["targets"][0]["model"]["structure_ids"] =
                    serde_json::json!(["za:ffffffffffffffff"])
            },
            |v| {
                let id = v["targets"][0]["model"]["structure_ids"][0].clone();
                v["targets"][0]["model"]["structure_ids"] = serde_json::json!([id.clone(), id]);
            },
        ] {
            assert!(matches!(
                changed(edit),
                Err(CatalogError::InvalidModel(_) | CatalogError::InvalidHierarchy(_))
            ));
        }
    }
}
