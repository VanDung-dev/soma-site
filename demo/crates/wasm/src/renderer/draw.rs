use super::AnatomyViewer;
use web_sys::WebGl2RenderingContext as Gl;

impl AnatomyViewer {
    pub(crate) fn draw_sphere(&self, matrix: glam::Mat4) {
        if self.backdrop == 0.0 {
            return;
        }
        let gl = &self.gpu.gl;
        let u = &self.sphere_uniforms;
        gl.use_program(self.gpu.sphere_program.as_ref());
        gl.uniform1f(Some(&u.opacity), self.backdrop);
        gl.bind_vertex_array(self.gpu.vaos.first());
        gl.disable(Gl::CULL_FACE);
        gl.enable(Gl::BLEND);
        gl.blend_func_separate(
            Gl::SRC_ALPHA,
            Gl::ONE_MINUS_SRC_ALPHA,
            Gl::ONE,
            Gl::ONE_MINUS_SRC_ALPHA,
        );
        gl.uniform_matrix4fv_with_f32_array(
            Some(&u.inverse),
            false,
            &matrix.inverse().to_cols_array(),
        );
        let bounds = self.scene.bounds;
        let center = bounds.center();
        gl.uniform4f(
            Some(&u.origin),
            center.x,
            center.y,
            center.z,
            self.camera.enclosure_radius(),
        );
        // The enclosure is a backdrop; it never occludes anatomy.
        gl.depth_mask(false);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.depth_mask(true);
        gl.disable(Gl::BLEND);
    }

    pub(crate) fn draw(&self) {
        let mut camera = self.camera.clone();
        let bounds = self.canvas.get_bounding_client_rect();
        if bounds.width() > 0.0 && bounds.height() > 0.0 {
            camera.aspect = (bounds.width() / bounds.height()) as f32;
        }
        let matrix = camera.matrix();
        let gl = &self.gpu.gl;
        let u = &self.uniforms;
        gl.viewport(
            0,
            0,
            self.canvas.width() as i32,
            self.canvas.height() as i32,
        );
        gl.depth_mask(true);
        gl.enable(Gl::DEPTH_TEST);
        gl.depth_func(Gl::LEQUAL);
        gl.disable(Gl::BLEND);
        gl.disable(Gl::DITHER);
        gl.clear_color(0.0, 0.0, 0.0, 0.0);
        gl.clear(Gl::COLOR_BUFFER_BIT | Gl::DEPTH_BUFFER_BIT);
        self.draw_sphere(matrix);
        gl.use_program(self.gpu.program.as_ref());
        gl.uniform3f(Some(&u.part_offset), 0.0, 0.0, 0.0);
        let light_basis = self.camera.light_basis();
        gl.uniform_matrix3fv_with_f32_array(
            Some(&u.light_basis),
            false,
            &light_basis.to_cols_array(),
        );
        gl.uniform_matrix4fv_with_f32_array(
            Some(&u.shadow_projection),
            false,
            &matrix.to_cols_array(),
        );
        gl.uniform1i(Some(&u.shadow_pass), 0);
        gl.uniform1i(Some(&u.shadow_quality), 0);
        gl.uniform1i(Some(&u.lighting_quality), 2);
        gl.uniform1i(Some(&u.shadow_map), 0);
        gl.uniform2f(Some(&u.shadow_texel), 1.0, 1.0);
        gl.uniform1f(Some(&u.shadow_offset), 0.0);
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, self.gpu.texture.as_ref());
        gl.bind_vertex_array(self.gpu.vaos.first());
        gl.uniform_matrix4fv_with_f32_array(Some(&u.projection), false, &matrix.to_cols_array());
        let eye = self.camera.eye();
        gl.uniform3f(Some(&u.eye), eye.x, eye.y, eye.z);
        gl.uniform1i(Some(&u.picking), 0);
        let mut order: Vec<_> = self
            .scene
            .parts
            .iter()
            .enumerate()
            .filter(|(i, p)| {
                (p.visible || self.reconstruction.fading_out(*i))
                    && self.reconstruction.opacity(*i) > 0.0
            })
            .map(|(i, _)| i)
            .collect();
        order.sort_by(|&a_index, &b_index| {
            let a = &self.scene.parts[a_index];
            let b = &self.scene.parts[b_index];
            a.blend.cmp(&b.blend).then_with(|| {
                if a.blend {
                    let a_center = a.bounds.center();
                    let b_center = b.bounds.center();
                    b_center
                        .distance_squared(eye)
                        .total_cmp(&a_center.distance_squared(eye))
                } else {
                    std::cmp::Ordering::Equal
                }
            })
        });
        let mut bound_vao = usize::MAX;
        for i in order {
            let p = &self.scene.parts[i];
            let offset = self.offsets[i];
            gl.uniform3f(Some(&u.part_offset), offset.x, offset.y, offset.z);
            if p.double_sided {
                gl.disable(Gl::CULL_FACE);
            } else {
                gl.enable(Gl::CULL_FACE);
                gl.cull_face(Gl::BACK);
            }
            if p.blend {
                gl.enable(Gl::BLEND);
                gl.blend_func_separate(
                    Gl::SRC_ALPHA,
                    Gl::ONE_MINUS_SRC_ALPHA,
                    Gl::ONE,
                    Gl::ONE_MINUS_SRC_ALPHA,
                );
                gl.depth_mask(false);
            } else {
                gl.disable(Gl::BLEND);
                gl.depth_mask(true);
            }
            gl.uniform4fv_with_f32_array(Some(&u.color), &p.color);
            gl.uniform1f(Some(&u.roughness), p.roughness);
            gl.uniform1f(Some(&u.metallic), p.metallic);
            gl.uniform1f(Some(&u.specular), p.specular);
            gl.uniform1f(Some(&u.subsurface), p.subsurface);
            gl.uniform1f(Some(&u.cutoff), p.alpha_cutoff);
            gl.uniform1i(Some(&u.selected), 0);
            gl.uniform3f(Some(&u.pick_color), 0.0, 0.0, 0.0);
            gl.uniform1f(Some(&u.reveal), self.reconstruction.opacity(i));
            let (vao, count, offset) = self.draws[i];
            if bound_vao != vao {
                gl.bind_vertex_array(Some(&self.gpu.vaos[vao]));
                bound_vao = vao;
            }
            gl.draw_elements_with_i32(Gl::TRIANGLES, count, Gl::UNSIGNED_INT, offset);
        }
        gl.depth_mask(true);
        gl.disable(Gl::BLEND);
    }
}
