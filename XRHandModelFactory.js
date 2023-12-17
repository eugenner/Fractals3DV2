import {
	Object3D
} from 'three';

import {
	XRHandMeshModel
} from './XRHandMeshModel.js';

class XRHandModel extends Object3D {

	constructor( controller ) {

		super();

		this.controller = controller;
		this.motionController = null;
		this.envMap = null;

		this.mesh = null;

	}

	updateMatrixWorld( force ) {

		super.updateMatrixWorld( force );

		if ( this.motionController ) {

			this.motionController.updateMesh();

		}

	}

}

class XRHandModelFactory {

	constructor() {

		this.path = null;

	}

	setPath( path ) {

		this.path = path;

		return this;

	}

	createHandModel( controller, profile ) {

		const handModel = new XRHandModel( controller );

		controller.addEventListener( 'connected', ( event ) => {

			const xrInputSource = event.data;

			if ( xrInputSource.hand && ! handModel.motionController ) {

				handModel.xrInputSource = xrInputSource;
				handModel.motionController = new XRHandMeshModel( handModel, controller, this.path, xrInputSource.handedness );

			}

			controller.visible = true;

		} );

		controller.addEventListener( 'disconnected', () => {

			controller.visible = false;
			// handModel.motionController = null;
			// handModel.remove( scene );
			// scene = null;

		} );

		return handModel;

	}

}

export { XRHandModelFactory };
