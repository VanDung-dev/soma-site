use std::borrow::Cow;
use std::io::Read;

const DECOMPRESS_LIMIT: u64 = 128 * 1024 * 1024;

pub fn decode(bytes: &[u8]) -> Result<Cow<'_, [u8]>, String> {
    if bytes.starts_with(b"glTF") {
        return Ok(Cow::Borrowed(bytes));
    }
    let mut decoded = Vec::new();
    brotli_decompressor::Decompressor::new(bytes, 4096)
        .take(DECOMPRESS_LIMIT + 1)
        .read_to_end(&mut decoded)
        .map_err(|e| format!("Invalid Brotli model: {e}"))?;
    if decoded.len() as u64 > DECOMPRESS_LIMIT {
        return Err("Decompressed model exceeds 128 MiB".into());
    }
    Ok(Cow::Owned(decoded))
}

pub fn validate(gltf: &gltf::Gltf, blob: &[u8]) -> Result<(), String> {
    if gltf
        .buffers()
        .any(|b| !matches!(b.source(), gltf::buffer::Source::Bin) || b.length() > blob.len())
        || gltf.textures().next().is_some()
        || gltf.animations().next().is_some()
        || gltf.skins().next().is_some()
        || gltf.extensions_required().next().is_some()
    {
        return Err("Unsupported GLB: external buffers, textures, skins, animation or required extensions".into());
    }
    for view in gltf.views() {
        if view
            .offset()
            .checked_add(view.length())
            .is_none_or(|end| end > view.buffer().length())
        {
            return Err("Buffer view exceeds binary buffer".into());
        }
    }
    for accessor in gltf.accessors() {
        let view = accessor.view().ok_or("Accessor has no buffer view")?;
        let stride = view.stride().unwrap_or(accessor.size());
        let end = accessor
            .count()
            .saturating_sub(1)
            .checked_mul(stride)
            .and_then(|offset| offset.checked_add(accessor.offset()))
            .and_then(|offset| offset.checked_add(accessor.size()));
        if accessor.sparse().is_some()
            || accessor.count() == 0
            || stride < accessor.size()
            || end.is_none_or(|end| end > view.length())
        {
            return Err("Invalid or unsupported accessor bounds".into());
        }
    }
    Ok(())
}
