import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js'

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: true, 
    alpha: true 
})
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set(0, 5, 10); 

const controls = new OrbitControls(camera, renderer.domElement);

let carMesh = null; 
const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

// Физика автомобиля
let currentSpeed = 0;           // Текущая скорость (изменяется каждый кадр)
const maxSpeed = 0.4;          // Максимальная скорость вперед
const maxReverseSpeed = -0.10;  // Максимальная скорость назад (медленнее)
const acceleration = 0.008;     // Как быстро разгоняется
const braking = 0.015;          // Как быстро тормозит при нажатии противоположной клавиши
const friction = 0.003;         // Естественное замедление (качение)
const turnSpeed = 0.04;         // Скорость поворота

const cameraOffset = new THREE.Vector3(0, 2, -3); 

setLights();
setRenderer();
setCameraControl();
setupInput();

// Загрузка машины
loadModel(
    '/car/scene.gltf', 
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 1, 1),
    (model) => { 
        carMesh = model; 
        console.log('✅ Машина загружена и готова к управлению');
    }
);

loadModel(
    '/futuristic_city/scene.gltf',
    new THREE.Vector3(0, -19.65, 0),
    new THREE.Vector3(2, 2, 2)
);

// Фон
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load('./bg.jpg');
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(4, 4);
const geometry = new THREE.SphereGeometry( 500, 500, 500 );
const material = new THREE.MeshBasicMaterial( { map:texture, side: THREE.BackSide } );
const sphere = new THREE.Mesh( geometry, material );
scene.add( sphere );

// Пост-процессинг
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.1, 
    0.1,
    0.95
);
const vignetteShader = VignetteShader;
const vignettePass = new ShaderPass(vignetteShader);
vignettePass.uniforms['offset'].value = 1;
vignettePass.uniforms['darkness'].value = 1.009;

const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms['resolution'].value.set(
  1 / (window.innerWidth * renderer.getPixelRatio()),
  1 / (window.innerHeight * renderer.getPixelRatio())
);

const bokehPass = new BokehPass(scene, camera, {
	focus: 3,
	aperture: 0.001,
	maxblur: 0.006
})
const outputPass = new OutputPass();

composer.addPass(renderPass);
composer.addPass(bokehPass);
composer.addPass(vignettePass)
composer.addPass(bloomPass);
composer.addPass(fxaaPass)
composer.addPass(outputPass);

animate();

function animate() {
    requestAnimationFrame(animate)
    
    if (carMesh) {
        if (keys.forward) {
            if (currentSpeed < maxSpeed) {
                currentSpeed += acceleration;
            }
        }
        else if (keys.backward) {
            if (currentSpeed > maxReverseSpeed) {
                currentSpeed -= acceleration;
            }
        }
        else if ((keys.forward && currentSpeed < 0) || (keys.backward && currentSpeed > 0)) {
            currentSpeed += (currentSpeed < 0 ? braking : -briction);
        }
        else {
            if (Math.abs(currentSpeed) > friction) {
                currentSpeed -= Math.sign(currentSpeed) * friction;
            } else {
                currentSpeed = 0;
            }
        }
        
        if (Math.abs(currentSpeed) > 0.001) {
            carMesh.translateZ(currentSpeed);
        }

        if (Math.abs(currentSpeed) > 0.01) {
            const direction = Math.sign(currentSpeed);
            if (keys.left) {
                carMesh.rotation.y += turnSpeed * direction;
            }
            if (keys.right) {
                carMesh.rotation.y -= turnSpeed * direction;
            }
        }

        const relativeCameraOffset = cameraOffset.clone().applyMatrix4(carMesh.matrixWorld);
        camera.position.lerp(relativeCameraOffset, 0.1);
        camera.lookAt(carMesh.position);
        controls.target.copy(carMesh.position);
    }

    controls.update();
    composer.render()
}

function setupInput() {
    window.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'KeyW': keys.forward = true; break;
            case 'KeyS': keys.backward = true; break;
            case 'KeyA': keys.left = true; break;
            case 'KeyD': keys.right = true; break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': keys.forward = false; break;
            case 'KeyS': keys.backward = false; break;
            case 'KeyA': keys.left = false; break;
            case 'KeyD': keys.right = false; break;
        }
    });
    
    window.addEventListener('blur', () => {
        keys.forward = false;
        keys.backward = false;
        keys.left = false;
        keys.right = false;
    });
}

function setLights() {
    const light = new THREE.AmbientLight(0xFFFFFF, 1);
    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 5);
    dirLight.position.set(5, 100, 5);
    const spotlight = new THREE.SpotLight('red', 10);
    spotlight.position.set(5, 5, 5);
    const spotlight2 = new THREE.SpotLight('yellow', 10);
    spotlight2.position.set(-5, 5, 5);
    scene.add(dirLight, spotlight, light, spotlight2);

    const fogColor = '#181818'
    scene.background = new THREE.Color(fogColor)
    scene.fog = new THREE.Fog(fogColor, 10, 600)
}

function setRenderer() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.55
    renderer.physicallyCorrectLights = true
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild( renderer.domElement );
}

function setCameraControl() {
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 2;
    controls.maxDistance = 100;
    controls.enableZoom = false; 
    controls.enablePan = false;
}

function loadModel(path, postitionVec, sizeVec, onLoad = null) {
    const loader = new GLTFLoader();
    loader.load( path, function ( gltf ) {
        const model = gltf.scene;
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true
            }
        })
        model.position.set(postitionVec.x, postitionVec.y, postitionVec.z);
        model.scale.set(sizeVec.x, sizeVec.y, sizeVec.z);
        
        if (onLoad) { 
            model.rotation.y = Math.PI / 2; 
        }
        
        scene.add( model );
        if (onLoad) onLoad(model);
    }, undefined, function ( error ) {
        console.error( error );
    } );
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    fxaaPass.material.uniforms['resolution'].value.set(
        1 / (window.innerWidth * renderer.getPixelRatio()),
        1 / (window.innerHeight * renderer.getPixelRatio())
    );
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});