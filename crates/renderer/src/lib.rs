use glam::{Mat4, Vec3};

const POSES: [[f64; 5]; 8] = [
    [1.59, 0.26, -1.57, 0.0, -0.18],
    [0.87, 2.109, 0.0, 0.0, -0.12],
    [1.59, 0.26, 0.0, 0.0, 0.0],
    [1.19, 0.898, 0.22, 0.0, 0.0],
    [1.25, 0.485, 0.0, 0.0, 0.0],
    [1.06, 0.903, 0.0, 0.0, 0.0],
    [0.51, 1.246, 0.0, 0.0, 0.0],
    [1.59, 0.26, 1.57, 0.0, 0.22],
];

const FOCUS_GROUPS: [Option<usize>; 8] = [None, None, Some(1), Some(2), Some(0), Some(3), Some(4), None];

fn emphasis(chapter: usize, group: usize) -> f64 {
    if FOCUS_GROUPS[chapter].is_none_or(|focused| focused == group) { 1.0 } else { 0.03 }
}

#[derive(Default)]
pub struct ScrollCamera {
    progress: Option<f64>,
}

impl ScrollCamera {
    pub fn frame(&mut self, target: f64, reduced_motion: bool, aspect: f64) -> [f64; 16] {
        let last = (POSES.len() - 1) as f64;
        let target = if target.is_finite() {
            target.clamp(0.0, last)
        } else {
            0.0
        };
        let progress = match self.progress {
            Some(current) if !reduced_motion => current + (target - current) * 0.14,
            _ => target,
        };
        let progress = if (target - progress).abs() < 0.0005 {
            target
        } else {
            progress
        };
        self.progress = Some(progress);
        let index = (progress.floor() as usize).min(POSES.len() - 2);
        let t = progress - index as f64;
        let blend = if reduced_motion {
            if t < 0.5 { 0.0 } else { 1.0 }
        } else {
            t * t * (3.0 - 2.0 * t)
        };
        let from = POSES[index];
        let to = POSES[index + 1];
        let y = from[0] + (to[0] - from[0]) * blend;
        let aspect = if aspect.is_finite() && aspect > 0.0 {
            aspect
        } else {
            1.0
        };
        let span = (from[1] + (to[1] - from[1]) * blend) * (0.72 / aspect).max(1.0);
        let yaw = from[2] + (to[2] - from[2]) * blend;
        let mut frame = [0.0; 16];
        frame[..10].copy_from_slice(&[
            y,
            -span * aspect / 2.0,
            span * aspect / 2.0,
            span / 2.0,
            -span / 2.0,
            yaw,
            progress.round(),
            f64::from(progress == target),
            from[3] + (to[3] - from[3]) * blend,
            from[4] + (to[4] - from[4]) * blend,
        ]);
        for group in 0..6 {
            let from = emphasis(index, group);
            let to = emphasis(index + 1, group);
            frame[10 + group] = if emphasis(target.round() as usize, group) == 1.0 {
                1.0
            } else {
                from + (to - from) * blend
            };
        }
        frame
    }
}

pub fn grid_projection(radius: f32, aspect: f32, x: f32, y: f32, span: f32, yaw: f32, pitch: f32) -> [f32; 16] {
    let target = Vec3::new(x, y, 0.0);
    let fov = 38_f32.to_radians();
    let distance = (span / (2.0 * (fov * 0.5).tan())).min(radius * 6.0 * 0.9);
    let yaw = -yaw;
    let eye = target + Vec3::new(yaw.sin() * pitch.cos(), pitch.sin(), yaw.cos() * pitch.cos()) * distance;
    let matrix = Mat4::from_translation(Vec3::new(0.0, 0.04, 0.0))
        * glam::camera::rh::proj::opengl::perspective(
            fov,
            aspect,
            (radius / 100.0).max(1e-6),
            radius * 100.0,
        )
        * glam::camera::rh::view::look_at_mat4(eye, target, Vec3::Y);
    matrix.inverse().to_cols_array()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn camera_visits_all_poses() {
        for (index, pose) in POSES.iter().enumerate() {
            let frame = ScrollCamera::default().frame(index as f64, false, 1.0);
            assert_eq!(frame[0], pose[0]);
            assert!((frame[3] * 2.0 - pose[1]).abs() < 1e-12);
            assert!((frame[5] - pose[2]).abs() < 1e-12);
            assert_eq!(&frame[8..10], &pose[3..5]);
            assert_eq!(frame[6], index as f64);
            assert_eq!(frame[7], 1.0);
        }
    }

    #[test]
    fn midpoint_interpolation_matches_timeline() {
        for index in 0..POSES.len() - 1 {
            let frame = ScrollCamera::default().frame(index as f64 + 0.5, false, 1.0);
            assert!((frame[0] - (POSES[index][0] + POSES[index + 1][0]) / 2.0).abs() < 1e-12);
            assert!((frame[3] * 2.0 - (POSES[index][1] + POSES[index + 1][1]) / 2.0).abs() < 1e-12);
        }
    }

    #[test]
    fn motion_settles_in_both_scroll_directions() {
        let mut camera = ScrollCamera::default();
        for target in [0.0, 7.0, 0.0] {
            let mut frame = camera.frame(target, false, 1.0);
            for _ in 0..100 {
                frame = camera.frame(target, false, 1.0);
            }
            assert_eq!(frame[6], target);
            assert_eq!(frame[7], 1.0);
        }
    }

    #[test]
    fn reduced_motion_uses_still_poses_without_damping() {
        let mut camera = ScrollCamera::default();
        assert_eq!(camera.frame(0.25, true, 1.0)[5], POSES[0][2]);
        assert_eq!(camera.frame(0.75, true, 1.0)[5], POSES[1][2]);
        assert!((camera.frame(6.6, true, 1.0)[3] * 2.0 - POSES[7][1]).abs() < 1e-12);
    }

    #[test]
    fn narrow_viewports_keep_the_same_horizontal_fit() {
        let wide = ScrollCamera::default().frame(0.0, false, 0.72);
        let narrow = ScrollCamera::default().frame(0.0, false, 0.36);
        assert_eq!(wide[1], narrow[1]);
        assert_eq!(wide[2], narrow[2]);
        assert_eq!(wide[3] * 2.0, narrow[3]);
    }

    #[test]
    fn clamps_overscroll_and_handles_nonfinite_input() {
        assert_eq!(
            ScrollCamera::default().frame(-1.0, false, 1.0),
            ScrollCamera::default().frame(0.0, false, 1.0)
        );
        assert_eq!(
            ScrollCamera::default().frame(10.0, false, 1.0),
            ScrollCamera::default().frame(7.0, false, 1.0)
        );
        assert!(
            ScrollCamera::default()
                .frame(f64::NAN, false, 0.0)
                .iter()
                .all(|value| value.is_finite())
        );
    }

    #[test]
    fn focus_keeps_context_visible_and_visits_head_spine_thorax_upper_lower() {
        for (chapter, focused) in [(2, 1), (3, 2), (4, 0), (5, 3), (6, 4)] {
            let frame = ScrollCamera::default().frame(chapter as f64, true, 1.0);
            assert!(frame[3] * 2.0 < POSES[1][1]);
            for group in 0..6 {
                assert_eq!(frame[10 + group], if group == focused { 1.0 } else { 0.03 });
            }
        }
        for chapter in [0.0, 1.0, 7.0] {
            assert_eq!(&ScrollCamera::default().frame(chapter, false, 1.0)[10..], &[1.0; 6]);
        }
        for progress in [2.1, 2.5, 3.5, 5.5, 6.9] {
            assert!(ScrollCamera::default().frame(progress, false, 1.0)[10..].iter().all(|alpha| *alpha >= 0.03 && *alpha <= 1.0));
        }
    }

    #[test]
    fn described_group_stays_opaque_during_forward_and_reverse_zoom() {
        let mut camera = ScrollCamera::default();
        camera.frame(0.0, false, 1.0);
        for chapter in [2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 7] {
            for _ in 0..80 {
                let frame = camera.frame(chapter as f64, false, 1.0);
                for group in 0..6 {
                    if emphasis(chapter, group) == 1.0 {
                        assert_eq!(frame[10 + group], 1.0, "chapter {chapter}, group {group}");
                    }
                }
            }
        }
    }

    #[test]
    fn grid_uses_camera_focus_and_aspect() {
        for aspect in [0.4, 1.0, 2.0] {
            let center = [0.0, 0.87, 0.0];
            let inverse =
                Mat4::from_cols_array(&grid_projection(1.0, aspect, 0.0, center[1], 1.98, 0.32, 0.0));
            assert!(inverse.is_finite());
            let projected = inverse.inverse().project_point3(Vec3::from_array(center));
            assert!(projected.x.abs() < 1e-4);
            assert!((projected.y - 0.04).abs() < 1e-4);
        }
        assert_ne!(
            grid_projection(1.0, 1.0, 0.0, 0.87, 1.98, 0.32, 0.0),
            grid_projection(1.0, 2.0, 0.0, 0.87, 1.98, 0.32, 0.0)
        );
    }

    #[test]
    fn grid_follows_camera_zoom_rotation_and_focus() {
        let initial = grid_projection(1.0, 1.5, 0.0, 1.62, 0.35, 0.34, 0.0);
        assert_ne!(initial, grid_projection(1.0, 1.5, 0.0, 1.62, 0.84, 0.34, 0.0));
        assert_ne!(initial, grid_projection(1.0, 1.5, 0.0, 1.62, 0.35, 2.65, 0.0));
        assert_ne!(initial, grid_projection(1.0, 1.5, 0.0, 1.27, 0.35, 0.34, 0.0));
        assert_ne!(initial, grid_projection(1.0, 1.5, 0.0, 1.62, 0.35, 0.34, 1.35));
        assert!(initial.iter().all(|value| value.is_finite()));
    }
}
