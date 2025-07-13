// src/_lib/Starter.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class Starter {
    scene = null;
    camera = null;
    clock = null;
    renderer = null;
    orbit = null;
    render_bind = this.render.bind(this);
    onRender = null;
    deltaTime = 0;
    elapsedTime = 0;
    _container = null;
    _resizeObserver = null;

    constructor(config = {}) {
        this._container = config.container || document.body;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, this._container.clientWidth / this._container.clientHeight, 0.01, 2000);
        this.camera.position.set(0, 10, 20);
        
        this.clock = new THREE.Clock();

        // Lighting
        let light = new THREE.DirectionalLight(0xffffff, 0.8);
        light.position.set(4, 10, 4);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x404040));

        // Renderer
        let options = { antialias: true, alpha: true };
        if (config.webgl2) {
            let canvas = document.createElement("canvas");
            options.canvas = canvas;
            options.context = canvas.getContext("webgl2");
        }
        this.renderer = new THREE.WebGLRenderer(options);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x3a3a3a, 1);
        this._container.appendChild(this.renderer.domElement);

        // Orbit Controls
        this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        if (config.grid) this.scene.add(new THREE.GridHelper(20, 20, 0x0c610c, 0x444444));

        // **MODIFIED RESIZING LOGIC**
        this.setupResizeObserver();
        this.setSize(this._container.clientWidth, this._container.clientHeight); // Initial size
    }

    setupResizeObserver() {
        this._resizeObserver = new ResizeObserver(entries => {
            if (!entries || entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            this.setSize(width, height);
        });
        this._resizeObserver.observe(this._container);
    }
    
    dispose() {
        if (this._resizeObserver && this._container) {
            this._resizeObserver.unobserve(this._container);
        }
        // Add other cleanup logic here if necessary
    }

    setSize(w, h) {
        if (this.renderer) {
            this.renderer.setSize(w, h);
        }
        if (this.camera) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
    }

    render() {
        requestAnimationFrame(this.render_bind);
        this.deltaTime = this.clock.getDelta();
        this.elapsedTime = this.clock.elapsedTime;
        if (this.onRender) this.onRender(this.deltaTime, this.elapsedTime);
        this.renderer.render(this.scene, this.camera);
    }

    add(o) { this.scene.add(o); return this; }
    remove(o) { this.scene.remove(o); return this; }

    setCamera(lon, lat, radius, target) {
        let phi = (90 - lat) * Math.PI / 180;
        let theta = (lon + 180) * Math.PI / 180;
        this.camera.position.set(
            -(radius * Math.sin(phi) * Math.sin(theta)),
            radius * Math.cos(phi),
            -(radius * Math.sin(phi) * Math.cos(theta))
        );
        if (target) this.orbit.target.fromArray(target);
        this.orbit.update();
        return this;
    }
}

export default Starter;
export { THREE };
