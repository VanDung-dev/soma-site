#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
uniform mat4 view_projection;
uniform vec3 part_offset;
out vec3 world_position;
out vec3 world_normal;
void main() {
    world_position = position + part_offset; world_normal = normal;
    gl_Position = view_projection * vec4(world_position, 1.0);
}
