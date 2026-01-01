/*-------------------------------------------------------------------------------------------------------------------*\
Copyright (c) 2008-2023, Danny Ruijters. All rights reserved.
http://www.dannyruijters.nl/cubicinterpolation/webgl/

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:
*  Redistributions of source code must retain the above copyright notice, this list of conditions and the following
   disclaimer.
*  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided with the distribution.
*  Neither the name of the copyright holders nor the names of its contributors may be used to endorse or promote
   products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The views and conclusions contained in the software and documentation are those of the authors and should not be
interpreted as representing official policies, either expressed or implied.

When using this code in a scientific project, please cite one or all of the following papers:
*  Daniel Ruijters and Philippe Th�venaz, GPU Prefilter for Accurate Cubic B-Spline Interpolation, The Computer
   Journal, vol. 55, no. 1, pp. 15-20, January 2012. http://dannyruijters.nl/docs/cudaPrefilter3.pdf
*  Daniel Ruijters, Bart M. ter Haar Romeny, and Paul Suetens, Efficient GPU-Based Texture Interpolation using Uniform
   B-Splines, Journal of Graphics Tools, vol. 13, no. 4, pp. 61-69, 2008.
\*-------------------------------------------------------------------------------------------------------------------*/

function initGL(canvas) {
    let gl;
    try {
        gl = canvas.getContext("webgl2");
        if (gl == null) { gl = canvas.getContext("experimental-webgl2"); }
        if (gl == null) { gl = canvas.getContext("webgl"); }
        if (gl == null) { gl = canvas.getContext("experimental-webgl"); }
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.disable(gl.DEPTH_TEST);
        gl.zoom = 1.0;
        gl.translateX = 0.0;
        gl.translateY = 0.0;
        canvas.gl = gl;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
    return gl;
}

function loadShader(gl, str, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function compileShader(gl, fragmentShader, vertexShader) {
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");

    return shaderProgram;
}

function initShaders(gl) {    
    const shaderSimpleStr = '\
        varying vec2 vTextureCoord;                                                 \n\
        uniform mat3 matrix;                                                        \n\
        uniform sampler2D uSampler;                                                 \n\
        void main(void) {                                                           \n\
            vec2 coordTex = (matrix * vec3(vTextureCoord - 0.5, 1)).xy + 0.5;       \n\
            gl_FragColor = texture2D(uSampler, coordTex);                           \n\
        }';
    
    const shaderVertexStr = '\
        attribute vec2 aTextureCoord;                                               \n\
        varying vec4 vColor;                                                        \n\
        varying vec2 vTextureCoord;                                                 \n\
                                                                                    \n\
        void main(void) {                                                           \n\
            vec2 pos = 2.0 * aTextureCoord - 1.0;                                   \n\
            gl_Position = vec4(pos.x, pos.y, 0.0, 1.0);                             \n\
            vTextureCoord = aTextureCoord;                                          \n\
        }';
    
    const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const precisionTxt = (highp.precision != 0) ?
        'precision highp float;\nprecision highp sampler2D;\n' :
        'precision mediump float;\nprecision mediump sampler2D;\n';
    const fragmentSimple = loadShader(gl, precisionTxt+shaderSimpleStr, gl.FRAGMENT_SHADER);
    const vertexShader = loadShader(gl, shaderVertexStr, gl.VERTEX_SHADER);

    gl.shaderSimple = compileShader(gl, fragmentSimple, vertexShader);
    gl.shaderSimple.matrixUniform = gl.getUniformLocation(gl.shaderSimple, "matrix");
}

function initTextureCoordBuffer(gl) {
    gl.textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.textureCoordBuffer);
    const textureCoords = [1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    gl.textureCoordBuffer.itemSize = 2;
    gl.textureCoordBuffer.numItems = 4;
}

function initCanvasGL(canvas) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    // set the size of the drawingBuffer based on the size it's displayed.
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    
    const gl = initGL(canvas);
    initShaders(gl);
    initTextureCoordBuffer(gl);
    return gl;
}

function freeProgram(gl, program) {
    const shaders = gl.getAttachedShaders(program);
    for (let n=0, n_max=shaders.length; n < n_max; n++) {
        gl.deleteShader(shaders[n]);
    }
    gl.deleteProgram(program);
}

function freeResources(gl) {
    gl.deleteBuffer(gl.textureCoordBuffer);
    freeProgram(gl, gl.shaderSimple);
    
    gl.textureCoordBuffer = null;
    gl.shaderSimple = null;
}

function drawTexture(gl, shader) {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1i(shader.samplerUniform, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.textureCoordBuffer);
    gl.vertexAttribPointer(gl.textureCoordAttribute, gl.textureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, gl.textureCoordBuffer.numItems);
}

function cubicFilter(gl, texture, width, height) {
    // Draw final image
    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.buffer);
    gl.viewport(0, 0, width, height);
    gl.useProgram(gl.shaderSimple);
    // Calculate aspect ratio correction
    const textureAspect = texture.width / texture.height;
    const canvasAspect = width / height;
    const scaleX = (canvasAspect > textureAspect) ? 1.0 : (canvasAspect /textureAspect);
    const scaleY = (canvasAspect > textureAspect) ? (textureAspect / canvasAspect) : 1.0;
    const matrix = [gl.zoom * scaleX, 0.0, 0.0, 0.0, gl.zoom * scaleY, 0.0, gl.translateX, gl.translateY, 1.0];
    gl.uniformMatrix3fv(gl.shaderSimple.matrixUniform, false, matrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    drawTexture(gl, gl.shaderSimple);
}

function handleLoadedImage(canvas, image, width, height) {
    const gl = canvas.gl;
    if (!gl.myTexture) gl.myTexture = gl.createTexture();
    let texture = gl.myTexture;
    texture.width = width;
    texture.height = height;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);

    cubicFilter(gl, texture, canvas.width, canvas.height);
}
