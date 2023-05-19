//Shaders
const vertexShader = `
attribute vec3 vertexPosition;
attribute vec2 vertexTexture;
varying vec2 fragTexture;
uniform mat4 worldMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
void main()
{
    fragTexture = vertexTexture;
    gl_Position = projectionMatrix * viewMatrix * worldMatrix * vec4(vertexPosition, 1.0);
}`

const fragmentShader = `
precision mediump float;
varying vec2 fragTexture;
uniform sampler2D sampler;
void main()
{
    gl_FragColor = texture2D(sampler, fragTexture);
}`

// Cubo
const cube = {
	vertices: new Float32Array([
		// Front
		-1, 1, 1,
		 1, 1, 1,
		 1,-1, 1,
		-1,-1, 1,
		// Back
		 1, 1,-1,
		-1, 1,-1,
		-1,-1,-1,
		 1,-1,-1,
		// Top
		-1, 1,-1,
		 1, 1,-1,
		 1, 1, 1,
		-1, 1, 1,
		// Bottom
		-1,-1, 1,
		 1,-1, 1,
		 1,-1,-1,
		-1,-1,-1,
		// Left
		-1, 1,-1,
		-1, 1, 1,
		-1,-1, 1,
		-1,-1,-1,
		// Right
		 1, 1, 1,
		 1, 1,-1,
		 1,-1,-1,
		 1,-1, 1
	]),
	uvmap: new Float32Array([
		// Front
		0.0, 0.0,
		0.333, 0.0,
		0.333, 0.5,
		0.0, 0.5,
		// Back
		0.333, 0.0,
		0.666, 0.0,
		0.666, 0.5,
		0.333, 0.5,
		// Top
		0.666, 0.0,
		1.0, 0.0,
		1.0, 0.5,
		0.666, 0.5,
		// Bottom
		0.0, 0.5,
		0.333, 0.5,
		0.333, 1.0,
		0.0, 1.0,
		// Left
		0.333, 0.5,
		0.666, 0.5,
		0.666, 1.0,
		0.333, 1.0,
		// Top
		0.666, 0.5,
		1.0, 0.5,
		1.0, 1.0,
		0.666, 1.0
	]),
	indexes: new Uint16Array([
		 0, 1, 2, 0, 2, 3, // Front
		 4, 5, 6, 4, 6, 7, // Back
		 8, 9,10, 8,10,11, // Top
		12,13,14,12,14,15, // Bottom
		16,17,18,16,18,19, // Left
		20,21,22,20,22,23  // Right
	])
}

// Canvas
const canvas = document.getElementById('canvas')
const context = canvas.getContext('webgl')
context.clearColor(0.0, 0.0, 0.0, 0.0)
context.colorMask(true, true, true, true)
context.enable(context.DEPTH_TEST)
context.depthFunc(context.LEQUAL)
context.cullFace(context.BACK)
context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA)
context.viewport(0, 0, canvas.width, canvas.height)

// Funções auxiliares  para criação de buffers, shaders e programas
let positionBuffer, textureBuffer, indexBuffer, vertexModule, fragmentModule, program, texture

function createBuffer(array) {
	const buffer = context.createBuffer()
	const bufferType = array instanceof Uint16Array || array instanceof Uint32Array
		? context.ELEMENT_ARRAY_BUFFER
		: context.ARRAY_BUFFER
	context.bindBuffer(bufferType, buffer)
	context.bufferData(bufferType, array, context.STATIC_DRAW)
	return buffer
}

function createShader(source, stage) {
	const shader = context.createShader(stage);
	context.shaderSource(shader, source);
	context.compileShader(shader);
	if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
		throw new Error(`Error compiling shader: ${context.getShaderInfoLog(shader)}`);
	}
	return shader;
}

function createProgram(stages) {
	const program = context.createProgram();
	stages.forEach(stage => context.attachShader(program, stage))
	context.linkProgram(program)
	return program
}

function createTexture(textureURL) {
	const texture = context.createTexture()
	context.bindTexture(context.TEXTURE_2D, texture)
	context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
	context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
	context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST)
	context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST)
	const image = new Image
	image.src = textureURL
	new Promise(resolve => image.addEventListener('load', resolve)).then(() => {
		context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, image)
	})
	return texture
}

function bindBuffer(buffer, name, size) {
	const location = context.getAttribLocation(program, name)
	context.bindBuffer(context.ARRAY_BUFFER, buffer)
	context.vertexAttribPointer(location, size, context.FLOAT, false, 4 * size, 0)
	context.enableVertexAttribArray(location)
}

// Câmera
let worldMatrixLocation, viewMatrixLocation, projectionMatrixLocation, worldMatrix, viewMatrix, projectionMatrix, mouseX = 0, mouseY = 0

function rotate(x,y) {
	const oldWorldMatrix = worldMatrix
	worldMatrix = glMatrix.mat4.create()
	glMatrix.mat4.rotateX(worldMatrix, worldMatrix, x * 0.01)
	glMatrix.mat4.rotateY(worldMatrix, worldMatrix, y * 0.01)
	glMatrix.mat4.multiply(worldMatrix, worldMatrix, oldWorldMatrix)
	context.uniformMatrix4fv(worldMatrixLocation, context.FALSE, worldMatrix)
}

window.addEventListener('mousemove', ({buttons,x,y}) => {
	if (buttons === 1) rotate(y - mouseY, x - mouseX)
	mouseX = x
	mouseY = y
})

window.addEventListener('touchstart', ({touches}) => {
	if (touches.length > 1) return
	mouseX = touches[0].pageX
	mouseY = touches[0].pageY
})

window.addEventListener('touchmove', ({touches}) => {
	if (touches.length > 1) return
	rotate(touches[0].pageY - mouseY, touches[0].pageX - mouseX)
	mouseX = touches[0].pageX
	mouseY = touches[0].pageY
})

// Animação
let frame

function start() {
	// Configurar contexto
	positionBuffer = createBuffer(cube.vertices)
	textureBuffer = createBuffer(cube.uvmap)
	indexBuffer = createBuffer(cube.indexes)
	vertexModule = createShader(vertexShader, context.VERTEX_SHADER)
	fragmentModule = createShader(fragmentShader, context.FRAGMENT_SHADER)
	texture = createTexture('./images/texture-lobo.png')
	program = createProgram([vertexModule,fragmentModule])
	context.useProgram(program)

	// Camera
	worldMatrixLocation = context.getUniformLocation(program, 'worldMatrix')
	viewMatrixLocation = context.getUniformLocation(program, 'viewMatrix')
	projectionMatrixLocation = context.getUniformLocation(program, 'projectionMatrix')
	worldMatrix = glMatrix.mat4.create()
	viewMatrix = glMatrix.mat4.lookAt(glMatrix.mat4.create(), [0,0,6], [0,0,0], [0,1,0])
	projectionMatrix = glMatrix.mat4.perspective(glMatrix.mat4.create(), 45 * Math.PI / 180, canvas.width / canvas.height, 0.1, 1000.0)
	context.uniformMatrix4fv(worldMatrixLocation, context.FALSE, worldMatrix)
	context.uniformMatrix4fv(viewMatrixLocation, context.FALSE, viewMatrix)
	context.uniformMatrix4fv(projectionMatrixLocation, context.FALSE, projectionMatrix)
	rotate(35,0)

	// Carregar buffers
	bindBuffer(positionBuffer, 'vertexPosition', 3)
	bindBuffer(textureBuffer, 'vertexTexture', 2)
	context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer)

	// Iniciar animação
	frame = window.requestAnimationFrame(animation)
}

function stop() {
	// Parar animação
	cancelAnimationFrame(frame)

	// Deletar recursor do contexto
	context.deleteBuffer(positionBuffer)
	context.deleteBuffer(textureBuffer)
	context.deleteBuffer(indexBuffer)
	context.deleteShader(vertexModule)
	context.deleteShader(fragmentModule)
	context.deleteTexture(texture)
	context.deleteProgram(program)

	// Limpar o contexto
	context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT)
}

function animation(timestamp) {
	// render
	context.drawElements(context.TRIANGLES, cube.indexes.length, context.UNSIGNED_SHORT, 0)

	// Chamar próximo frame
	frame = window.requestAnimationFrame(animation)
}

start()