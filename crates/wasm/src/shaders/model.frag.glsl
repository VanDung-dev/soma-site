#version 300 es
precision highp float;
in vec3 world_position;
in vec3 world_normal;
uniform vec3 eye;
uniform mat3 light_basis;
uniform vec4 base_color;
uniform float roughness;
uniform float metallic;
uniform float specular;
uniform float subsurface;
uniform float alpha_cutoff;
uniform bool selected;
uniform bool picking;
uniform vec3 pick_color;
uniform float reveal;
uniform bool shadow_pass;
uniform mat4 shadow_projection;
uniform sampler2D shadow_map;
uniform vec2 shadow_texel;
uniform float shadow_offset;
uniform int shadow_quality;
uniform int lighting_quality;
out vec4 output_color;
vec3 filmic(vec3 c) {
    // shortcut: fit of Blender's neutral Filmic sRGB curve; use the full OCIO transform for gamut/desaturation parity.
    vec3 t = clamp((log2(max(c, vec3(1e-8))) + 12.473931188) / 16.5, 0.0, 1.0);
    return clamp((((((((-102.04061665 * t + 408.97662030) * t - 642.50026899) * t + 499.88273434) * t
        - 205.19915519) * t + 46.48331889) * t - 4.88997052) * t + 0.28946802) * t - 0.00255819, 0.0, 1.0);
}
vec3 sunlight(vec3 n, vec3 v, vec3 l, vec3 radiance, bool detailed) {
    float nl = max(dot(n, l), 0.0), nv = max(dot(n, v), 0.0001);
    vec3 f0 = mix(vec3(specular), base_color.rgb, metallic);
    float scatter = mix(nl, max((dot(n, l) + 0.5) / 1.5, 0.0), subsurface * 0.5);
    if (!detailed) return (1.0-f0) * (1.0-metallic) * base_color.rgb / 3.14159265 * scatter * radiance;
    vec3 h = normalize(v + l);
    float nh = max(dot(n, h), 0.0), vh = max(dot(v, h), 0.0);
    float a = max(roughness * roughness, 0.0025), a2 = a * a;
    float d = a2 / max(3.14159265 * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0), 0.000001);
    float k = pow(roughness + 1.0, 2.0) / 8.0;
    float g = nv / (nv * (1.0-k) + k) * nl / max(nl * (1.0-k) + k, 0.0001);
    vec3 f = f0 + (1.0-f0) * pow(1.0-vh, 5.0);
    vec3 diffuse = (1.0-f) * (1.0-metallic) * base_color.rgb / 3.14159265;
    vec3 reflection = d * g * f / max(4.0 * nv * nl, 0.0001);
    // shortcut: wrapped diffuse approximates source subsurface weight; thickness-aware scattering needs a separate pass.
    return (diffuse * scatter + reflection * nl) * radiance;
}
float sunlight_visibility(vec3 n, vec3 light) {
    if (shadow_quality == 0) return 1.0;
    vec4 surface = shadow_projection * vec4(world_position, 1.0);
    vec3 receiver = surface.xyz / surface.w * 0.5 + 0.5;
    vec3 dx = dFdx(receiver), dy = dFdy(receiver);
    float determinant = dx.x * dy.y - dx.y * dy.x;
    vec2 depth_gradient = vec2(0.0);
    if (abs(determinant) > 1e-10) {
        depth_gradient = vec2(dy.y * dx.z - dx.y * dy.z,
            dx.x * dy.z - dy.x * dx.z) / determinant;
    }
    // Offset scales with the fitted frustum so close-ups keep the same relative acne guard.
    vec4 position = shadow_projection * vec4(world_position + n * shadow_offset, 1.0);
    if (position.w == 0.0) return 1.0;
    vec3 uv = position.xyz / position.w * 0.5 + 0.5;
    if (any(lessThan(uv, vec3(0.0))) || any(greaterThan(uv, vec3(1.0)))) return 1.0;
    float bias = abs(determinant) > 1e-10 ? 0.00002
        : max(0.0005, 2.0 * max(shadow_texel.x, shadow_texel.y) * (1.0 - dot(n, light)));
    // Compare at each texel's receiver depth; one shared depth makes sloped surfaces shadow themselves.
    vec2 origin = floor(uv.xy / shadow_texel - 0.5) + 0.5;
    float visible = 0.0;
    float total = 0.0;
    int first = shadow_quality == 1 ? 0 : -1;
    int last = shadow_quality == 1 ? 1 : 2;
    float radius = shadow_quality == 1 ? 1.0 : 2.0;
    for (int y = first; y <= last; y++) for (int x = first; x <= last; x++) {
        vec2 sample_uv = (origin + vec2(x, y)) * shadow_texel;
        vec2 delta = sample_uv - uv.xy;
        // Continuous tent weights avoid jumps when the lookup crosses a texel boundary.
        vec2 tent = max(vec2(0.0), radius - abs(delta / shadow_texel));
        float weight = tent.x * tent.y;
        sample_uv = clamp(sample_uv, shadow_texel * 0.5, 1.0 - shadow_texel * 0.5);
        vec3 encoded_depth = texture(shadow_map, sample_uv).rgb;
        float depth = dot(encoded_depth, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
        float receiver_depth = uv.z + dot(depth_gradient, sample_uv - uv.xy);
        visible += step(receiver_depth - bias, depth) * weight;
        total += weight;
    }
    return visible / total;
}
void main() {
    // Ordered dithering fades opaque geometry without changing depth or material blending.
    if (reveal < 1.0) {
        const float threshold[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
        ivec2 pixel = ivec2(gl_FragCoord.xy) % 4;
        if (reveal <= (threshold[pixel.y * 4 + pixel.x] + 0.5) / 16.0) discard;
    }
    if (base_color.a <= 0.0 || base_color.a < alpha_cutoff) discard;
    if (shadow_pass) {
        vec3 encoded_depth = fract(min(gl_FragCoord.z, 0.999999) * vec3(1.0, 255.0, 65025.0));
        encoded_depth -= encoded_depth.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
        output_color = vec4(encoded_depth, 1.0); return;
    }
    if (picking) { output_color = vec4(pick_color, 1.0); return; }
    vec3 n = normalize(world_normal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 v = normalize(eye - world_position);
    // Keep Startup.blend's light colors/energies with the rig oriented to the camera.
    vec3 key_light = light_basis * normalize(vec3(0.707107, 0.500000, 0.500000));
    vec3 color = sunlight(n, v, key_light, 5.0 * vec3(1.0, 0.970922, 0.587642), lighting_quality > 0) * sunlight_visibility(n, key_light);
    if (lighting_quality > 0) color += sunlight(n, v, light_basis * normalize(vec3(-0.591979, -0.361874, -0.720144)), 3.0 * vec3(1.0, 0.634049, 0.341307), lighting_quality > 1);
    if (lighting_quality > 1) color += sunlight(n, v, light_basis * normalize(vec3(-0.241563, -0.850124, 0.467906)), 0.5 * vec3(0.726669, 0.377571, 1.0), true);
    float sky = dot(n, light_basis[1]) * 0.5 + 0.5;
    color += base_color.rgb * (1.0-metallic) * mix(vec3(0.06, 0.05, 0.04), vec3(0.16, 0.18, 0.21), sky);
    if (selected) color += vec3(0.093, 0.045, 0.007);
    color += (1.0 - reveal) * vec3(0.12, 0.20, 0.16);
    output_color = vec4(filmic(max(color, vec3(0.0))), base_color.a);
}
