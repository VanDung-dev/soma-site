use ::renderer::{PackedScene, Scene};
use js_sys::{Float32Array, Uint32Array};
use wasm_bindgen::prelude::*;

use super::util::js_error;

pub(crate) fn prepared_buffers(
    prepared: js_sys::Array,
) -> Result<(PackedScene, Float32Array, Uint32Array), JsValue> {
    if prepared.length() != 3
        || !prepared.get(0).is_instance_of::<Float32Array>()
        || !prepared.get(1).is_instance_of::<Uint32Array>()
    {
        return Err(js_error("Invalid prepared geometry buffers"));
    }
    let descriptor = prepared
        .get(2)
        .as_string()
        .ok_or_else(|| js_error("Missing scene descriptor"))?;
    let packed: PackedScene = serde_json::from_str(&descriptor).map_err(js_error)?;
    let vertices: Float32Array = prepared.get(0).unchecked_into();
    let indices: Uint32Array = prepared.get(1).unchecked_into();
    packed
        .validate(vertices.length() as usize, indices.length() as usize)
        .map_err(js_error)?;
    Ok((packed, vertices, indices))
}

#[wasm_bindgen]
pub fn prepare_model(bytes: JsValue, ids: JsValue) -> Result<js_sys::Array, JsValue> {
    let bytes = bytes
        .dyn_into::<js_sys::Uint8Array>()
        .map_err(|_| js_error("Invalid GLB package"))?;
    let ids: Vec<String> = serde_wasm_bindgen::from_value(ids).map_err(js_error)?;
    pack(Scene::from_glb(&bytes.to_vec(), &ids).map_err(js_error)?)
}

fn pack(scene: Scene) -> Result<js_sys::Array, JsValue> {
    let (packed, vertices, indices) = scene.pack().map_err(js_error)?;
    let result = js_sys::Array::new();
    result.push(&Float32Array::from(vertices.as_slice()));
    result.push(&Uint32Array::from(indices.as_slice()));
    result.push(&JsValue::from_str(
        &serde_json::to_string(&packed).map_err(js_error)?,
    ));
    Ok(result)
}
