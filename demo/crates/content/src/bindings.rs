use serde::Serialize;
use wasm_bindgen::prelude::*;

fn value<T: Serialize>(data: &T) -> Result<JsValue, JsValue> {
    data.serialize(&serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true))
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub struct CatalogData {
    data: crate::data::CatalogData,
}

#[wasm_bindgen]
impl CatalogData {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<CatalogData, JsValue> {
        Ok(Self {
            data: crate::data::CatalogData::from_json(include_str!(
                "../../../content/catalog.json"
            ))
            .map_err(|e| JsValue::from_str(&e))?,
        })
    }
    pub fn roots(&self) -> Result<JsValue, JsValue> {
        value(&self.data.roots())
    }
    pub fn members(&self, id: &str) -> Result<JsValue, JsValue> {
        value(&self.data.members(id))
    }
    pub fn clear_metadata(&mut self) {
        self.data.clear_metadata();
    }
    pub fn ingest_metadata(&mut self, root: &str, json: &str) -> Result<JsValue, JsValue> {
        value(
            &self
                .data
                .ingest(root, json)
                .map_err(|e| JsValue::from_str(&e))?,
        )
    }
    pub fn identities(&self) -> Result<JsValue, JsValue> {
        value(&self.data.identities())
    }
    pub fn source_name(&self, id: &str) -> Option<String> {
        self.data.source_name(id).map(str::to_owned)
    }
}
