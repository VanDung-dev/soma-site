use super::{AnatomyViewer, io::prepared_buffers, util::js_error};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

#[wasm_bindgen]
impl AnatomyViewer {
    #[wasm_bindgen(js_name = fromPrepared)]
    pub fn from_prepared(
        canvas: HtmlCanvasElement,
        prepared: js_sys::Array,
    ) -> Result<AnatomyViewer, JsValue> {
        let (packed, vertices, indices) = prepared_buffers(prepared)?;
        Self::from_buffers(canvas, packed, vertices, indices)
    }
    pub fn render(&self) {
        self.draw();
    }
    pub fn set_backdrop(&mut self, opacity: f32) -> Result<(), JsValue> {
        if !opacity.is_finite() || !(0.0..=1.0).contains(&opacity) {
            return Err(js_error("Invalid backdrop opacity"));
        }
        self.backdrop = opacity;
        Ok(())
    }
}
