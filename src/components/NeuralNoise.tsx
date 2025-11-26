"use client";

import { useEffect, useRef } from "react";

// Vertex shader - positions the fullscreen quad
const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 vUv;

void main() {
    vUv = 0.5 * (a_position + 1.0);
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment shader - renders the neural noise effect
const fragmentShaderSource = `
precision mediump float;

varying vec2 vUv;

uniform float u_time;
uniform float u_ratio;
uniform vec2 u_pointer_position;
uniform float u_pointer_strength;
uniform float u_intensity;
uniform float u_detail;
uniform vec3 u_color_a;
uniform vec3 u_color_b;

// Rotate UV coordinates by angle
vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

// Generate the neural-like noise pattern
float neuro_shape(vec2 uv, float t, float pointerInfluence, float detailFactor) {
    vec2 sine_acc = vec2(0.0);
    vec2 res = vec2(0.0);
    float scale = mix(5.5, 9.5, detailFactor);

    // Layer accumulation to create complex patterns
    for (int j = 0; j < 15; j++) {
        uv = rotate(uv, 1.0);
        sine_acc = rotate(sine_acc, 1.0);
        vec2 layer = uv * scale + float(j) + sine_acc - t;
        sine_acc += sin(layer) + 2.4 * pointerInfluence;
        res += (0.5 + 0.5 * cos(layer)) / scale;
        scale *= 1.18;
    }
    return res.x + res.y;
}

void main() {
    vec2 uv = 0.5 * vUv;
    uv.x *= u_ratio;

    // Calculate pointer influence based on distance from cursor
    vec2 pointer = vUv - u_pointer_position;
    pointer.x *= u_ratio;
    float pointerDistance = clamp(length(pointer), 0.0, 1.0);
    float pointerInfluence = 0.5 * pow(1.0 - pointerDistance, 2.0) * u_pointer_strength;

    float t = u_time;
    
    // Generate noise pattern
    float noise = neuro_shape(uv, t, pointerInfluence, u_detail);
    noise = 1.2 * pow(max(noise, 0.0), mix(2.5, 3.8, u_detail));
    noise += pow(noise, 10.0);
    noise = max(0.0, noise - 0.5);
    
    // Fade at edges
    noise *= (1.0 - length(vUv - 0.5));

    // Boost highlights near the pointer to emphasize interaction
    float glow = clamp(noise + pointerInfluence * 0.35, 0.0, 1.0);

    // Blend between the provided colors using the animated glow as the mix factor
    vec3 blendedColor = mix(u_color_a, u_color_b, smoothstep(0.15, 0.85, glow));

    vec3 finalColor = blendedColor * glow * u_intensity;

    gl_FragColor = vec4(finalColor, glow);
}
`;

// Compile a WebGL shader
function compileShader(gl: WebGLRenderingContext, source: string, type: number) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("NeuralNoise shader error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Create and link a WebGL program
function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
) {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("NeuralNoise program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

const cssVariableRegex = /var\s*\(\s*(--[\w-]+)(?:\s*,\s*((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*))?\s*\)/;

function extractDefaultValue(cssVar: string): string {
  if (!cssVar || !cssVar.startsWith("var(")) return cssVar;
  const match = cssVariableRegex.exec(cssVar);
  if (!match) return cssVar;
  const fallback = (match[2] || "").trim();
  if (fallback.startsWith("var(")) return extractDefaultValue(fallback);
  return fallback || cssVar;
}

function resolveTokenColor(input: string, fallback: string): string {
  const value = (input || fallback || "#ffffff").trim();
  if (!value) return fallback;
  if (!value.startsWith("var(")) return value;
  return resolveTokenColor(extractDefaultValue(value), fallback);
}

function parseColorToRgb(input: string, fallback: string): [number, number, number] {
  const resolved = resolveTokenColor(input, fallback).trim().toLowerCase();
  if (!resolved) return parseColorToRgb(fallback, "#ffffff");
  
  const rgbaMatch = resolved.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i
  );
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, parseFloat(rgbaMatch[1]))) / 255;
    const g = Math.max(0, Math.min(255, parseFloat(rgbaMatch[2]))) / 255;
    const b = Math.max(0, Math.min(255, parseFloat(rgbaMatch[3]))) / 255;
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [r, g, b];
    }
  }
  
  if (resolved.startsWith("#")) {
    const hex = resolved.slice(1);
    const expandHex = (value: string) => {
      if (value.length === 3) {
        return value.split("").map((digit) => digit + digit).join("");
      }
      if (value.length === 4) {
        return value.split("").map((digit) => digit + digit).join("").slice(0, 6);
      }
      return value;
    };
    const normalizedHex = expandHex(hex);
    if (normalizedHex.length >= 6) {
      const r = parseInt(normalizedHex.slice(0, 2), 16);
      const g = parseInt(normalizedHex.slice(2, 4), 16);
      const b = parseInt(normalizedHex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return [r / 255, g / 255, b / 255];
      }
    }
  }
  return parseColorToRgb(fallback, "#ffffff");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Map UI values to internal shader values
function mapLinear(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

interface NeuralNoiseProps {
  backgroundColor?: string;
  animationSpeed?: number;
  pointerStrength?: number;
  intensity?: number;
  detail?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

const NeuralNoise = ({
  backgroundColor = "transparent",
  animationSpeed = 0.5,
  pointerStrength = 0.3,
  intensity = 0.45,
  detail = 0.6,
  primaryColor = "#007BFF",
  secondaryColor = "#ffffff",
}: NeuralNoiseProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const colorUniformsRef = useRef<{
    colorA: WebGLUniformLocation | null;
    colorB: WebGLUniformLocation | null;
  }>({ colorA: null, colorB: null });
  const colorsRef = useRef({
    colorA: parseColorToRgb(primaryColor, "#007BFF"),
    colorB: parseColorToRgb(secondaryColor, "#ffffff"),
  });
  const animationFrameRef = useRef<number | null>(null);

  // Map UI values (0.1-1) to shader intensity (0.2-3)
  const mappedIntensity = mapLinear(intensity, 0.1, 1, 0.2, 3);
  // Map UI values (0-1) to shader pointer strength (0-2)
  const mappedPointerStrength = mapLinear(pointerStrength, 0, 1, 0, 2);
  // Map UI values (0-1) to shader animation speed (0.2-3)
  const mappedAnimationSpeed = mapLinear(animationSpeed, 0, 1, 0.2, 3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize WebGL context
    const gl =
      canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false,
      }) || (canvas.getContext("experimental-webgl") as WebGLRenderingContext);

    if (!gl) {
      console.warn("NeuralNoise: WebGL not supported in this environment.");
      return;
    }

    // Create shader program
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) return;

    // Get attribute and uniform locations
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const ratioLocation = gl.getUniformLocation(program, "u_ratio");
    const pointerLocation = gl.getUniformLocation(program, "u_pointer_position");
    const pointerStrengthLocation = gl.getUniformLocation(program, "u_pointer_strength");
    const intensityLocation = gl.getUniformLocation(program, "u_intensity");
    const detailLocation = gl.getUniformLocation(program, "u_detail");
    const colorALocation = gl.getUniformLocation(program, "u_color_a");
    const colorBLocation = gl.getUniformLocation(program, "u_color_b");

    if (
      !timeLocation ||
      !ratioLocation ||
      !pointerLocation ||
      !pointerStrengthLocation ||
      !intensityLocation ||
      !detailLocation ||
      !colorALocation ||
      !colorBLocation
    ) {
      console.warn("NeuralNoise: Missing uniform locations.");
      gl.deleteProgram(program);
      return;
    }

    // Create buffer for fullscreen quad
    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    glRef.current = gl;
    programRef.current = program;
    colorUniformsRef.current = { colorA: colorALocation, colorB: colorBLocation };

    // State tracking
    const pointerRef = { x: 0.5, y: 0.5 };
    let isMounted = true;
    let canvasWidth = 0;
    let canvasHeight = 0;
    const startTime = performance.now();

    // Resize canvas to match parent with device pixel ratio
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const ratio = window.devicePixelRatio || 1;
      const displayWidth = Math.max(2, Math.floor(parent.clientWidth * ratio));
      const displayHeight = Math.max(2, Math.floor(parent.clientHeight * ratio));

      if (canvasWidth !== displayWidth || canvasHeight !== displayHeight) {
        canvasWidth = displayWidth;
        canvasHeight = displayHeight;
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    // Update pointer position on mouse/touch move
    const drawFrame = (now: number) => {
      if (!isMounted) return false;
      
      // Always animate in standard React component usage
      const shouldAnimate = true; 
      const effectiveNow = now;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const ratio = canvasHeight === 0 ? 1 : canvasWidth / canvasHeight;
      const elapsedSeconds = (effectiveNow - startTime) * 0.001 * mappedAnimationSpeed;

      gl.uniform1f(timeLocation, elapsedSeconds);
      gl.uniform1f(ratioLocation, ratio);
      gl.uniform2f(pointerLocation, pointerRef.x, 1 - pointerRef.y);
      gl.uniform1f(pointerStrengthLocation, mappedPointerStrength);
      gl.uniform1f(intensityLocation, mappedIntensity);
      gl.uniform1f(detailLocation, clamp(detail, 0, 1));
      gl.uniform3f(
        colorALocation,
        colorsRef.current.colorA[0],
        colorsRef.current.colorA[1],
        colorsRef.current.colorA[2]
      );
      gl.uniform3f(
        colorBLocation,
        colorsRef.current.colorB[0],
        colorsRef.current.colorB[1],
        colorsRef.current.colorB[2]
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return shouldAnimate;
    };

    const render = (now: number) => {
      if (!isMounted) return;
      resizeCanvas();
      const shouldAnimate = drawFrame(now);
      if (shouldAnimate) {
        animationFrameRef.current = requestAnimationFrame(render);
      } else {
        animationFrameRef.current = null;
      }
    };

    const updatePointer = (event: PointerEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerRef.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      pointerRef.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    };

    resizeCanvas();

    // Event listeners
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("resize", resizeCanvas);

    animationFrameRef.current = requestAnimationFrame(render);

    // Cleanup
    return () => {
      isMounted = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("resize", resizeCanvas);
      
      // Basic WebGL cleanup
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      glRef.current = null;
      programRef.current = null;
      colorUniformsRef.current = { colorA: null, colorB: null };
    };
  }, [
    mappedAnimationSpeed,
    mappedPointerStrength,
    mappedIntensity,
    detail,
    primaryColor,
    secondaryColor,
    backgroundColor,
  ]);

  useEffect(() => {
    colorsRef.current.colorA = parseColorToRgb(primaryColor, "#007BFF");
    colorsRef.current.colorB = parseColorToRgb(secondaryColor, "#ffffff");
    
    const gl = glRef.current;
    const program = programRef.current;
    const { colorA, colorB } = colorUniformsRef.current;

    if (!gl || !program) return;

    gl.useProgram(program);
    if (colorA) {
      gl.uniform3f(
        colorA,
        colorsRef.current.colorA[0],
        colorsRef.current.colorA[1],
        colorsRef.current.colorA[2]
      );
    }
    if (colorB) {
      gl.uniform3f(
        colorB,
        colorsRef.current.colorB[0],
        colorsRef.current.colorB[1],
        colorsRef.current.colorB[2]
      );
    }
  }, [primaryColor, secondaryColor]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 1,
        }}
      />
    </div>
  );
};

export default NeuralNoise;

