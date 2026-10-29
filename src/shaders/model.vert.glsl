precision highp float;
in vec3 position;
in vec3 normal;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
out vec3 world_position;
out vec3 world_normal;
void main() {
    world_position = (modelMatrix * vec4(position, 1.0)).xyz;
    world_normal = transpose(mat3(viewMatrix)) * normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
