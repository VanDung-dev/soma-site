use super::{AnatomyViewer, util::js_error};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl AnatomyViewer {
    pub fn advance_reconstruction(&mut self, now: f64) -> Result<bool, JsValue> {
        self.reconstruction.advance(now).map_err(js_error)
    }
    pub fn finish_reconstruction(&mut self) {
        self.reconstruction.finish();
    }
    pub fn set_visibility(&mut self, ids: JsValue, now: Option<f64>) -> Result<(), JsValue> {
        if let Some(now) = now {
            self.reconstruction.check_time(now).map_err(js_error)?;
        }
        let ids: Vec<String> = super::util::read(ids)?;
        self.scene.set_visibility(&ids).map_err(js_error)?;
        self.reconstruction
            .set_visibility(&self.scene.parts, now)
            .map_err(js_error)?;
        Ok(())
    }
}
