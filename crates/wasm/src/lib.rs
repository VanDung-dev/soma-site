use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn grid_projection(radius: f32, aspect: f32, x: f32, y: f32, span: f32, yaw: f32, pitch: f32) -> Vec<f32> {
    renderer::grid_projection(radius, aspect, x, y, span, yaw, pitch).to_vec()
}

#[wasm_bindgen]
#[derive(Default)]
pub struct ScrollCamera(renderer::ScrollCamera);

#[wasm_bindgen]
impl ScrollCamera {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn frame(&mut self, progress: f64, reduced_motion: bool, aspect: f64) -> Vec<f64> {
        self.0.frame(progress, reduced_motion, aspect).to_vec()
    }
}
