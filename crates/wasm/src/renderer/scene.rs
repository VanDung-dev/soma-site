use super::{AnatomyViewer, util::js_error};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl AnatomyViewer {
    pub fn begin_reconstruction(&mut self, now: f64, animate: bool) -> Result<(), JsValue> {
        let mut reconstruction = ::renderer::Reconstruction::default();
        reconstruction
            .append(&self.scene.parts, self.scene.bounds, now, animate)
            .map_err(js_error)?;
        self.reconstruction = reconstruction;
        Ok(())
    }
    pub fn start_reconstruction(&mut self, now: f64, animate: bool) -> Result<(), JsValue> {
        self.reconstruction.rebase(now).map_err(js_error)?;
        if !animate {
            self.reconstruction.finish();
        }
        Ok(())
    }
    pub fn render_reconstruction(&mut self, now: f64) -> Result<bool, JsValue> {
        let active = self.advance_reconstruction(now)?;
        self.draw();
        Ok(active)
    }
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
