mod api;
mod camera;
mod draw;
mod graphics;
mod io;
mod resources;
mod scene;
mod shaders;
mod uniforms;
mod util;

use ::renderer::{Camera, PackedScene, Reconstruction, Scene};
use js_sys::{Float32Array, Uint32Array};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{HtmlCanvasElement, WebGl2RenderingContext as Gl};

use resources::Resources;
use shaders::{FRAGMENT, SPHERE_FRAGMENT, SPHERE_VERTEX, VERTEX};
use uniforms::{SphereUniforms, Uniforms};
use util::{js_error, program};

pub(crate) struct ScrollTransition {
    start_camera: Camera,
    target_camera: Camera,
    start_offsets: Vec<glam::Vec3>,
    target_offsets: Vec<glam::Vec3>,
    focus: Vec<String>,
    frame: [f32; 4],
    yaw: f32,
    spread: bool,
    progress: f32,
}

impl ScrollTransition {
    pub(crate) fn blend_progress(&self) -> (f32, f32) {
        if self.spread {
            (
                (self.progress / 0.4).min(1.0),
                ((self.progress - 0.4) / 0.6).clamp(0.0, 1.0),
            )
        } else {
            (self.progress, self.progress)
        }
    }
}

#[wasm_bindgen]
pub struct AnatomyViewer {
    pub(crate) gpu: Resources,
    pub(crate) scene: Scene,
    pub(crate) camera: Camera,
    pub(crate) camera_transition: Option<(Camera, f64, f64)>,
    pub(crate) scroll_transition: Option<ScrollTransition>,
    pub(crate) offsets: Vec<glam::Vec3>,
    pub(crate) target_offsets: Vec<glam::Vec3>,
    pub(crate) uniforms: Uniforms,
    pub(crate) sphere_uniforms: SphereUniforms,
    pub(crate) backdrop: f32,
    pub(crate) render_region: [f32; 4],
    pub(crate) draws: Vec<(usize, i32, i32)>,
    pub(crate) reconstruction: Reconstruction,
    pub(crate) canvas: HtmlCanvasElement,
}

impl AnatomyViewer {
    pub(crate) fn from_buffers(
        canvas: HtmlCanvasElement,
        packed: PackedScene,
        vertices: Float32Array,
        indices: Uint32Array,
    ) -> Result<Self, JsValue> {
        packed
            .validate(vertices.length() as usize, indices.length() as usize)
            .map_err(js_error)?;
        let PackedScene { scene, draws, .. } = packed;
        let gl: Gl = canvas
            .get_context("webgl2")?
            .ok_or_else(|| js_error("WebGL2 is unavailable"))?
            .dyn_into()?;
        let mut gpu = Resources::new(gl.clone());
        gpu.program = Some(program(&gl, VERTEX, FRAGMENT)?);
        gpu.sphere_program = Some(program(&gl, SPHERE_VERTEX, SPHERE_FRAGMENT)?);
        let uniforms = Uniforms::load(&gl, gpu.program.as_ref().unwrap())?;
        let sphere_uniforms = SphereUniforms::load(&gl, gpu.sphere_program.as_ref().unwrap())?;
        gpu.upload(vertices, indices)?;
        gpu.texture = Some(
            gl.create_texture()
                .ok_or_else(|| js_error("Cannot allocate shader texture"))?,
        );
        gl.bind_texture(Gl::TEXTURE_2D, gpu.texture.as_ref());
        for parameter in [Gl::TEXTURE_MIN_FILTER, Gl::TEXTURE_MAG_FILTER] {
            gl.tex_parameteri(Gl::TEXTURE_2D, parameter, Gl::NEAREST as i32);
        }
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            Gl::TEXTURE_2D,
            0,
            Gl::RGBA8 as i32,
            1,
            1,
            0,
            Gl::RGBA,
            Gl::UNSIGNED_BYTE,
            Some(&[255; 4]),
        )?;
        if gl.get_error() != Gl::NO_ERROR {
            return Err(js_error("Shader texture allocation failed"));
        }
        let camera = Camera::new(scene.bounds);
        let mut reconstruction = Reconstruction::default();
        reconstruction
            .append(&scene.parts, scene.bounds, 0.0, false)
            .map_err(js_error)?;
        let offsets = vec![glam::Vec3::ZERO; scene.parts.len()];
        let mut viewer = Self {
            gpu,
            scene,
            camera,
            camera_transition: None,
            scroll_transition: None,
            target_offsets: offsets.clone(),
            offsets,
            uniforms,
            sphere_uniforms,
            backdrop: 0.0,
            render_region: [0.0, 0.0, 1.0, 1.0],
            draws: draws
                .into_iter()
                .map(|(count, offset)| (0, count, offset))
                .collect(),
            reconstruction,
            canvas,
        };
        viewer.resize(viewer.canvas.width().max(1), viewer.canvas.height().max(1))?;
        viewer.camera.reset();
        Ok(viewer)
    }
}
