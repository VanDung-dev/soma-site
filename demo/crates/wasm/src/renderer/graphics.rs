use super::{AnatomyViewer, util::js_error};
use wasm_bindgen::prelude::*;
use web_sys::WebGl2RenderingContext as Gl;

#[wasm_bindgen]
impl AnatomyViewer {
    pub fn resize(&mut self, width: u32, height: u32) -> Result<(), JsValue> {
        let limit = self
            .gpu
            .gl
            .get_parameter(Gl::MAX_RENDERBUFFER_SIZE)?
            .as_f64()
            .unwrap_or(0.0) as u32;
        if width == 0 || height == 0 || width > limit || height > limit {
            return Err(js_error("Invalid viewport dimensions"));
        }
        self.canvas.set_width(width);
        self.canvas.set_height(height);
        self.camera_transition = None;
        self.camera.aspect = width as f32 / height as f32;
        self.refresh_scroll_transition()?;
        Ok(())
    }
}
