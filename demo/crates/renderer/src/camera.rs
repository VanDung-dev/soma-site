use crate::Bounds;
use glam::{Mat3, Mat4, Vec3};

#[derive(Clone)]
pub struct Camera {
    pub target: Vec3,
    pub yaw: f32,
    pub pitch: f32,
    pub distance: f32,
    pub aspect: f32,
    radius: f32,
    center: Vec3,
    view: Bounds,
    frame: Option<[f32; 4]>,
    composition: Vec3,
}

impl Camera {
    pub fn new(bounds: Bounds) -> Self {
        let mut camera = Self {
            target: bounds.center(),
            yaw: 0.0,
            pitch: 0.0,
            distance: 1.0,
            aspect: 1.0,
            radius: bounds.radius(),
            center: bounds.center(),
            view: bounds,
            frame: None,
            composition: Vec3::new(0.0, 0.04, 0.0),
        };
        camera.fit(bounds);
        camera
    }
    pub fn fit(&mut self, bounds: Bounds) {
        self.view = bounds;
        self.target = bounds.center();
        self.yaw = -0.32;
        self.pitch = 0.12;
        let fov = 38_f32.to_radians();
        let [_, _, width, height] = self.frame.unwrap_or([0.0, 0.0, 1.0, 1.0]);
        let limiting = (2.0 * ((fov * 0.5).tan() * height).atan())
            .min(2.0 * ((fov * 0.5).tan() * self.aspect * width).atan());
        let initial_fov = fov.min(2.0 * ((fov * 0.5).tan() * self.aspect).atan());
        let initial_distance = self.radius / (initial_fov * 0.5).sin() * 1.12;
        // Focus can enlarge a part, but must not shrink it below the startup scale.
        self.distance = (bounds.radius().max(self.radius * 1e-6) / (limiting * 0.5).sin() * 1.12)
            .min(initial_distance)
            .min(self.enclosure_radius() * 0.9);
        self.constrain_eye();
    }
    pub fn focus(&mut self, bounds: Bounds, frame: [f32; 4]) -> Result<(), String> {
        self.reframe(frame)?;
        self.fit(bounds);
        Ok(())
    }
    pub fn reframe(&mut self, frame: [f32; 4]) -> Result<(), String> {
        let [left, top, width, height] = frame;
        if frame.iter().any(|v| !v.is_finite())
            || left < 0.0
            || top < 0.0
            || width <= 0.0
            || height <= 0.0
            || left + width > 1.000001
            || top + height > 1.000001
        {
            return Err("Invalid focus viewport".into());
        }
        // Full-viewport framing uses the same centered composition as startup.
        self.frame = (frame != [0.0, 0.0, 1.0, 1.0]).then_some(frame);
        Ok(())
    }
    pub fn layout(bounds: Bounds, aspect: f32, frame: [f32; 4]) -> Result<Self, String> {
        if !aspect.is_finite() || aspect <= 0.0 {
            return Err("Invalid layout aspect ratio".into());
        }
        let mut camera = Self::new(bounds);
        camera.aspect = aspect;
        camera.focus(bounds, frame)?;
        let fov = 38_f32.to_radians();
        let half_size = (bounds.max - bounds.min) * 0.5;
        let distance = (half_size.x / ((fov * 0.5).tan() * aspect * frame[2]))
            .max(half_size.y / ((fov * 0.5).tan() * frame[3]));
        camera.distance = half_size.z + distance * 1.12;
        camera.radius = camera.radius.max(camera.distance / 4.0);
        camera.yaw = 0.0;
        camera.pitch = 0.0;
        camera.composition = Vec3::new(
            2.0 * (frame[0] + frame[2] * 0.5) - 1.0,
            1.0 - 2.0 * (frame[1] + frame[3] * 0.5),
            0.0,
        );
        Ok(camera)
    }
    pub fn approach(&mut self, goal: &Self, blend: f32) -> bool {
        self.target = self.target.lerp(goal.target, blend);
        self.distance += (goal.distance - self.distance) * blend;
        let yaw = (goal.yaw - self.yaw + std::f32::consts::PI).rem_euclid(std::f32::consts::TAU)
            - std::f32::consts::PI;
        self.yaw += yaw * blend;
        self.pitch += (goal.pitch - self.pitch) * blend;
        self.radius += (goal.radius - self.radius) * blend;
        self.center = self.center.lerp(goal.center, blend);
        self.composition = self.composition.lerp(goal.composition, blend);
        self.view = goal.view;
        self.frame = goal.frame;
        let tolerance = goal.radius * 1e-5;
        let moving = self.target.distance(goal.target) > tolerance
            || (self.distance - goal.distance).abs() > tolerance
            || yaw.abs() > 1e-5
            || (self.pitch - goal.pitch).abs() > 1e-5;
        let moving = moving || self.composition.distance(goal.composition) > 1e-5;
        if !moving {
            *self = goal.clone();
        }
        moving
    }

    pub fn interpolate(&self, goal: &Self, progress: f32) -> Self {
        let frame_value = |frame: Option<[f32; 4]>| frame.unwrap_or([0.0, 0.0, 1.0, 1.0]);
        let from_frame = frame_value(self.frame);
        let to_frame = frame_value(goal.frame);
        let yaw = (goal.yaw - self.yaw + std::f32::consts::PI).rem_euclid(std::f32::consts::TAU)
            - std::f32::consts::PI;
        Self {
            target: self.target.lerp(goal.target, progress),
            yaw: self.yaw + yaw * progress,
            pitch: self.pitch + (goal.pitch - self.pitch) * progress,
            distance: self.distance + (goal.distance - self.distance) * progress,
            aspect: self.aspect + (goal.aspect - self.aspect) * progress,
            radius: self.radius + (goal.radius - self.radius) * progress,
            center: self.center.lerp(goal.center, progress),
            view: Bounds {
                min: self.view.min.lerp(goal.view.min, progress),
                max: self.view.max.lerp(goal.view.max, progress),
            },
            frame: (self.frame.is_some() || goal.frame.is_some()).then(|| {
                std::array::from_fn(|index| {
                    from_frame[index] + (to_frame[index] - from_frame[index]) * progress
                })
            }),
            composition: self.composition.lerp(goal.composition, progress),
        }
    }

    pub fn reset(&mut self) {
        self.fit(self.view);
    }

    pub fn rotate_around(&mut self, pivot: Vec3, yaw: f32, pitch: f32) -> Result<(), String> {
        if !pivot.is_finite() || !yaw.is_finite() || !pitch.is_finite() {
            return Err("Invalid camera rotation".into());
        }
        self.orient_around(
            pivot,
            self.yaw + yaw,
            (self.pitch + pitch).clamp(-1.55, 1.55),
        )
    }
    pub fn orient_around(&mut self, pivot: Vec3, yaw: f32, pitch: f32) -> Result<(), String> {
        if !pivot.is_finite()
            || !yaw.is_finite()
            || !pitch.is_finite()
            || pitch.abs() > std::f32::consts::FRAC_PI_2
        {
            return Err("Invalid camera orientation".into());
        }
        let offset = self.light_basis().transpose() * (self.target - pivot);
        self.yaw = yaw.rem_euclid(std::f32::consts::TAU);
        self.pitch = pitch;
        self.target = pivot + self.light_basis() * offset;
        self.constrain_orbit(pivot);
        Ok(())
    }

    pub fn enclosure_radius(&self) -> f32 {
        self.radius * 6.0
    }
    fn constrain_eye(&mut self) {
        self.constrain_orbit(self.target);
    }
    fn constrain_orbit(&mut self, pivot: Vec3) {
        let limit = self.enclosure_radius() * 0.9;
        let offset = self.eye() - pivot;
        let distance = offset.length();
        if limit > 0.0 && distance > 0.0 {
            let relative = (pivot - self.center) / limit;
            let along = relative.dot(offset / distance);
            let half = (along * along + 1.0 - relative.length_squared())
                .max(0.0)
                .sqrt();
            let minimum = (-half - along).max(0.0) * limit;
            let maximum = (half - along) * limit;
            if maximum > 0.0 && (distance < minimum || distance > maximum) {
                let scale = distance.clamp(minimum, maximum) / distance;
                self.target = pivot + (self.target - pivot) * scale;
                self.distance *= scale;
            }
        }
    }
    pub fn eye(&self) -> Vec3 {
        self.target + self.orbit_offset()
    }
    pub fn light_basis(&self) -> Mat3 {
        Mat3::from_rotation_y(self.yaw) * Mat3::from_rotation_x(-self.pitch)
    }
    fn orbit_offset(&self) -> Vec3 {
        Vec3::new(
            self.yaw.sin() * self.pitch.cos(),
            self.pitch.sin(),
            self.yaw.cos() * self.pitch.cos(),
        ) * self.distance
    }
    pub fn matrix(&self) -> Mat4 {
        // Anatomy retains startup framing; inventory uses the available viewport.
        Mat4::from_translation(self.composition)
            * glam::camera::rh::proj::opengl::perspective(
                38_f32.to_radians(),
                self.aspect,
                (self.view.radius() / 100.0).max(1e-6),
                self.radius * 100.0,
            )
            * glam::camera::rh::view::look_at_mat4(
                self.eye(),
                self.target,
                self.light_basis().y_axis,
            )
    }
}
