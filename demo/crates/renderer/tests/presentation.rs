use glam::Vec3;
use renderer::{Bounds, Primitive, Reconstruction, Scene};

fn scene() -> Scene {
    let bounds = Bounds {
        min: Vec3::ZERO,
        max: Vec3::ONE,
    };
    let part = |id: &str| -> Primitive {
        serde_json::from_value(serde_json::json!({
            "source_id": id, "bounds": {"min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 1.0]},
            "color": [0.5, 0.5, 0.5, 1.0], "roughness": 0.6, "metallic": 0.0,
            "specular": 0.04, "subsurface": 0.0, "double_sided": false, "blend": false,
            "alpha_cutoff": 0.0, "active": true, "visible": true
        }))
        .unwrap()
    };
    Scene {
        parts: vec![part("a"), part("a"), part("b")],
        bounds,
    }
}

#[test]
fn presentation_visibility_keeps_all_source_primitives_and_rejects_invalid_ids_atomically() {
    let mut scene = scene();
    scene.set_visibility(&["a".into()]).unwrap();
    assert_eq!(
        scene
            .parts
            .iter()
            .map(|part| part.visible)
            .collect::<Vec<_>>(),
        [true, true, false]
    );
    for ids in [vec!["unknown".into()], vec!["a".into(), "a".into()]] {
        assert!(scene.set_visibility(&ids).is_err());
        assert!(scene.bounds_for(&ids).is_err());
        assert_eq!(
            scene
                .parts
                .iter()
                .map(|part| part.visible)
                .collect::<Vec<_>>(),
            [true, true, false]
        );
    }
    assert_eq!(scene.parts.len(), 3);
    assert_eq!(
        scene.bounds_for(&["a".into()]).unwrap().unwrap().center(),
        Vec3::splat(0.5)
    );
}

#[test]
fn reconstruction_finishes_for_reduced_motion_and_rejects_time_reversal() {
    let scene = scene();
    let mut reconstruction = Reconstruction::default();
    reconstruction
        .append(&scene.parts, scene.bounds, 0.0, true)
        .unwrap();
    assert!(reconstruction.advance(100.0).unwrap());
    assert!(reconstruction.opacity(0) < 1.0);
    assert!(reconstruction.advance(99.0).is_err());
    assert!(reconstruction.advance(f64::NAN).is_err());
    reconstruction.finish();
    assert!(!reconstruction.advance(101.0).unwrap());
    for i in 0..scene.parts.len() {
        assert_eq!(reconstruction.opacity(i), 1.0);
    }
}

#[test]
fn inventory_keeps_source_parts_together_and_separates_structures_without_mutation() {
    let mut scene = scene();
    scene.parts[2].bounds.min = Vec3::new(2.0, 0.0, 0.0);
    scene.parts[2].bounds.max = Vec3::new(2.5, 0.5, 0.5);
    for aspect in [0.5, 1.5, 2.0] {
        let (offsets, bounds) = scene.inventory_layout(aspect).unwrap();
        assert_eq!(offsets.len(), 3);
        assert_eq!(offsets[0], offsets[1]);
        let a = scene.parts[0].bounds;
        let b = scene.parts[2].bounds;
        let a_min = a.min + offsets[0];
        let a_max = a.max + offsets[0];
        let b_min = b.min + offsets[2];
        let b_max = b.max + offsets[2];
        assert!(a_max.x < b_min.x || b_max.x < a_min.x || a_max.y < b_min.y || b_max.y < a_min.y);
        for (part, offset) in scene.parts.iter().zip(&offsets) {
            assert!((part.bounds.min + *offset).cmpge(bounds.min).all());
            assert!((part.bounds.max + *offset).cmple(bounds.max).all());
        }
    }
    assert_eq!(scene.parts[2].bounds.min.x, 2.0);
    for aspect in [0.0, -1.0, f32::NAN, f32::INFINITY] {
        assert!(scene.inventory_layout(aspect).is_err());
    }
    scene.set_visibility(&[]).unwrap();
    assert!(scene.inventory_layout(1.5).is_err());
}
