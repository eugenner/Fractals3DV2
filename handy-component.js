import { XRControllerModelFactory } from './node_modules/super-three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from './node_modules/super-three/examples/jsm/webxr/XRHandModelFactory.js';

import { RandomTreeData } from './random-tree.js';

const fractalRootOrigin = new THREE.Vector3(0, 1, 0);
let fractalTree = [];
let branchTriangles = new Map(); // array of lines: [ind, [orig-forward, orig-perp, forward-perp]]
let lines = []; // lines of the tree
let segments = []; // lines of the tree
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

    this.throttledFunction = AFRAME.utils.throttle(this.everySecond, 100, this);


    this.tmpVector1 = new THREE.Vector3();
    this.tmpVector2 = new THREE.Vector3();
    this.tempV3 = new THREE.Vector3();
    this.tempV32 = new THREE.Vector3();

    this.movables = [];
    this.hands = [];


    this.raycaster = new THREE.Raycaster();
    this.intersected = [];
    this.tempMatrix = new THREE.Matrix4();

    this.controls;

    this.uiPanel = null;
    this.tipIsInTheBox = false;
    this.isClickedByTip = false;

    this.squeezedEl = null;
    this.squeezedByRight = false; // by Hand or Controller
    this.squeezedByLeft = false;

    this.onPinchStart = this.onPinchStart.bind(this);
    this.onPinchEnd = this.onPinchEnd.bind(this);
    this.onConnected = this.onConnected.bind(this);
    this.onSelectStart = this.onSelectStart.bind(this);
    this.onSelectEnd = this.onSelectEnd.bind(this);
    this.onSqueezeStart = this.onSqueezeStart.bind(this);
    this.onSqueezeEnd = this.onSqueezeEnd.bind(this);

    const presets = [];

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

    this.el.sceneEl.addEventListener('loaded', () => {


      this.uiPanel = document.getElementById('ui-panel');

      this.movables = Array.from(document.getElementsByClassName('movable'))
        .map((e, i) => {
          return e.object3D;
        });


      this.tScene = this.el.sceneEl.object3D;

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
      this.tScene.add(this.controller1);

      this.controller2 = renderer.xr.getController(1);
      this.controller2.addEventListener('connected', this.onConnected);
      this.controller2.addEventListener('selectstart', this.onSelectStart);
      this.controller2.addEventListener('selectend', this.onSelectEnd);
      this.controller2.addEventListener('squeezestart', this.onSqueezeStart);
      this.controller2.addEventListener('squeezeend', this.onSqueezeEnd);
      this.tScene.add(this.controller2);

      const controllerModelFactory = new XRControllerModelFactory();
      const handModelFactory = new XRHandModelFactory();
      // handModelFactory.setPath('./assets/');

      // Hand 1
      controllerGrip1 = renderer.xr.getControllerGrip(0);
      controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
      this.tScene.add(controllerGrip1);

      this.handR = renderer.xr.getHand(1);
      this.handR.addEventListener('pinchstart', this.onPinchStart);
      this.handR.addEventListener('pinchend', this.onPinchEnd);
      this.handR.add(handModelFactory.createHandModel(this.handR, 'mesh'));
      this.tScene.add(this.handR);

      // Hand 2
      controllerGrip2 = renderer.xr.getControllerGrip(1);
      controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
      this.tScene.add(controllerGrip2);

      this.handL = renderer.xr.getHand(0);
      this.handL.addEventListener('pinchstart', this.onPinchStart);
      this.handL.addEventListener('pinchend', this.onPinchEnd);
      this.handL.add(handModelFactory.createHandModel(this.handL, 'mesh'));
      this.tScene.add(this.handL);

      this.hands.push(this.handR, this.handL);

      // UI buttons handlers
      const defaultBgColor = document.getElementById("generateTree").style.backgroundColor;
      const defaultBgClickedColor = 'lightgray';


      document.getElementById("addBranch").onclick = (evt) => {
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;
        addBranch();
        // refresh movables array
        this.movables = Array.from(document.getElementsByClassName('movable'))
          .map((e, i) => {
            return e.object3D;
          });
        // show button pressed style
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
        }, 300);
      };

      document.getElementById("removeBranch").onclick = (evt) => {
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;
        removeBranch();
        // refresh movables array
        this.movables = Array.from(document.getElementsByClassName('movable'))
          .map((e, i) => {
            return e.object3D;
          });
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
        }, 300);
      };

      document.getElementById("removeAllBranches").onclick = (evt) => {
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;
        removeAllBranches();
        // refresh movables array
        this.movables = Array.from(document.getElementsByClassName('movable'))
          .map((e, i) => {
            return e.object3D;
          });
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
        }, 300);
      };

      // Worker for the fractals three calculation
      const worker = new Worker('worker.js');

      // Get worker result 
      worker.onmessage = function (event) {
        drawTree(event.data.lines);

        document.getElementById('statusText').innerHTML = 'Ready';
        document.getElementById("generateTree").style.backgroundColor = defaultBgColor;
      };

      const drawTree = (data) => {
        let aframeScene = document.querySelector("a-scene");
        let threeScene = aframeScene.object3D;

        let maxLevel = 3; // TODO setup this from UI
        let levelColors = [];
        for (let l = 0; l <= maxLevel; l++) {
          levelColors.push(new THREE.Color(0x0000FF));
        }
        levelColors.push(new THREE.Color(0xFFFFFF));

        data.forEach((levelData, lvl) => {
          let lg = new THREE.BufferGeometry().setFromPoints(levelData);
          const lm = new THREE.LineBasicMaterial({ color: levelColors[lvl] });
          let segment = new THREE.LineSegments(lg, lm);
          segments.push(segment);
          threeScene.add(segment);
        })
      };

      // TODO should be THREE.LineSegments used?
      const drawTree2 = () => {
        let aframeScene = document.querySelector("a-scene");
        let threeScene = aframeScene.object3D;
        let lg = new THREE.BufferGeometry().setFromPoints(fractalTreePairsPoints);
        const lm = new THREE.LineBasicMaterial({ vertexColors: true });
        const colors = new Float32Array(fractalTreePairsPointsColor.flatMap(c => c.toArray()));
        lg.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        let segment = new THREE.LineSegments(lg, lm);
        segment.material.depthTest = false;
        segments.push(segment);
        threeScene.add(segment);
      }

      const generateTree = () => {
        let aframeScene = document.querySelector("a-scene");
        let threeScene = aframeScene.object3D;
        lines.forEach((l) => {
          threeScene.remove(l);
        });
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
        // drawFractal(base, branches, 1);
        worker.postMessage({ 'base': base, 'branches': branches });
      }
      // Run task in worker
      document.getElementById("generateTree").onclick = (evt) => {
        evt.currentTarget.style.backgroundColor = defaultBgClickedColor;
        document.getElementById('statusText').innerHTML = 'Calculation';
        generateTree();
      };

      const randomTree = () => {
        presets[Math.floor(Math.random() * presets.length)].forEach((triangle) => {
          addBranch(null, triangle[1], triangle[2], true);
        });
      }

      document.getElementById("addRandomTree").onclick = (evt) => {
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;
        removeAllBranches();
        randomTree();
        // refresh movables array
        this.movables = Array.from(document.getElementsByClassName('movable'))
          .map((e, i) => {
            return e.object3D;
          });
        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
        }, 300);
      };

      const clearTree = () => {
        let aframeScene = document.querySelector("a-scene");
        let threeScene = aframeScene.object3D;
        segments.forEach((s) => {
          threeScene.remove(s);
        });
      };

      document.getElementById("clearTree").onclick = (evt) => {
        const el = evt.currentTarget;
        el.style.backgroundColor = defaultBgClickedColor;

        clearTree();

        setTimeout(function () {
          el.style.backgroundColor = defaultBgColor;
        }, 300);
      };

      const switchLightButtons = document.querySelectorAll('input[type="radio"][name="switchLight"]');
      switchLightButtons.forEach((btn) => {
        btn.addEventListener('click', function () {
          switchLight(this.value);
        });
      });

      const switchLight = (mode) => {
        const dayEnvironment = "lighting:none;preset:yavapai;skyType:atmosphere;";
        const nightEnvironment = "lighting:none;preset:starry;skyType:atmosphere;";

        const dirlightEl = document.getElementById('dirlight');
        const environmentEl = document.getElementById('environment');
        if (mode == 'day') {
          dirlightEl.setAttribute('intensity', '1');
          environmentEl.setAttribute('environment', dayEnvironment);
        } else {
          dirlightEl.setAttribute('intensity', '0');
          environmentEl.setAttribute('environment', nightEnvironment);
        }

      }

      document.getElementById("exitXR").onclick = (evt) => {
        exitXR();
      }

      const exitXR = () => {
        let aframeScene = document.querySelector("a-scene");
        aframeScene.exitVR();
      }

      // fractal tree managment logic


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
        clonedEntity.object3D.position.copy(branchPos);
        let perp = clonedEntity.getChildren().find((el) => el.id.startsWith('branch_perp_'));
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
        lines.push(drawLine([newBranch.object3D.position, tempV3], 'yellow'));
        branchTriangles.set(parseInt(newBranch.getAttribute('ind')), lines);
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

      // update triangle position for current moving branch points
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
        if (!triangle)
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

        perpEntity.object3D.getWorldPosition(this.tempV32);
        let perpLine = triangle[1];
        perpLine.geometry.attributes.position.setXYZ(1,
          this.tempV32.x, this.tempV32.y, this.tempV32.z);
        perpLine.geometry.attributes.position.needsUpdate = true;

        hipoLine.geometry.attributes.position.setXYZ(1,
          this.tempV32.x, this.tempV32.y, this.tempV32.z);
        hipoLine.geometry.attributes.position.needsUpdate = true;
      }

    });
  },
  onPinchStart(event) {
    const controller = event.target;
    controller.updateMatrixWorld();
    const indexTip = controller.joints['index-finger-tip'];
    const handWrist = controller.joints['wrist'];
    const object = this.collideObject(indexTip);
    if (object && !controller.userData.selected) {
      handWrist.attach(object);
      controller.userData.selected = object;
      if (event.handedness == 'right') {
        this.squeezedByRight = (object.el.classList.contains('branch')
          || object.el.classList.contains('branch_perp'));
      }
      if (event.handedness == 'left') {
        this.squeezedByLeft = (object.el.classList.contains('branch')
          || object.el.classList.contains('branch_perp'));
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

      const distance = indexTip.getWorldPosition(this.tmpVector1)
        .distanceTo(movable.getWorldPosition(this.tmpVector2));
      if (distance < movable.el.getAttribute('radius') * movable.scale.x) {
        return movable;
      }
    }
    return null;
  },
  // Check if tip of index finger is close to the ui panel.
  calculateUiBoundBox(movable, indexTip) {
    let h = movable.children[0].geometry.parameters.height;
    let w = movable.children[0].geometry.parameters.width;
    let d = 0.01; // depth
    let diag = Math.sqrt(Math.pow(h, 2) + Math.pow(w, 2) + Math.pow(d, 2)) + 0.03;
    const points = Array(8).fill(null).map(() => { return new THREE.Vector3(0, 0, 0).clone() });
    let v1 = new THREE.Vector3(0, 0, 0);
    let v2 = new THREE.Vector3(0, 0, 0);
    const perpendicularVector = new THREE.Vector3();

    points[0].add(new THREE.Vector3(0, h / 2, 0))
      .add(new THREE.Vector3(w / 2, 0, 0));
    points[1].add(new THREE.Vector3(0, - h / 2, 0))
      .add(new THREE.Vector3(w / 2, 0, 0));
    points[2].add(new THREE.Vector3(0, - h / 2, 0))
      .add(new THREE.Vector3(- w / 2, 0, 0));
    points[3].add(new THREE.Vector3(0, h / 2, 0))
      .add(new THREE.Vector3(- w / 2, 0, 0));


    for (let i = 0; i < 4; i++) {
      points[i].applyQuaternion(movable.quaternion);
    }


    v1.copy(points[0]);
    v2.copy(points[1]);

    const perp = perpendicularVector.crossVectors(v1, v2).normalize().multiplyScalar(d);

    // TODO
    // this.drawLine([movable.position, perp.clone().multiplyScalar(10).add(movable.position)], 'blue');

    for (let i = 4; i < 8; i++) {
      points[i].add(points[i - 4]).add(perp);
    }

    let tipPos = indexTip.getWorldPosition(this.tmpVector1);
    tipPos.sub(movable.position);
    points.forEach(point => {
      point.distance = tipPos.distanceTo(point);
    });
    let minDist = points.reduce((min, current) =>
      (current.distance < min ? current.distance : min), points[0].distance);
    let maxDist = points.reduce((max, current) =>
      (current.distance > max ? current.distance : max), points[0].distance);
    let sumD = minDist + maxDist;

    // The idea that next condition will work:
    // parallepiped diagonal nearly equal sum of one shortest and one longest distancies 
    // from tip of finger to all 8 points

    return (sumD < diag);
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

    let rayCasterCfg = rhel.getAttribute('raycaster');
    if (this.isControlleraHand) {
      // rayCasterCfg['lineColor'] = 'green';
      // rayCasterCfg['far'] = 0.1;
      rayCasterCfg['enabled'] = false; // TODO check if it works
      rayCasterCfg['showLine'] = false;
    } else {
      rayCasterCfg['lineColor'] = 'blue';
      rayCasterCfg['far'] = 10;
      rayCasterCfg['enabled'] = true;
      rayCasterCfg['showLine'] = true;
    }
    rhel.setAttribute('raycaster', rayCasterCfg);
    lhel.setAttribute('raycaster', rayCasterCfg);

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
      // Check if tip of the index finger 
      this.tipIsInTheBox =
        this.calculateUiBoundBox(this.uiPanel.object3D, this.handR.joints['index-finger-tip'])
        || this.calculateUiBoundBox(this.uiPanel.object3D, this.handL.joints['index-finger-tip']);
      if (this.tipIsInTheBox) {
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
        let dtR = this.handR.joints['middle-finger-tip'].position
          .distanceTo(this.handR.joints['thumb-tip'].position);
        let dtL = this.handL.joints['middle-finger-tip'].position
          .distanceTo(this.handL.joints['thumb-tip'].position);




        if (dtR < 0.05) {
          this.repositionUiPanel(this.handR.joints['middle-finger-tip'].position.clone());
        }
        if (dtL < 0.05) {
          this.repositionUiPanel(this.handL.joints['middle-finger-tip'].position.clone());
        }
      }


    }
  },
  repositionUiPanel(fingerPos) {
    // TODO left eye problem
    const head = document.getElementById('head');
    const uiPanel = document.getElementById('ui-panel');


    // getWorldPosition(new THREE.Vector3())
    // const camPos = head.object3D.position.add(head.parentEl.object3D.position);
    // const camPos = head.object3D.getWorldPosition(this.tmpVector2);
    // TODO choose the right variant
    const camPos = this.el.sceneEl.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());


    const newPosition = fingerPos.sub(camPos);
    const additionalDistance = new THREE.Vector3();
    additionalDistance.copy(newPosition).normalize().multiplyScalar(0.15);
    newPosition.add(camPos).add(additionalDistance);
    uiPanel.object3D.position.copy(newPosition);
    uiPanel.object3D.lookAt(camPos);
    this.drawLine([camPos, uiPanel.object3D.position], 'red');
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
    if (this.squeezedByRight || this.squeezedByLeft) {
      this.redrawTriangle();
    }
  }
});
