use wasm_bindgen::JsValue;
use web_sys::{WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader};

pub(crate) fn js_error(error: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&error.to_string())
}

pub(crate) fn read<T: serde::de::DeserializeOwned>(value: JsValue) -> Result<T, JsValue> {
    if let Some(json) = value.as_string() {
        serde_json::from_str(&json).map_err(js_error)
    } else {
        serde_wasm_bindgen::from_value(value).map_err(js_error)
    }
}

fn shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let shader = gl
        .create_shader(kind)
        .ok_or_else(|| js_error("Cannot allocate shader"))?;
    gl.shader_source(&shader, source);
    gl.compile_shader(&shader);
    if gl
        .get_shader_parameter(&shader, Gl::COMPILE_STATUS)
        .as_bool()
        != Some(true)
    {
        let log = gl.get_shader_info_log(&shader).unwrap_or_default();
        gl.delete_shader(Some(&shader));
        return Err(js_error(log));
    }
    Ok(shader)
}

pub(crate) fn program(
    gl: &Gl,
    vertex_source: &str,
    fragment_source: &str,
) -> Result<WebGlProgram, JsValue> {
    let vertex = shader(gl, Gl::VERTEX_SHADER, vertex_source)?;
    let fragment = match shader(gl, Gl::FRAGMENT_SHADER, fragment_source) {
        Ok(s) => s,
        Err(e) => {
            gl.delete_shader(Some(&vertex));
            return Err(e);
        }
    };
    let Some(program) = gl.create_program() else {
        gl.delete_shader(Some(&vertex));
        gl.delete_shader(Some(&fragment));
        return Err(js_error("Cannot allocate shader program"));
    };
    gl.attach_shader(&program, &vertex);
    gl.attach_shader(&program, &fragment);
    gl.link_program(&program);
    gl.delete_shader(Some(&vertex));
    gl.delete_shader(Some(&fragment));
    if gl
        .get_program_parameter(&program, Gl::LINK_STATUS)
        .as_bool()
        != Some(true)
    {
        let log = gl.get_program_info_log(&program).unwrap_or_default();
        gl.delete_program(Some(&program));
        return Err(js_error(log));
    }
    Ok(program)
}
