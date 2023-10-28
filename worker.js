importScripts('node_modules/super-three/build/three.js'); 

let lines = [[],[],[],[],[],[]]; // TODO set by number of fractal tree levels


self.onmessage = function(event) {
    const data = event.data;
    lines = [[],[],[],[],[],[]];
    
    drawFractal(convertToT3Obj(data.base), convertToT3Obj(data.branches), 1);
    // Perform some time-consuming task
    // const result = performTask(data);
    
    // Send the result back to the main thread
    setTimeout(function() {
      // TODO data exchange between main thread and worker's thread can't be rich Object type
      // and should be serialized !
      self.postMessage({'lines': lines});
    }, 3000);

  };

  // Converting primitive types to THREE objects
  const convertToT3Obj = (data) => {
    let result = [];
    if(Array.isArray(data[0])) {
      // branches data (2d array)
      data.forEach((el) => {
        let subResult = [];
        el.forEach((el2) => {
          subResult.push(new THREE.Vector3().set(el2.x, el2.y, el2.z));
        });
        result.push(subResult);
      })
    } else {
      // base data (simple array)
      data.forEach((el) => {
        result.push(new THREE.Vector3().set(el.x, el.y, el.z));
      })
    }
    return result;
  }
  
  const drawFractal = (base, branches, level) => {

    // lines[level - 1].push([base[0], base[1]]);
    branches.forEach((b) => {
      lines[level - 1].push(b[0], b[1]);
    });

    if (level > 4)
      return;

    // 1. Scale relative to base
    var scaledBranchesWithBase = scaleBranches(base, branches);
  
    // 2. Align with forward axis
    var alignedForwardBranches = alignForwardBranches(scaledBranchesWithBase); // function will change source data, no needs to return
  
    // 3. Align with plane
    var alignedPlaneBranches = alignPlaneBranches(alignedForwardBranches);
  
    // 4. Position in place
    var positioned = moveInPosition(alignedPlaneBranches);

    positioned.forEach((p) => {
      drawFractal(p[0], p.splice(1), level + 1);
    });
  }

  const scaleBranches = (base, branches) => {

    var newBranchesWithBases = [];
  
    branches.forEach((branch) => {
      var newBrancheWithBase = [];
      var scaleVal = branch[0].distanceTo(branch[1]) / base[0].distanceTo(base[1]);
      const scaleVector = new THREE.Vector3(scaleVal, scaleVal, scaleVal);
      const m = new THREE.Matrix4();
      m.scale(scaleVector);
      var newBase = cloneAr(base);
      newBase.forEach((point) => {
        point.applyMatrix4(m);
      })
  
      newBrancheWithBase.push(branch);
      newBrancheWithBase.push(newBase);
  
      branches.forEach((b) => {
        var nb = cloneAr(b);
        nb.forEach((point) => {
          point.applyMatrix4(m);
        })
  
        newBrancheWithBase.push(nb);
        newBranchesWithBases.push(newBrancheWithBase);
      });
  
  
  
    });
    return newBranchesWithBases;
  }

  const cloneAr = (ar) => {
    if (Array.isArray(ar)) {
      return ar.map(el => cloneAr(el));
    }
    return ar.clone();
  }
  
  const getTrPerp = (triangle) => {
    var trStartPoint = triangle[0];
    var v1 = triangle[1].clone().sub(trStartPoint);
    var v2 = triangle[2].clone().sub(trStartPoint);
  
    const perpendicularVector = new THREE.Vector3();
    const perp = perpendicularVector.crossVectors(v1, v2).normalize();
  
    return perp;
  }
  


// [ [branch (previous), newBase (scaled), b1 (scaled), b2 (scaled), ...] ... ]
// align couples of [newBase,b1], [newBase:b2] relative branch forward axis
const alignForwardBranches = (data) => {
  var result = [];
  data.forEach((branchData) => {
    var branch = branchData[0];
    var newBase = branchData[1];


    var branchForwardAxis = branch[1].clone().sub(branch[0]);
    var newBaseForwardAxis = newBase[1].clone().sub(newBase[0]);

    var alignAngle = branchForwardAxis.angleTo(newBaseForwardAxis);

    const pa = newBase[1].clone();
    const perpsAxis = pa.crossVectors(branchForwardAxis, newBaseForwardAxis).normalize();
    const qRotation = new THREE.Quaternion();
    qRotation.setFromAxisAngle(perpsAxis, -alignAngle);
    const alignMatrix = new THREE.Matrix4();
    alignMatrix.makeRotationFromQuaternion(qRotation);

    newBase.forEach((point) => {
      point.applyMatrix4(alignMatrix);
    })

    var newBranches = branchData.splice(2); // take only new scaled branches
    newBranches.forEach((nb) => {
      nb.forEach((point) => {
        point.applyMatrix4(alignMatrix);
      })
    });
    result.push([branch, newBase, ...newBranches]);
  })
  return result;
}


// rotate around newBase's forward vector to make planes of branch and scaled branch parallel
const alignPlaneBranches = (data) => {
  var result = [];
  data.forEach((branchData) => {
    var branch = branchData[0];
    var newBase = branchData[1];

    var branchPerp = getTrPerp(branch);
    var newBasePerp = getTrPerp(newBase);

    var alignAngle = branchPerp.angleTo(newBasePerp);
    const pa = newBase[0].clone();
    const perpsAxis = pa.crossVectors(branchPerp, newBasePerp).normalize();
    const qRotation = new THREE.Quaternion();
    qRotation.setFromAxisAngle(perpsAxis, -alignAngle);
    const alignMatrix = new THREE.Matrix4();
    alignMatrix.makeRotationFromQuaternion(qRotation);

    newBase.forEach((point) => {
      point.applyMatrix4(alignMatrix);
    })

    var newBranches = branchData.splice(2); // take only new scaled branches
    newBranches.forEach((nb) => {
      nb.forEach((point) => {
        point.applyMatrix4(alignMatrix);
      })
    });
    result.push([branch, newBase, ...newBranches]);
  });
  return result;

}

const moveInPosition = (data) => {
  var result = [];
  data.forEach((branchData) => {
    var branch = branchData[0];
    var newBase = branchData[1];
    var deltaVector = branch[1].clone().sub(newBase[1]);

    var newBranches = branchData.splice(2); // take only new scaled branches
    newBranches.forEach((nb) => {
      nb.forEach((point) => {
        point.add(deltaVector);
      })
    });
    result.push([branch, ...newBranches]);
  });
  return result;
}
