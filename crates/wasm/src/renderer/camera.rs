use super::{AnatomyViewer, ScrollTransition, util::js_error};
use ::renderer::Camera;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl AnatomyViewer {
    pub fn frame_region(
        &mut self,
        ids: JsValue,
        frame: JsValue,
        yaw: f32,
        spread: bool,
        now: Option<f64>,
    ) -> Result<(), JsValue> {
        if !yaw.is_finite() || now.is_some_and(|time| !time.is_finite() || time < 0.0) {
            return Err(js_error("Invalid presentation camera"));
        }
        let ids: Vec<String> = super::util::read(ids)?;
        let frame: [f32; 4] = super::util::read(frame)?;
        let (camera, offsets) = self.presentation_target(&ids, frame, yaw, spread)?;
        let before = self.camera.clone();
        self.scroll_transition = None;
        self.camera = camera;
        self.target_offsets = offsets;
        if now.is_none() {
            self.offsets.clone_from(&self.target_offsets);
        }
        self.transition_camera(before, now);
        Ok(())
    }

    pub fn begin_scroll_transition(
        &mut self,
        focus: JsValue,
        frame: JsValue,
        yaw: f32,
        spread: bool,
    ) -> Result<(), JsValue> {
        if !yaw.is_finite() {
            return Err(js_error("Invalid presentation camera"));
        }
        let focus: Vec<String> = super::util::read(focus)?;
        let frame: [f32; 4] = super::util::read(frame)?;
        let (target_camera, target_offsets) =
            self.presentation_target(&focus, frame, yaw, spread)?;
        self.camera_transition = None;
        self.scroll_transition = Some(ScrollTransition {
            start_camera: self.camera.clone(),
            target_camera,
            start_offsets: self.offsets.clone(),
            target_offsets,
            focus,
            frame,
            yaw,
            spread,
            progress: 0.0,
        });
        self.set_scroll_progress(0.0)
    }

    pub fn set_scroll_progress(&mut self, progress: f32) -> Result<(), JsValue> {
        if !progress.is_finite() || !(0.0..=1.0).contains(&progress) {
            return Err(js_error("Invalid scroll transition progress"));
        }
        let Some(transition) = self.scroll_transition.as_mut() else {
            return Err(js_error("No scroll transition is active"));
        };
        transition.progress = progress;
        let (camera_progress, offset_progress) = transition.blend_progress();
        self.camera = transition
            .start_camera
            .interpolate(&transition.target_camera, camera_progress);
        for ((offset, start), target) in self
            .offsets
            .iter_mut()
            .zip(&transition.start_offsets)
            .zip(&transition.target_offsets)
        {
            *offset = start.lerp(*target, offset_progress);
        }
        self.target_offsets.clone_from(&transition.target_offsets);
        Ok(())
    }

    pub fn reframe(&mut self, left: f32, top: f32, width: f32, height: f32) -> Result<(), JsValue> {
        self.camera_transition = None;
        self.scroll_transition = None;
        self.camera
            .reframe([left, top, width, height])
            .map_err(js_error)
    }
    pub fn advance_camera(&mut self, now: f64) -> Result<bool, JsValue> {
        if !now.is_finite() || now < 0.0 {
            return Err(js_error("Invalid camera transition timestamp"));
        }
        let Some((goal, started, previous)) = self.camera_transition.as_mut() else {
            return Ok(false);
        };
        if now < *previous {
            return Err(js_error("Camera transition timestamps must increase"));
        }
        if now - *started >= 900.0 {
            self.finish_camera_transition();
            return Ok(false);
        }
        let ease = |time: f64| {
            let t = ((time - *started) / 900.0).clamp(0.0, 1.0);
            t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
        };
        let before = ease(*previous);
        let blend =
            ((ease(now) - before) / (1.0 - before).max(f64::EPSILON)).clamp(0.0, 1.0) as f32;
        *previous = now;
        self.camera.approach(goal, blend);
        for (offset, target) in self.offsets.iter_mut().zip(&self.target_offsets) {
            *offset = offset.lerp(*target, blend);
        }
        Ok(true)
    }
    pub fn finish_camera_transition(&mut self) {
        self.offsets.clone_from(&self.target_offsets);
        if let Some((goal, _, _)) = self.camera_transition.take() {
            self.camera = goal;
        }
    }
}

impl AnatomyViewer {
    fn transition_camera(&mut self, before: Camera, now: Option<f64>) {
        self.camera_transition =
            now.map(|time| (std::mem::replace(&mut self.camera, before), time, time));
    }

    pub(crate) fn refresh_scroll_transition(&mut self) -> Result<(), JsValue> {
        let Some(mut transition) = self.scroll_transition.take() else {
            return Ok(());
        };
        let (target_camera, target_offsets) = self.presentation_target(
            &transition.focus,
            transition.frame,
            transition.yaw,
            transition.spread,
        )?;
        transition.start_camera.aspect = self.camera.aspect;
        transition.target_camera = target_camera;
        transition.target_offsets = target_offsets;
        let (camera_progress, offset_progress) = transition.blend_progress();
        self.camera = transition
            .start_camera
            .interpolate(&transition.target_camera, camera_progress);
        for ((offset, start), target) in self
            .offsets
            .iter_mut()
            .zip(&transition.start_offsets)
            .zip(&transition.target_offsets)
        {
            *offset = start.lerp(*target, offset_progress);
        }
        self.target_offsets.clone_from(&transition.target_offsets);
        self.scroll_transition = Some(transition);
        Ok(())
    }

    fn presentation_target(
        &self,
        focus: &[String],
        frame: [f32; 4],
        yaw: f32,
        spread: bool,
    ) -> Result<(Camera, Vec<glam::Vec3>), JsValue> {
        if frame.iter().any(|value| !value.is_finite())
            || frame[2] <= 0.0
            || frame[3] <= 0.0
            || frame[2] + frame[0] > 1.000001
            || frame[3] + frame[1] > 1.000001
        {
            return Err(js_error("Invalid focus viewport"));
        }
        let focus_bounds = self
            .scene
            .bounds_for(focus)
            .map_err(js_error)?
            .ok_or_else(|| js_error("Empty presentation region"))?;
        let (offsets, bounds) = if spread {
            self.scene
                .inventory_layout(self.camera.aspect * frame[2] / frame[3])
                .map_err(js_error)?
        } else {
            (vec![glam::Vec3::ZERO; self.scene.parts.len()], focus_bounds)
        };
        let mut camera = Camera::layout(bounds, self.camera.aspect, frame).map_err(js_error)?;
        camera
            .rotate_around(bounds.center(), yaw, 0.0)
            .map_err(js_error)?;
        Ok((camera, offsets))
    }
}
