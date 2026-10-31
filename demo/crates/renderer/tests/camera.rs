use glam::Vec3;
use renderer::{Bounds, Camera};

fn bounds() -> Bounds {
    Bounds {
        min: Vec3::new(-0.5, -1.0, -0.2),
        max: Vec3::new(0.5, 1.0, 0.2),
    }
}

#[test]
fn presentation_fits_and_centers_the_region_inside_desktop_and_mobile_frames() {
    for aspect in [0.65, 1.6, 2.0] {
        let frame = [0.08, 0.10, 0.84, 0.78];
        let bounds = bounds();
        let camera = Camera::layout(bounds, aspect, frame).unwrap();
        let center = camera.matrix().project_point3(bounds.center());
        assert!(((center.x + 1.0) * 0.5 - (frame[0] + frame[2] * 0.5)).abs() < 1e-5);
        assert!(((1.0 - center.y) * 0.5 - (frame[1] + frame[3] * 0.5)).abs() < 1e-5);
        for x in [bounds.min.x, bounds.max.x] {
            for y in [bounds.min.y, bounds.max.y] {
                for z in [bounds.min.z, bounds.max.z] {
                    let point = camera.matrix().project_point3(Vec3::new(x, y, z));
                    let u = (point.x + 1.0) * 0.5;
                    let v = (1.0 - point.y) * 0.5;
                    assert!(u >= frame[0] && u <= frame[0] + frame[2]);
                    assert!(v >= frame[1] && v <= frame[1] + frame[3]);
                    assert!(point.z.abs() <= 1.0);
                }
            }
        }
    }
}

#[test]
fn presentation_rejects_invalid_frames_and_rotations_without_changing_the_view() {
    for aspect in [0.0, f32::NAN, f32::INFINITY] {
        assert!(Camera::layout(bounds(), aspect, [0.0, 0.0, 1.0, 1.0]).is_err());
    }
    let mut camera = Camera::layout(bounds(), 1.5, [0.08, 0.10, 0.84, 0.78]).unwrap();
    let before = camera.matrix();
    for frame in [
        [0.0, 0.0, 0.0, 1.0],
        [0.5, 0.0, 1.0, 1.0],
        [f32::NAN, 0.0, 1.0, 1.0],
    ] {
        assert!(camera.reframe(frame).is_err());
        assert_eq!(camera.matrix(), before);
    }
    for (pivot, yaw, pitch) in [
        (Vec3::NAN, 0.0, 0.0),
        (Vec3::ZERO, f32::INFINITY, 0.0),
        (Vec3::ZERO, 0.0, f32::NAN),
    ] {
        assert!(camera.rotate_around(pivot, yaw, pitch).is_err());
        assert_eq!(camera.matrix(), before);
    }
}

#[test]
fn scene_rotation_and_interpolation_end_at_the_requested_camera() {
    let region = bounds();
    let mut goal = Camera::layout(region, 1.5, [0.08, 0.10, 0.84, 0.78]).unwrap();
    goal.rotate_around(region.center(), std::f32::consts::PI, 0.0)
        .unwrap();
    assert!(goal.light_basis().z_axis.z < -0.99);
    let mut camera = Camera::new(region);
    let before = camera.matrix();
    assert!(camera.approach(&goal, 0.2));
    assert_ne!(camera.matrix(), before);
    for _ in 0..100 {
        if !camera.approach(&goal, 0.5) {
            break;
        }
    }
    assert_eq!(camera.matrix(), goal.matrix());
    assert!(camera.eye().distance(region.center()) < camera.enclosure_radius());
}
