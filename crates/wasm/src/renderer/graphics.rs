use super::{AnatomyViewer, util::js_error};
use wasm_bindgen::prelude::*;
use web_sys::WebGl2RenderingContext as Gl;

#[wasm_bindgen]
impl AnatomyViewer {
    pub fn set_render_region(
        &mut self,
        left: f32,
        top: f32,
        width: f32,
        height: f32,
        aspect: f32,
    ) -> Result<(), JsValue> {
        let region = [left, top, width, height];
        if region.iter().any(|value| !value.is_finite())
            || !aspect.is_finite()
            || aspect <= 0.0
            || width <= 0.0
            || height <= 0.0
        {
            return Err(js_error("Invalid render region"));
        }
        self.render_region = region;
        self.camera.aspect = aspect;
        Ok(())
    }

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
