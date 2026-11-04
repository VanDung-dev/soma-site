use wasm_bindgen::JsValue;
use web_sys::{WebGl2RenderingContext as Gl, WebGlProgram, WebGlUniformLocation};

use super::util::js_error;

pub(crate) struct Uniforms {
    pub(crate) projection: WebGlUniformLocation,
    pub(crate) part_offset: WebGlUniformLocation,
    pub(crate) eye: WebGlUniformLocation,
    pub(crate) light_basis: WebGlUniformLocation,
    pub(crate) color: WebGlUniformLocation,
    pub(crate) roughness: WebGlUniformLocation,
    pub(crate) metallic: WebGlUniformLocation,
    pub(crate) specular: WebGlUniformLocation,
    pub(crate) subsurface: WebGlUniformLocation,
    pub(crate) cutoff: WebGlUniformLocation,
    pub(crate) selected: WebGlUniformLocation,
    pub(crate) picking: WebGlUniformLocation,
    pub(crate) pick_color: WebGlUniformLocation,
    pub(crate) reveal: WebGlUniformLocation,
    pub(crate) shadow_pass: WebGlUniformLocation,
    pub(crate) shadow_projection: WebGlUniformLocation,
    pub(crate) shadow_map: WebGlUniformLocation,
    pub(crate) shadow_texel: WebGlUniformLocation,
    pub(crate) shadow_offset: WebGlUniformLocation,
    pub(crate) shadow_quality: WebGlUniformLocation,
    pub(crate) lighting_quality: WebGlUniformLocation,
}

pub(crate) struct SphereUniforms {
    pub(crate) inverse: WebGlUniformLocation,
    pub(crate) origin: WebGlUniformLocation,
    pub(crate) opacity: WebGlUniformLocation,
}

fn location(gl: &Gl, program: &WebGlProgram, name: &str) -> Result<WebGlUniformLocation, JsValue> {
    gl.get_uniform_location(program, name)
        .ok_or_else(|| js_error(format!("Missing shader uniform: {name}")))
}

impl Uniforms {
    pub(crate) fn load(gl: &Gl, program: &WebGlProgram) -> Result<Self, JsValue> {
        Ok(Self {
            projection: location(gl, program, "view_projection")?,
            part_offset: location(gl, program, "part_offset")?,
            eye: location(gl, program, "eye")?,
            light_basis: location(gl, program, "light_basis")?,
            color: location(gl, program, "base_color")?,
            roughness: location(gl, program, "roughness")?,
            metallic: location(gl, program, "metallic")?,
            specular: location(gl, program, "specular")?,
            subsurface: location(gl, program, "subsurface")?,
            cutoff: location(gl, program, "alpha_cutoff")?,
            selected: location(gl, program, "selected")?,
            picking: location(gl, program, "picking")?,
            pick_color: location(gl, program, "pick_color")?,
            reveal: location(gl, program, "reveal")?,
            shadow_pass: location(gl, program, "shadow_pass")?,
            shadow_projection: location(gl, program, "shadow_projection")?,
            shadow_map: location(gl, program, "shadow_map")?,
            shadow_texel: location(gl, program, "shadow_texel")?,
            shadow_offset: location(gl, program, "shadow_offset")?,
            shadow_quality: location(gl, program, "shadow_quality")?,
            lighting_quality: location(gl, program, "lighting_quality")?,
        })
    }
}

impl SphereUniforms {
    pub(crate) fn load(gl: &Gl, program: &WebGlProgram) -> Result<Self, JsValue> {
        let lookup = |name: &str| {
            gl.get_uniform_location(program, name)
                .ok_or_else(|| js_error(format!("Missing sphere uniform: {name}")))
        };
        Ok(Self {
            inverse: lookup("inverse_projection")?,
            origin: lookup("sphere_origin")?,
            opacity: lookup("backdrop_opacity")?,
        })
    }
}
