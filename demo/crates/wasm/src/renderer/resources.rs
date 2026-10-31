use super::util::js_error;
use js_sys::{Float32Array, Uint32Array};
use wasm_bindgen::{JsCast, JsValue};
use web_sys::{
    WebGl2RenderingContext as Gl, WebGlBuffer, WebGlProgram, WebGlTexture, WebGlVertexArrayObject,
};

pub(crate) struct Resources {
    pub(crate) gl: Gl,
    pub(crate) program: Option<WebGlProgram>,
    pub(crate) sphere_program: Option<WebGlProgram>,
    pub(crate) buffers: Vec<WebGlBuffer>,
    pub(crate) vaos: Vec<WebGlVertexArrayObject>,
    pub(crate) texture: Option<WebGlTexture>,
}
impl Resources {
    pub(crate) fn new(gl: Gl) -> Self {
        Self {
            gl,
            program: None,
            sphere_program: None,
            buffers: Vec::new(),
            vaos: Vec::new(),
            texture: None,
        }
    }
    pub(crate) fn upload(
        &mut self,
        vertices: Float32Array,
        indices: Uint32Array,
    ) -> Result<usize, JsValue> {
        let gl = &self.gl;
        let vao = gl
            .create_vertex_array()
            .ok_or_else(|| js_error("Cannot allocate vertex array"))?;
        self.vaos.push(vao);
        gl.bind_vertex_array(self.vaos.last());
        for (target, data) in [
            (
                Gl::ARRAY_BUFFER,
                vertices.unchecked_into::<js_sys::Object>(),
            ),
            (
                Gl::ELEMENT_ARRAY_BUFFER,
                indices.unchecked_into::<js_sys::Object>(),
            ),
        ] {
            let buffer = gl
                .create_buffer()
                .ok_or_else(|| js_error("Cannot allocate geometry buffer"))?;
            self.buffers.push(buffer);
            gl.bind_buffer(target, self.buffers.last());
            gl.buffer_data_with_array_buffer_view(target, &data, Gl::STATIC_DRAW);
        }
        gl.enable_vertex_attrib_array(0);
        gl.vertex_attrib_pointer_with_i32(0, 3, Gl::FLOAT, false, 24, 0);
        gl.enable_vertex_attrib_array(1);
        gl.vertex_attrib_pointer_with_i32(1, 3, Gl::FLOAT, false, 24, 12);
        if gl.get_error() != Gl::NO_ERROR {
            return Err(js_error("GPU geometry upload failed"));
        }
        Ok(self.vaos.len() - 1)
    }
}
impl Drop for Resources {
    fn drop(&mut self) {
        for buffer in &self.buffers {
            self.gl.delete_buffer(Some(buffer));
        }
        for vao in &self.vaos {
            self.gl.delete_vertex_array(Some(vao));
        }
        self.gl.delete_program(self.program.as_ref());
        self.gl.delete_program(self.sphere_program.as_ref());
        self.gl.delete_texture(self.texture.as_ref());
        if let Ok(Some(extension)) = self.gl.get_extension("WEBGL_lose_context")
            && let Ok(function) = js_sys::Reflect::get(&extension, &"loseContext".into())
            && let Some(function) = function.dyn_ref::<js_sys::Function>()
        {
            let _ = function.call0(&extension);
        }
    }
}
