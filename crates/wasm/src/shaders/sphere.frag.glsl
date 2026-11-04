#version 300 es
precision highp float;
in vec2 ndc;
uniform mat4 inverse_projection;
uniform vec4 sphere_origin;
uniform float backdrop_opacity;
out vec4 output_color;
void main() {
    vec4 near_point = inverse_projection * vec4(ndc, -1.0, 1.0);
    vec4 far_point = inverse_projection * vec4(ndc, 1.0, 1.0);
    vec3 origin = near_point.xyz / near_point.w;
    vec3 direction = normalize(far_point.xyz / far_point.w - origin);
    vec3 offset = origin - sphere_origin.xyz;
    float b = dot(offset, direction);
    float discriminant = b*b - dot(offset, offset) + sphere_origin.w*sphere_origin.w;
    if (discriminant < 0.0) discard;
    float t = -b + sqrt(discriminant);
    if (t <= 0.0) discard;
    vec3 normal = normalize(origin + direction * t - sphere_origin.xyz);
    float longitude = atan(normal.z, normal.x) / 6.28318530718;
    float latitude = asin(clamp(normal.y, -1.0, 1.0)) / 3.14159265359;
    vec2 cells = vec2(longitude * 64.0, latitude * 32.0);
    // Derive line width from the surface normal to avoid an antimeridian seam in the grid.
    float width = max(length(fwidth(normal)) * 6.0, 0.0001);
    vec2 lines = abs(fract(cells - 0.5) - 0.5) / width;
    float grid = 1.0 - min(min(lines.x, lines.y), 1.0);
    float equator = 1.0 - smoothstep(0.0, width * 0.2618, abs(normal.y));
    float pole_fade = smoothstep(0.0, 0.15, 1.0 - abs(normal.y));
    vec3 color = mix(vec3(0.56, 0.64, 0.58), vec3(0.36, 0.46, 0.40), equator);
    output_color = vec4(color, max(grid * pole_fade * 0.50, equator * 0.65) * backdrop_opacity);
}
