import { XRControllerModelFactory } from './node_modules/super-three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from './XRHandModelFactory.js';

import { RandomTreeData } from './random-tree.js';

const fractalRootOrigin = new THREE.Vector3(0, 1, 0);
let fractalTree = [];
let branchTriangles = new Map(); // array of lines: [ind, [orig-forward, orig-perp, forward-perp]]
let branchMeshTriangles = new Map(); // array of triangles

let segments = []; // segment of lines of the tree
let scaledSegments = []; // segment of lines of the tree for closer observe by user

const base = [
  new THREE.Vector3(0, 0, 0), // [0] - center of triangle
  new THREE.Vector3(0, 1, 0), // forward vector
  new THREE.Vector3(1, 0, 0), // right vector
  new THREE.Vector3(0, 0, 0) // close triangle
];

AFRAME.registerComponent("handy-component", {

  init() {
    this.counter = 0;
    this.tScene = null;
    this.isControlleraHand = false;
    this.handR = null;
    this.handL = null;
    this.controller1 = null;
    this.controller2 = null;
    this.head = null;
    this.iterationsNo = 4;

    this.throttledFunction = AFRAME.utils.throttle(this.everySecond, 10, this);


    this.tmpVector1 = new THREE.Vector3();
    this.tmpVector2 = new THREE.Vector3();
    this.tempV3 = new THREE.Vector3();
    this.tempV32 = new THREE.Vector3();
    this.tempV33 = new THREE.Vector3();

    this.movables = [];
    this.hands = [];

    this.isImmersive = false;
    this.isMusicOn = false;

    this.raycaster = new THREE.Raycaster();
    this.intersected = [];
    this.tempMatrix = new THREE.Matrix4();

    this.controls;

    this.uiPanel = null;
    this.isClickedByTip = false;

    this.squeezedEl = null;
    this.squeezedByRight = false; // by Hand or Controller
    this.squeezedByLeft = false;

    this.helpBoxScaleDistance = null;

    this.triangleMeshTexture = this.getTexture();

    this.anyButtonBlocked = false;

    this.onPinchStart = this.onPinchStart.bind(this);
    this.onPinchEnd = this.onPinchEnd.bind(this);
    this.onConnected = this.onConnected.bind(this);
    this.onSelectStart = this.onSelectStart.bind(this);
    this.onSelectEnd = this.onSelectEnd.bind(this);
    this.onSqueezeStart = this.onSqueezeStart.bind(this);
    this.onSqueezeEnd = this.onSqueezeEnd.bind(this);

    const presets = [];

    const showBaseTriangle = () => {
      let points = [new THREE.Vector3(), fractalRootOrigin, new THREE.Vector3(0.25, 0, 0)];
      let geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometry.computeVertexNormals(); // TODO check if this is required

      const material = new THREE.MeshBasicMaterial({
        // TODO choose way for transparency
        // alphaMap: this.triangleMeshTexture,
        opacity: 0.4,
        transparent: true,
        side: THREE.DoubleSide,
        // alphaTest: 0.5,
        depthWrite: false

      });
      const meshTriangle = new THREE.Mesh(geometry, material)

      this.tScene.add(meshTriangle);
    }

    RandomTreeData.forEach((treeData, i) => {
      let treeDataOut = [];
      treeData.forEach((tr) => {
        let trOut = [];
        tr.forEach((point) => {
          trOut.push(new THREE.Vector3().fromArray(point).add(fractalRootOrigin));
        });
        treeDataOut.push(trOut);
      })
      presets.push(treeDataOut);
    });

    this.el.sceneEl.addEventListener("enter-vr", () => {
      // adjust user position (to outstand little bit before a tree)
      const rig = document.getElementById('rig');
      rig.object3D.position.z = 0.5;


      this.isImmersive = true;
      playSoundOnStart();
    });
    /*
        this.el.sceneEl.addEventListener("enter-vr", () => {
          for (const name of ["select", "selectstart", "selectend", "squeeze", "squeezeend", "squeezestart"])
            // sceneEl.xrSession.addEventListener(name, this.eventFactory(name, this));
            this.el.sceneEl.xrSession.addEventListener(name,
              (event) => {
                console.log('event: ' + event.type)
              });
        });
    */

    const playSoundOnStart = (evt) => {
      if(!this.isMusicOn) {
        document.getElementById("melody").components.sound.playSound();
        this.isMusicOn = true;
        document.getElementById("music-off").removeAttribute('checked');
        document.getElementById("music-on").setAttribute('checked', true);
      }
    }

    document.getElementById("melody").addEventListener('sound-loaded', (evt) => {
      console.log('sound-loaded');
      // playSoundOnStart(evt);

    });

    document.getElementById("help_model").addEventListener('model-error', (evt) => { 
      console.log('model-error help_model');
    });
    // TODO testing


    // self.emit('progress', {
    //   loadedBytes: xhr.loaded,
    //   totalBytes: xhr.total,
    //   xhr: xhr
    // });
    document.getElementById("help_model").addEventListener('progress', (evt) => {
      console.log('model-loaded progress');
    });

    document.getElementById("help_model").addEventListener('loaded', (evt) => {
      console.log('model-loaded help_model');

      // https://glitch.com/edit/#!/aframe-assetsloaded?path=index.html%3A20%3A111
    });


    document.getElementById("help_obj").addEventListener('model-error', (evt) => { 
      console.log('model-error');
    });
    // TODO testing
    document.getElementById("help_obj").addEventListener('model-loaded', (evt) => {
      console.log('model-loaded');
      const aabb = new THREE.Box3().setFromObject(evt.target.object3D);
      const aabbSize = aabb.getSize(new THREE.Vector3());
      
      // Creating a box around the Help Model
      const helpObjBox = document.createElement('a-entity');
      helpObjBox.setAttribute('id', 'help_obj_box');
      helpObjBox.setAttribute('visible', false);
      helpObjBox.setAttribute('geometry', {
        primitive: 'box',
        depth: aabbSize.z,
        height: aabbSize.y,
        width: aabbSize.x
      });
      helpObjBox.setAttribute('material', {
        color: 'white',
        opacity: 0.05,
        shader: 'phong'
      });

      helpObjBox.classList.add('movable');
      this.movables.push(helpObjBox.object3D);

      // correct position of the origin point of the model (it can be not centered at all)
      const modelRealCenterPoint = new THREE.Vector3();
      modelRealCenterPoint.copy(aabb.min).add(aabb.max).multiplyScalar(0.5);
      evt.target.object3D.position.sub(modelRealCenterPoint);

      helpObjBox.object3D.add(evt.target.object3D);
      helpObjBox.object3D.position.set(0, 0, 0);

      this.el.appendChild(helpObjBox);
    });


    // The main Scene is loaded
    this.el.sceneEl.addEventListener('loaded', (sceneEvt) => {
      console.log('scene-loaded');

      let lv_list_to_remove = document.getElementsByClassName('loading_value');
      Array.from(lv_list_to_remove).forEach(function (element) {
        element.remove();
      });

      const rig = document.getElementById('rig').object3D;
      this.tScene = this.el.sceneEl.object3D;
      this.uiPanel = document.getElementById('ui-panel');

      showBaseTriangle();

      Array.from(document.getElementsByClassName('movable')).forEach((el) => {
        this.movables.push(el.object3D);
      });



      const camera = this.el.camera;
      camera.position.add(new THREE.Vector3(0, 0, -1));
      // camera.el.setAttribute('look-controls', {pointerLockEnabled: false});



      let controllerGrip1, controllerGrip2;



      // Access the A-Frame scene's renderer and set XR mode
      const renderer = this.el.sceneEl.renderer;
      // renderer = new THREE.WebGLRenderer( { antialias: true } );
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.xr.enabled = true;


      // controllers & hands
      this.controller1 = renderer.xr.getController(0);
      this.controller1.addEventListener('connected', this.onConnected);
      this.controller1.addEventListener('selectstart', this.onSelectStart);
      this.controller1.addEventListener('selectend', this.onSelectEnd);
      this.controller1.addEventListener('squeezestart', this.onSqueezeStart);
      this.controller1.addEventListener('squeezeend', this.onSqueezeEnd);
      // this.tScene.add(this.controller1);
      rig.add(this.controller1);

      this.controller2 = renderer.xr.getController(1);
      this.controller2.addEventListener('connected', this.onConnected);
      this.controller2.addEventListener('selectstart', this.onSelectStart);
      this.controller2.addEventListener('selectend', this.onSelectEnd);
      this.controller2.addEventListener('squeezestart', this.onSqueezeStart);
      this.controller2.addEventListener('squeezeend', this.onSqueezeEnd);
      // this.tScene.add(this.controller2);
      rig.add(this.controller2);

      const controllerModelFactory = new XRControllerModelFactory();
      const handModelFactory = new XRHandModelFactory();
      handModelFactory.setPath('./generic-hand/');

      // Hand 1
      controllerGrip1 = renderer.xr.getControllerGrip(0);
      controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
      // this.tScene.add(controllerGrip1);
      rig.add(controllerGrip1);

      this.handR = renderer.xr.getHand(1);
      this.handR.addEventListener('pinchstart', this.onPinchStart);
      this.handR.addEventListener('pinchend', this.onPinchEnd);
      this.handR.add(handModelFactory.createHandModel(this.handR, 'mesh'));
      // this.tScene.add(this.handR);
      rig.add(this.handR);

      // Hand 2
      controllerGrip2 = renderer.xr.getControllerGrip(1);
      controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
      // this.tScene.add(controllerGrip2);
      rig.add(controllerGrip2);

      this.handL = renderer.xr.getHand(0);
      this.handL.addEventListener('pinchstart', this.onPinchStart);
      this.handL.addEventListener('pinchend', this.onPinchEnd);
      this.handL.add(handModelFactory.createHandModel(this.handL, 'mesh'));
      // this.tScene.add(this.handL);
      rig.add(this.handL);

      this.hands.push(this.handR, this.handL);

      // UI buttons handlers
      const defaultBgColor = document.getElementById("generateTree").style.backgroundColor;
      const defaultBgClickedColor = 'lightgray';

      const recalcMaxIterations = () => {
        let maxIterations = 2;
        switch(fractalTree.length) {
          case 1:
          case 2:
          case 3:
          case 4:
            maxIterations = 8;
            break;
          case 5:
            maxIterations = 7;
            break;
          case 6:
            maxIterations = 6;
            break;
          case 7:
            maxIterations = 5;
            break;
          case 8:
            maxIterations = 4;
            break;
          case 9:
            maxIterations = 3;
            break;
        }
        document.getElementById('rangeIterations').setAttribute('max', maxIterations);
        if(this.iterationsNo > maxIterations) {
          this.iterationsNo = maxIterations;
          document.getElementById('iterationsVal').textContent = maxIterations;
        }
      }

      document.getElementById("addBranch").onclick = (evt) => {
        if(this.anyButtonBlocked)
          return;
        this.anyButtonBlocked = true;
        playClickSound();
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;
        
        
        addBranch();
        recalcMaxIterations();

        // refresh movables array
        this.movables = Array.from(document.getElementsByClassName('movable'))
          .map((e, i) => {
            return e.object3D;
          });
        // show button pressed style
        let that = this;
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
          that.anyButtonBlocked = false;
        }, 500);
      };

      document.getElementById("removeBranch").onclick = (evt) => {
        if(this.anyButtonBlocked)
          return;
        this.anyButtonBlocked = true;
        playClickSound();
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;
        removeBranch();
        recalcMaxIterations();
        // refresh movables array
        this.movables = Array.from(document.getElementsByClassName('movable'))
          .map((e, i) => {
            return e.object3D;
          });
        let that = this;
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
          that.anyButtonBlocked = false;
        }, 500);
      };

      document.getElementById("removeAllBranches").onclick = (evt) => {
        if(this.anyButtonBlocked)
          return;
        this.anyButtonBlocked = true;        
        playClickSound();
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;
        removeAllBranches();
        // refresh movables array
        this.movables = Array.from(document.getElementsByClassName('movable'))
          .map((e, i) => {
            return e.object3D;
          });
        let that = this;
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
          that.anyButtonBlocked = false;
        }, 500);
      };

      // Worker for the fractals tree calculation
      const worker = new Worker('worker.js');
      const component = this;
      // Get worker result 
      worker.onmessage = function (event) {
        drawTree(event.data.lines);

        document.getElementById('statusText').innerHTML = 'Ready';
        document.getElementById("generateTree").style.backgroundColor = defaultBgColor;
        component.anyButtonBlocked = false;
        // place the scaled tree close to ui panel
        if(component.isImmersive) {
          const scaledTree = document.getElementById("scaled_tree").object3D;
          const uiPanel = document.getElementById("ui-panel");
          scaledTree.position.copy(uiPanel.object3D.getWorldPosition(new THREE.Vector3()));
          const adjustVector = new THREE.Vector3(0,1,0);
          adjustVector.multiplyScalar(0.4);
          scaledTree.position.add(adjustVector);
        }
      };

      const drawTree = (data) => {
        let aframeScene = document.querySelector("a-scene");
        let threeScene = aframeScene.object3D;
        let scaledTreeRoot = document.getElementById('scaled_tree');

        let levelColors = [];
        for (let l = 1; l < this.iterationsNo; l++) {
          levelColors.push('blue');
        }
        levelColors.push('white');
        
        data[0].push({x: 0, y: 0, z: 0}, {x: 0, y: 1, z: 0});

        data.forEach((levelData, lvl) => {

          let lg = new THREE.BufferGeometry().setFromPoints(levelData);
          let scaledLg = lg.clone().scale(0.1,0.1,0.1);
          let lm = new THREE.LineBasicMaterial({ color: levelColors[lvl] });
          let segment = new THREE.LineSegments(lg, lm);
          segments.push(segment);
          threeScene.add(segment);

          let scaledSegment = new THREE.LineSegments(scaledLg, lm);
          // Prevent rasycast checking for lines
          scaledSegment.raycast = function () {};
          scaledSegments.push(scaledSegment);
          scaledTreeRoot.object3D.add(scaledSegment);
        })
      };

      const playClickSound = () => {
        const head = document.getElementById("head");
        head.components.sound.playSound();
      }

      const generateTree = () => {
        let aframeScene = document.querySelector("a-scene");
        clearTree();
        let branches = [];
        fractalTree.forEach((branch) => {
          let forwarWorldPos = new THREE.Vector3();
          branch.object3D.getWorldPosition(forwarWorldPos);
          let perpWorldPos = new THREE.Vector3();
          branch.firstChild.object3D.getWorldPosition(perpWorldPos);
          branches.push([
            new THREE.Vector3(0, 1, 0),
            forwarWorldPos, // Y - forward vector 
            perpWorldPos, // X - right vector
            new THREE.Vector3(0, 1, 0)
          ]);
        })
        worker.postMessage({ 'base': base, 'branches': branches, 'iterations': this.iterationsNo });
      }
      // Run task in worker
      document.getElementById("generateTree").onclick = (evt) => {
        if(this.anyButtonBlocked)
          return;
        this.anyButtonBlocked = true;        
        playClickSound();
        evt.currentTarget.style.backgroundColor = defaultBgClickedColor;
        document.getElementById('statusText').innerHTML = 'Calculation';
        generateTree();
      };

      const randomTree = () => {
        presets[Math.floor(Math.random() * presets.length)].forEach((triangle) => {
          addBranch(null, triangle[1].clone(), triangle[2].clone(), true);
        });
      }

      document.getElementById("addRandomTree").onclick = (evt) => {
        if(this.anyButtonBlocked)
          return;
        this.anyButtonBlocked = true;
        playClickSound();
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;
        removeAllBranches();
        randomTree();
        // refresh movables array
        this.movables = Array.from(document.getElementsByClassName('movable'))
          .map((e, i) => {
            return e.object3D;
          });
        let that = this;  
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
          that.anyButtonBlocked = false;
        }, 500);
      };

      const clearTree = () => {
        let aframeScene = document.querySelector("a-scene");
        let threeScene = aframeScene.object3D;
        segments.forEach((s) => {
          threeScene.remove(s);
        });
        let scaledTreeRoot = document.getElementById('scaled_tree');
        scaledSegments.forEach((s) => {
          scaledTreeRoot.object3D.remove(s);
        });
      };
      

      document.getElementById("clearTree").onclick = (evt) => {
        if(this.anyButtonBlocked)
          return;
        this.anyButtonBlocked = true;        
        playClickSound();
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;

        clearTree();
        let that = this;
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
          that.anyButtonBlocked = false;
        }, 500);
      };

      const switchLightButtons = document.querySelectorAll('input[type="radio"][name="switchLight"]');
      switchLightButtons.forEach((btn) => {
        btn.addEventListener('click', function () {
          switchLight(this.value);
        });
      });

      const switchLight = (mode) => {
        document.getElementById("melody").components.sound.stopSound();
        const dayEnvironment = "lighting:none;preset:yavapai;skyType:atmosphere;";
        const nightEnvironment = "lighting:none;preset:starry;skyType:atmosphere;";

        const dirlightEl = document.getElementById('dirlight');
        const environmentEl = document.getElementById('environment');
        if (mode == 'day') {
          dirlightEl.setAttribute('intensity', '1');
          environmentEl.setAttribute('environment', dayEnvironment);
          document.getElementById("melody").setAttribute('sound', 'src: url(simple-piano-melody-9834.mp3); loop: true;');
        } else {
          dirlightEl.setAttribute('intensity', '0');
          environmentEl.setAttribute('environment', nightEnvironment);
          document.getElementById("melody").setAttribute('sound', 'src: url(sunrise_105.mp3); loop: true;');
        }
        if(this.isMusicOn) {
          document.getElementById("melody").components.sound.playSound();
        }
      }

      const setIterations = (val) => {
        document.getElementById("iterationsVal").innerText = val;
        this.iterationsNo = val;
      }

      document.getElementById("rangeIterations").addEventListener('input', function(event) {
        setIterations(event.target.value);
      });


      document.getElementById("exitXR").onclick = (evt) => {
        exitXR();
      }

      const exitXR = () => {
        let aframeScene = document.querySelector("a-scene");
        aframeScene.exitVR();
        this.isImmersive = false;
      }

      const showHelp = (evt) => {
        const helpObj = document.getElementById("help_obj").object3D;
        const helpObjBox = document.getElementById("help_obj_box").object3D;
        helpObj.visible = !helpObj.visible;
        helpObjBox.visible = helpObj.visible;
        if(helpObj.visible) {
          
          // position Help 3d model above ui-panel
          const uiPanel = document.getElementById('ui-panel');
          helpObjBox.scale.setScalar(0.3);
          helpObjBox.position.copy(uiPanel.object3D.getWorldPosition(new THREE.Vector3()));
          helpObjBox.quaternion.copy(uiPanel.object3D.getWorldQuaternion(new THREE.Quaternion()));
          
          // adjust 0.35 to up
          const adjustVector = new THREE.Vector3(0,0.35,0);
          adjustVector.applyQuaternion(helpObjBox.quaternion);
          helpObjBox.position.add(adjustVector);
        } 
      }


      document.getElementById("help").onclick = (evt) => {
        if(this.anyButtonBlocked)
          return;
        this.anyButtonBlocked = true;
        playClickSound();
        showHelp(evt);
        let that = this;        
        setTimeout(function () {
          that.anyButtonBlocked = false;
        }, 500);
      }

      const switchMusic = (mode) => {
          this.isMusicOn = mode == 'on';
          if(this.isMusicOn) {
            document.getElementById("melody").components.sound.playSound();
          } else {
            document.getElementById("melody").components.sound.stopSound();
          }
      }

      const switchMusicButtons = document.querySelectorAll('input[type="radio"][name="switchMusic"]');
      switchMusicButtons.forEach((btn) => {
        btn.addEventListener('click', function () {
          switchMusic(this.value);
        });
      });
      // --- fractal tree managment logic ---

      const drawLine = (points, color) => {
        let aframeScene = document.querySelector("a-scene");

        // Access the THREE.js scene
        let threeScene = aframeScene.object3D;
        points = [points[0], points[1]];
        let lg = new THREE.BufferGeometry().setFromPoints(points);
        const lm = new THREE.LineBasicMaterial({ color: color });
        let line = new THREE.Line(lg, lm);
        threeScene.add(line);
        return line;
      }

      const addBranch = (event, branchPos = new THREE.Vector3(0, 1.5, 0),
        branchPerpPos = new THREE.Vector3(0.25, -0.5, 0), perpAbs = false) => {

        const scene = document.querySelector('a-scene');
        const originalEntity = document.getElementById('branch_');

        const clonedEntity = cloneWithChildren(originalEntity);
        clonedEntity.setAttribute('ind', fractalTree.length + 1);
        clonedEntity.classList.add('movable');
        clonedEntity.object3D.position.copy(branchPos);
        let perp = clonedEntity.getChildren().find((el) => el.id.startsWith('branch_perp_'));
        perp.classList.add('movable');
        perp.setAttribute('ind', fractalTree.length + 1);
        if (perpAbs) {
          branchPerpPos.sub(branchPos);
        }
        perp.object3D.position.copy(branchPerpPos);
        perp.setAttribute('position',
          '' + branchPerpPos.x + ' ' + branchPerpPos.y + ' ' + branchPerpPos.z);
        clonedEntity.setAttribute('id', originalEntity.id + (fractalTree.length + 1));
        // clonedEntity.setAttribute('position', '0 1.5 0');

        fractalTree.push(clonedEntity);
        scene.appendChild(clonedEntity);
        addBranchTriangle(clonedEntity);
      }

      const cloneWithChildren = (originalEntity) => {
        const attrsToCopy = ['position', 'rotation'];
        const clonedEntity = originalEntity.cloneNode(true);
        for (const originalChild of originalEntity.children) {
          let clonedChild = [...clonedEntity.children].find((c) => c.getAttribute('id') == originalChild.getAttribute('id'));
          attrsToCopy.forEach((a) => clonedChild.setAttribute(a, originalChild.getAttribute(a)));
          clonedChild.id = clonedChild.id + (fractalTree.length + 1);
        }
        return clonedEntity;
      }

      const addBranchTriangle = (newBranch) => {
        let tempV3 = new THREE.Vector3();
        let lines = [];
        const ind = newBranch.getAttribute('ind');
        let perpEntity = document.getElementById('branch_perp_' + ind);
        perpEntity.object3D.getWorldPosition(tempV3);
        lines.push(drawLine([fractalRootOrigin, newBranch.object3D.position], 'blue'));
        lines.push(drawLine([fractalRootOrigin, tempV3], 'green'));
        let yellowLine = drawLine([newBranch.object3D.position, tempV3], 'yellow');
        yellowLine.visible = false;
        lines.push(yellowLine);
        branchTriangles.set(parseInt(newBranch.getAttribute('ind')), lines);


        // TODO add mesh triangle entity

        let points = [fractalRootOrigin, newBranch.object3D.position, tempV3];
        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        geometry.computeVertexNormals(); // TODO check if this is required

        const material = new THREE.MeshBasicMaterial({
          // TODO choose way for transparency
          // alphaMap: this.triangleMeshTexture,
          opacity: 0.1,
          transparent: true,
          side: THREE.DoubleSide,
          // alphaTest: 0.5,
          depthWrite: false

        });
        const meshTriangle = new THREE.Mesh(geometry, material)
        branchMeshTriangles.set(parseInt(newBranch.getAttribute('ind')), meshTriangle);
        this.tScene.add(meshTriangle);
      }



      // Remove the last branch from the tree
      const removeBranch = () => {
        const scene = document.querySelector('a-scene');
        let threeScene = scene.object3D;
        const indexOfLast = fractalTree.length;
        // remote lines of a branch triangle
        if (branchTriangles.has(indexOfLast)) {
          const triangle = branchTriangles.get(indexOfLast);
          triangle.forEach((line) => {
            threeScene.remove(line);
          });
          branchTriangles.delete(indexOfLast);
        }
        if (branchMeshTriangles.has(indexOfLast)) {
          threeScene.remove(branchMeshTriangles.get(indexOfLast));
          branchMeshTriangles.delete(indexOfLast);
        }
        const entityToRemove = fractalTree.pop();
        if (entityToRemove)
          entityToRemove.remove();
      }

      const removeAllBranches = () => {
        const cnt = fractalTree.length;
        for (let i = 0; i < cnt; i++) {
          removeBranch();
        }
      }

      // update triangle position for currently moved branch points
      this.redrawTriangle = () => {
        let selectedL = null;
        let selectedR = null;
        if (this.isControlleraHand) {
          selectedL = this.handL.userData.selected;
          selectedR = this.handR.userData.selected;
        } else {
          selectedL = this.controller1.userData.selected;
          selectedR = this.controller2.userData.selected;
        }
        if (selectedL
          && (selectedL.el.classList.contains('branch')
            || selectedL.el.classList.contains('branch_perp'))) {
          redrawTriangleByInd(parseInt(selectedL.el.getAttribute('ind')));
        }
        if (selectedR
          && (selectedR.el.classList.contains('branch')
            || selectedR.el.classList.contains('branch_perp'))) {
          redrawTriangleByInd(parseInt(selectedR.el.getAttribute('ind')));
        }
      }

      const redrawTriangleByInd = (ind) => {
        let triangle = branchTriangles.get(ind);
        let meshTriangle = branchMeshTriangles.get(ind);
        if (!(triangle && meshTriangle))
          return;
        let forwardEntity = document.getElementById('branch_' + ind);
        let perpEntity = document.getElementById('branch_perp_' + ind);
        let forwardLine = triangle[0];

        forwardEntity.object3D.getWorldPosition(this.tempV32);
        forwardLine.geometry.attributes.position.setXYZ(1,
          this.tempV32.x, this.tempV32.y, this.tempV32.z);
        forwardLine.geometry.attributes.position.needsUpdate = true;

        let hipoLine = triangle[2];
        hipoLine.geometry.attributes.position.setXYZ(0,
          this.tempV32.x, this.tempV32.y, this.tempV32.z);
        hipoLine.geometry.attributes.position.setXYZ(1,
          this.tempV32.x, this.tempV32.y, this.tempV32.z);
        hipoLine.geometry.attributes.position.needsUpdate = true;

        perpEntity.object3D.getWorldPosition(this.tempV33);
        let perpLine = triangle[1];
        perpLine.geometry.attributes.position.setXYZ(1,
          this.tempV33.x, this.tempV33.y, this.tempV33.z);
        perpLine.geometry.attributes.position.needsUpdate = true;

        // half transparent triangle vertexes position change
        meshTriangle.geometry.attributes.position.setXYZ(1,
          this.tempV32.x, this.tempV32.y, this.tempV32.z);
        meshTriangle.geometry.attributes.position.setXYZ(2,
          this.tempV33.x, this.tempV33.y, this.tempV33.z);
        meshTriangle.geometry.attributes.position.needsUpdate = true;

        // branchTrTriangles.get(1).geometry.attributes.position
        // branchTrTriangles.get(1).geometry.attributes.position.array

      }

    });
  },
  getTexture() {
    const canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    ctx.fillStyle = '#404040';
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  },
  onPinchStart(event) {
    const controller = event.target;
    controller.updateMatrixWorld();
    const indexTip = controller.joints['index-finger-tip'];
    const handWrist = controller.joints['wrist'];
    const object = this.collideObject(indexTip);
    if (object && !controller.userData.selected) {

      controller.userData.selected = object;
      if (event.handedness == 'right') {
        this.squeezedByRight = (object.el.classList.contains('branch')
          || object.el.classList.contains('branch_perp'));
      }
      if (event.handedness == 'left') {
        this.squeezedByLeft = (object.el.classList.contains('branch')
          || object.el.classList.contains('branch_perp'));
      }

      if (object.el.id != 'help_obj_box') {
        handWrist.attach(object);
      } else {
        // TODO fix this, now it is not work
        // two pinches at the same time for help box scaling
        if (this.handL.userData.selected == object 
            && this.handR.userData.selected == object) {
          console.log('both pinched');
          if (this.helpBoxScaleDistance == null) {
            this.helpBoxScaleDistance = this.handL.joints['wrist'].position
              .distanceTo(this.handR.joints['wrist'].position);
          }
          // document.getElementById('help_obj_box').object3D.scale.set(2,2,2);
        } else {
          this.helpBoxScaleDistance = null;
        }
        // TODO if the other hand has already selected = help_obj_box keep it
        // don't reattach it to the current
        if (event.handedness == 'right') {
          if (this.handL.userData.selected) {
            if (this.handL.userData.selected.el.id != 'help_obj_box')
              handWrist.attach(object);
          } else {
            handWrist.attach(object);
          }

        }
        if (event.handedness == 'left') {
          if (this.handR.userData.selected) {
            if (this.handR.userData.selected.el.id != 'help_obj_box')
              handWrist.attach(object);
          } else {
            handWrist.attach(object);
          }
        }

      }

    }

  },
  collideObject(indexTip) {
    for (let sphereInd in this.movables) {
      let movable = this.movables[sphereInd];


      if (movable.el.id == 'ui-panel') {
        if (this.calculateUiBoundBox(movable, indexTip)) {
          return movable;
        } else {
          continue;
        }
      }

      // Help (3d model) surrounding box
      if (movable.el.id == 'help_obj_box') {
        let helpBoxMeshes = movable.children.filter(ch => ch.el.id === 'help_obj_box');
        if (!helpBoxMeshes)
          continue;
        let helpBoxMesh = helpBoxMeshes[0];
        helpBoxMesh.geometry.computeBoundingBox();

        // console.log('bb: ' + helpBoxMesh.geometry.boundingBox);
        // this.drawLine([helpBoxMesh.geometry.boundingBox.min, helpBoxMesh.geometry.boundingBox.max], 'yellow');
        if (this.checkBoundedBoxCollision(helpBoxMesh, indexTip.getWorldPosition(this.tmpVector1))) {
          return movable;
        } else {
          continue;
        }
      }

      const distance = indexTip.getWorldPosition(this.tmpVector1)
        .distanceTo(movable.getWorldPosition(this.tmpVector2));
      if (distance < movable.el.getAttribute('radius') * movable.scale.x) {
        return movable;
      }
    }
    return null;
  },
  checkBoundedBoxCollision(boxMesh, indexTip) {
    // 1. calc positions of all vertexes 
    // let boxCenter = boxMesh.el.object3D.position;
    let boxCenter = boxMesh.el.object3D.getWorldPosition(new THREE.Vector3());
    let d = boxMesh.geometry.parameters.depth;
    let h = boxMesh.geometry.parameters.height;
    let w = boxMesh.geometry.parameters.width;

    // use the scale factor
    w = w * boxMesh.el.object3D.scale.x;
    h = h * boxMesh.el.object3D.scale.y;
    d = d * boxMesh.el.object3D.scale.z;

    // fill box vertexes
    const points = Array(8).fill(null).map(() => {
      return new THREE.Vector3(0, 0, 0).clone()
    });
    points[0].add(new THREE.Vector3(0, h / 2, 0)).add(new THREE.Vector3(w / 2, 0, 0));
    points[1].add(new THREE.Vector3(0, - h / 2, 0)).add(new THREE.Vector3(w / 2, 0, 0));
    points[2].add(new THREE.Vector3(0, - h / 2, 0)).add(new THREE.Vector3(- w / 2, 0, 0));
    points[3].add(new THREE.Vector3(0, h / 2, 0)).add(new THREE.Vector3(- w / 2, 0, 0));
    // fill box vertexes
    for (let i = 0; i < 4; i++) {
      points[i].add(new THREE.Vector3(0, 0, d / 2));
      points[i + 4] = points[i].clone().sub(new THREE.Vector3(0, 0, d));
    }

    points.forEach((p) => {
      p.applyQuaternion(boxMesh.el.object3D.quaternion);
      p.add(boxCenter);
    });


    // this.drawLine([points[6], points[5]], 'green');
    // this.drawLine([points[6], points[7]], 'blue');
    // this.drawLine([points[6], points[2]], 'red');
    // 2. check if sum of all distancies between vertexes and indexTip
    //    close to the value of perimeter of the movable box geometry

    // move all points to 0,0,0  let be start point 6
    let startPoint = points[6].clone();
    points.forEach((p) => {
      p.sub(startPoint);
    });
    let checkPoint = indexTip.clone();
    checkPoint.sub(startPoint);

    // aligning the vector of points 6 - 5 with X axis
    let zeroPoint = new THREE.Vector3(0, 0, 0);
    let xVector = new THREE.Vector3(1, 0, 0);
    let alignAngle = xVector.angleTo(points[5]);
    let perpsAxis = zeroPoint.crossVectors(xVector, points[5]).normalize();
    let qRotation = new THREE.Quaternion();
    qRotation.setFromAxisAngle(perpsAxis, -alignAngle);
    let alignMatrix = new THREE.Matrix4();
    alignMatrix.makeRotationFromQuaternion(qRotation);
    points.forEach((point) => {
      point.applyMatrix4(alignMatrix);
    });
    checkPoint.applyMatrix4(alignMatrix);

    // aligning the vector of points 6 - 7 with Y axis
    let yVector = new THREE.Vector3(0, 1, 0);
    alignAngle = yVector.angleTo(points[7]);

    qRotation = new THREE.Quaternion();
    qRotation.setFromAxisAngle(xVector, alignAngle);
    alignMatrix = new THREE.Matrix4();
    alignMatrix.makeRotationFromQuaternion(qRotation);
    points.forEach((point) => {
      point.applyMatrix4(alignMatrix);
    });
    checkPoint.applyMatrix4(alignMatrix);


    // this.drawLine([checkPoint, points[5]], 'yellow');
    // this.drawLine([points[6], points[5]], 'green');
    // this.drawLine([points[6], points[7]], 'blue');
    // this.drawLine([points[6], points[2]], 'red');

    if (checkPoint.x > 0 && checkPoint.x < points[5].x
      && checkPoint.y > 0 && checkPoint.y < points[7].y
      && checkPoint.z > 0 && checkPoint.z < points[2].z
    ) return true;

    return false;
  },

  // Check if tip of index finger is close to the ui panel.
  calculateUiBoundBox(movable, indexTip) {
    if(!indexTip) {
      return false;
    }
    const panelMesh = movable.children[0];
    let h = panelMesh.geometry.parameters.height;
    let w = panelMesh.geometry.parameters.width;
    let d = 0.04; // depth

    let tipPos = indexTip.getWorldPosition(this.tmpVector1);
    tipPos.sub(movable.position);
    tipPos.applyQuaternion(movable.quaternion.clone().invert());

    tipPos.x += w / 2;
    tipPos.y += h / 2;
    tipPos.z += d / 2;

    let condition = tipPos.x > 0 && tipPos.y > 0 && tipPos.z > 0
      && tipPos.x < w && tipPos.y < h && tipPos.z < d;
    return condition;
  },
  onPinchEnd(event) {
    if (event.handedness == 'right') {
      this.squeezedByRight = false;
    }
    if (event.handedness == 'left') {
      this.squeezedByLeft = false;
    }
    const controller = event.target;
    if (controller.userData.selected !== undefined) {
      const object = controller.userData.selected;
      this.tScene.attach(object);
      controller.userData.selected = undefined;
      this.spherePos = null;
    }
    this.helpBoxScaleDistance = null;
  },
  // check controllers mode switching (hand <-> controllers)
  onConnected(event) {
    console.log('connected');
    if (event.data.hand) {
      this.isControlleraHand = true;
    } else {
      this.isControlleraHand = false;
    }
    let rhel = document.getElementById('right-hand');
    this.controller1.add(rhel.object3D);
    let lhel = document.getElementById('left-hand');
    this.controller2.add(lhel.object3D);

    let rayCasterRCfg = rhel.getAttribute('raycaster');
    let rayCasterLCfg = lhel.getAttribute('raycaster');
    if (this.isControlleraHand) {
      rayCasterRCfg['enabled'] = false; // TODO check if it works
      rayCasterRCfg['showLine'] = false;
      rayCasterLCfg['enabled'] = false; // TODO check if it works
      rayCasterLCfg['showLine'] = false;
    } else {
      rayCasterRCfg['lineColor'] = 'white';
      rayCasterRCfg['far'] = 10;
      rayCasterRCfg['enabled'] = true;
      rayCasterRCfg['showLine'] = true;
      rayCasterLCfg['lineColor'] = 'white';
      rayCasterLCfg['far'] = 10;
      rayCasterLCfg['enabled'] = true;
      rayCasterLCfg['showLine'] = true;
    }
    rhel.setAttribute('raycaster', rayCasterRCfg);
    lhel.setAttribute('raycaster', rayCasterLCfg);

  },
  onSelectStart(event) {
    return;
    if (this.isControlleraHand)
      return;
    const controller = event.target;
    const intersections = this.getIntersections(controller);
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const object = intersection.object;

      // if(object &&
      //   object.material &&
      //   object.material.emissive && 
      //   object.material.emissive.b) {
      //     object.material.emissive.b = 1;
      //   }
      // controller.attach(object.parent);
      // controller.userData.selected = object.parent;
      // controller.userData.selectedParent = object.parent.parent;
    }
    controller.userData.targetRayMode = event.data.targetRayMode;
  },
  onSqueezeStart(event) {
    if (this.isControlleraHand)
      return;
    const controller = event.target;
    const intersections = this.getIntersections(controller);
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const object = intersection.object;

      if (object &&
        object.material &&
        object.material.emissive &&
        object.material.emissive.b) {
        object.material.emissive.b = 1;
      }
      controller.attach(object.parent);
      controller.userData.selected = object.parent;
      controller.userData.selectedParent = object.parent.parent;
    }
    controller.userData.targetRayMode = event.data.targetRayMode;
    if (event.data.handedness == 'right') {
      this.squeezedByRight = true;
    }
    if (event.data.handedness == 'left') {
      this.squeezedByLeft = true;
    }
  },
  getIntersections(controller) {
    controller.updateMatrixWorld();
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, - 1).applyMatrix4(this.tempMatrix);
    return this.raycaster.intersectObjects(this.movables);
  },
  onSelectEnd(event) {
    if (this.isControlleraHand)
      return;
    const controller = event.target;
    if (controller.userData.selected !== undefined) {
      const selectedObject = controller.userData.selected;
      if (
        selectedObject &&
        selectedObject.children &&
        selectedObject.children[0] &&
        selectedObject.children[0].material &&
        selectedObject.children[0].material.emissive
      ) {
        selectedObject.children[0].material.emissive.b = 0;
      }
      this.tScene.attach(selectedObject);
      controller.userData.selected = undefined;
    }
  },
  onSqueezeEnd(event) {
    if (this.isControlleraHand)
      return;
    if (event.handedness == 'right') {
      this.squeezedByRight = false;
    }
    if (event.handedness == 'left') {
      this.squeezedByLeft = false;
    }
    const controller = event.target;
    if (controller.userData.selected !== undefined) {
      const selectedObject = controller.userData.selected;
      if (
        selectedObject &&
        selectedObject.children &&
        selectedObject.children[0] &&
        selectedObject.children[0].material &&
        selectedObject.children[0].material.emissive
      ) {
        selectedObject.children[0].material.emissive.b = 0;
      }
      this.tScene.attach(selectedObject);
      controller.userData.selected = undefined;
    }
  },

  everySecond: function () {
    if (this.isControlleraHand) {
      // Check if the tip of the index finger is close to the UI panel
      let tipIsInTheBox =
        this.calculateUiBoundBox(this.uiPanel.object3D, this.handR.joints['index-finger-tip'])
        || this.calculateUiBoundBox(this.uiPanel.object3D, this.handL.joints['index-finger-tip']);
      if (tipIsInTheBox) {
        document.getElementById('my-interface').style.background = 'antiquewhite';
        if (!this.isClickedByTip) {
          this.isClickedByTip = this.clickByTip(this.handR.joints['index-finger-tip'])
            || this.clickByTip(this.handL.joints['index-finger-tip']);
        }
      } else {
        document.getElementById('my-interface').style.background = 'lavenderblush';
        this.isClickedByTip = false;


        // middle finger pinch detected
        // move ui-panel to the hand place
        let rmt = this.handR.joints['middle-finger-tip'];
        let rtt = this.handR.joints['thumb-tip'];
        let lmt = this.handL.joints['middle-finger-tip'];
        let ltt = this.handL.joints['thumb-tip'];

        let dtR = 100;
        let dtL = 100;

        if(rmt && rtt) {
          dtR = rmt.position.distanceTo(rtt.position);
        }
        if(lmt && ltt) {
          dtL = lmt.position.distanceTo(ltt.position);
        }

        let middlePinchTreshold = 0.015;
        // let middlePinchTreshold = 0.05; // for testing


        if (rmt && dtR < middlePinchTreshold) {
          // right middle pinch detected
          this.repositionUiPanel(rmt.position.clone());
        }

        if (lmt && dtL < middlePinchTreshold) {
          // left middle pinch detected
          this.repositionUiPanel(lmt.position.clone());
        }
      }

      // both hand pinch
      if (this.helpBoxScaleDistance) {
        let pinchesDistance = this.handL.joints['wrist'].position
          .distanceTo(this.handR.joints['wrist'].position);
        let oldScale = document.getElementById('help_obj_box').object3D.scale.x;
        let newScale = oldScale * pinchesDistance / this.helpBoxScaleDistance;
        this.helpBoxScaleDistance = pinchesDistance;
        // document.getElementById('statusText').innerHTML = 'newScale: ' + newScale;
        document.getElementById('help_obj_box').object3D.scale.set(newScale, newScale, newScale);
      }

    }
  },
  repositionUiPanel(fingerPos) {
    // TODO left eye problem
    const rig = document.getElementById('rig');
    const uiPanel = document.getElementById('ui-panel');

    const camPos = this.el.sceneEl.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
    const worldFingerPos = fingerPos.add(rig.object3D.position);
    const additionalDistance = new THREE.Vector3().copy(worldFingerPos);
    additionalDistance.sub(camPos).normalize().multiplyScalar(0.15);

    uiPanel.object3D.position.copy(worldFingerPos.add(additionalDistance));
    uiPanel.object3D.lookAt(camPos);
  },
  clickByTip(indexTip) {
    // calculating x,y coordinates of the point of ui-panel touching in percentage
    let h = this.uiPanel.object3D.children[0].geometry.parameters.height;
    let w = this.uiPanel.object3D.children[0].geometry.parameters.width;
    let localTipPos = indexTip.getWorldPosition(this.tmpVector1);
    localTipPos.sub(this.uiPanel.object3D.position);
    localTipPos.applyQuaternion(this.uiPanel.object3D.quaternion.clone().invert());

    // if the finger tip is really close to the ui panel surface
    if (Math.abs(localTipPos.z) > 0.01)
      return false;

    let uv = {};
    uv.x = (w / 2 + localTipPos.x) / w;
    uv.y = (h / 2 + localTipPos.y) / h;
    this.uiPanel.getObject3D('html')
      .dispatchEvent({ type: 'click', data: new THREE.Vector2(uv.x, 1 - uv.y) });

    return true;
  },
  drawLine(points, color) {
    let aframeScene = document.querySelector("a-scene");

    // Access the THREE.js scene
    let threeScene = aframeScene.object3D;
    points = [points[0], points[1]];
    let lg = new THREE.BufferGeometry().setFromPoints(points);
    const lm = new THREE.LineBasicMaterial({ color: color });
    let line = new THREE.Line(lg, lm);
    threeScene.add(line);
    return line;
  },
  tick() {
    this.throttledFunction();

    // The branch sphere is squeezed or pinched
    if (this.squeezedByRight || this.squeezedByLeft) {
      this.redrawTriangle();
    }
  }
});
