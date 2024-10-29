import * as THREE from 'three';

export default function SphereMat(){
    const mat = new THREE.RawShaderMaterial( {
        depthTest       : true,
        // transparent 	: true, 
        // side         : THREE.DoubleSide,
        // lights       : true,

        uniforms        : {
            // tex01 : { type :'sampler2D', value: tex01 },
        },

        extensions      : {
            derivatives : true
        },

        vertexShader    : `#version 300 es
        in	vec3    position;
        in  vec3    normal;
        in	vec2    uv;
        
        uniform     mat4    modelMatrix;
        uniform     mat4    viewMatrix;
        uniform     mat4    projectionMatrix;

        out vec3    fragWPos;  // World Space Position
        out vec3    fragLPos;  // World Space Position
        out vec3    fragNorm;
        out vec2    fragUV;
        
        void main(){
            vec4 wPos 	        = modelMatrix * vec4( position, 1.0 );  // World Space
            vec4 vPos           = viewMatrix * wPos;                    // View Space
            
            fragUV              = uv;
            fragWPos            = wPos.xyz;
            fragLPos            = position.xyz;
            fragNorm            = ( modelMatrix * vec4( normal, 0.0 ) ).xyz;

            gl_Position			= projectionMatrix * vPos;
        }`,

        fragmentShader  : `#version 300 es
        precision mediump float;
        
        uniform vec3 cameraPosition;

        in  vec3    fragWPos;
        in  vec3    fragLPos;
        in  vec3    fragNorm;
        in  vec2    fragUV;

        out vec4    outColor;

        // #####################################################################

        // #####################################################################

        const int LITE_CNT = 1;

        void main(){
            vec3 color = vec3( 0.8 );
            outColor = vec4( color, 1.0 );
            
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // Lighting
            vec3 LP   = vec3( 3.0, 3.0, 3.0 );      // Light Position
            vec3 L    = normalize( LP - fragWPos ); // Light Direction
            vec3 N    = normalize( fragNorm );      // Sphere point direction

            // float NdL = max( dot( N, L ), 0.0 );    // Lambertian
            
            float NdL = dot( N, L ) * 0.5 + 0.5;    // Half Lambert
            // NdL = NdL * NdL;                        // Curve the value a bit for better shadows

            // outColor = vec4( vec3( NdL ), 1.0 );

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            float mask      = smoothstep( 0.08, 0.09, abs( fragLPos.z ) );
            vec3  yColor    = ( fragLPos.y >= 0.0 )? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 1.0, 0.0 );
            
            // outColor.rgb    = vec3( mask );
            // outColor.rgb = color * mask * NdL;

            outColor.rgb = mix( yColor, color * NdL, mask );
        }`
    } );

    // Object.defineProperty( mat, 'baseColor', { 
    //     set: ( v )=>{ mat.uniforms.baseColor.value.set( v ); } 
    // });

    // Object.defineProperty( mat, 'scalar', {
    //     set: ( v )=>{ mat.uniforms.scalar.value = v; }
    // } );

    return mat;
}