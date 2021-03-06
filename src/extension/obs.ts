'use strict';

// Native
import * as fs from 'fs';
import * as path from 'path';
import {exec} from 'child_process';

// Packages
import OBSUtility = require('nodecg-utility-obs');

// Ours
import * as nodecgApiContext from './util/nodecg-api-context';
// @ts-ignore
import gdqUtils = require('../../shared/lib/gdq-utils');

const nodecg = nodecgApiContext.get();

// We track what _layout_ is active, not necessarily what _scene_ is active.
// A given layout can be on multiple scenes.
const currentLayout = nodecg.Replicant('gdq:currentLayout');
const autoUploadRecordings = nodecg.Replicant('autoUploadRecordings');
const cyclingRecordingsRep = nodecg.Replicant('obs:cyclingRecordings', {persistent: false});
const compositingOBS = new OBSUtility(nodecg, {namespace: 'compositingOBS'});
const recordingOBS = new OBSUtility(nodecg, {namespace: 'recordingOBS'});
const encodingOBS = new OBSUtility(nodecg, {namespace: 'encodingOBS'});
const uploadScriptPath = nodecg.bundleConfig.youtubeUploadScriptPath;
let uploadScriptRunning = false;

if (uploadScriptPath) {
	let stats;
	try {
		stats = fs.lstatSync(uploadScriptPath);
	} catch (e) {
		if (e.code === 'ENOENT') {
			throw new Error(`Configured youtubeUploadScriptPath (${uploadScriptPath}) does not exist.`);
		}

		throw e;
	}

	if (!stats.isFile()) {
		throw new Error(`Configured youtubeUploadScriptPath (${uploadScriptPath}) is not a file.`);
	}

	nodecg.log.info('Automatic VOD uploading enabled.');
}

autoUploadRecordings.on('change', (newVal: boolean) => {
	nodecg.log.info('Automatic uploading of recordings %s.', newVal ? 'ENABLED' : 'DISABLED');
});

compositingOBS.replicants.programScene.on('change', (newVal: any) => {
	if (!newVal) {
		return;
	}

	newVal.sources.some((source: any) => {
		if (!source.name) {
			return false;
		}

		const lowercaseSourceName = source.name.toLowerCase();
		if (lowercaseSourceName.indexOf('layout') === 0) {
			currentLayout.value = lowercaseSourceName.replace(/ /g, '_').replace('layout_', '');
			return true;
		}

		return false;
	});
});

compositingOBS.replicants.previewScene.on('change', (newVal: any) => {
	if (!newVal || !newVal.name) {
		return;
	}

	// Hide the transition graphic on gameplay scenes when they are in preview.
	if (gdqUtils.isGameScene(newVal.name)) {
		// Abort if the PVW scene is also the PGM scene.
		if (newVal.name === compositingOBS.replicants.programScene.value.name) {
			return;
		}

		compositingOBS.setSceneItemRender({
			'scene-name': newVal.name,
			source: 'Transition Graphic',
			render: false
		}).catch((error: Error) => {
			nodecg.log.error(`Failed to hide Transition Graphic on scene "${newVal.name}":`, error);
		});
	}
});

compositingOBS.on('TransitionBegin', (
	data: {
		duration: number;
		name: string;
		fromScene: string;
		toScene: string;
	}
) => {
	if (data.name !== 'Blank Stinger') {
		return;
	}

	if (data.toScene) {
		// Show the Transition Graphic on the scene which is being transitioned to.
		compositingOBS.setSceneItemRender({
			'scene-name': data.toScene,
			source: 'Transition Graphic',
			render: true
		}).catch((error: Error) => {
			nodecg.log.error(`Failed to show Transition Graphic on scene "${data.toScene}":`, error);
		});
	}
});

compositingOBS.on('SwitchScenes', (data: any) => {
	const actualPgmSceneName = data['scene-name'];
	const pvwSceneName = compositingOBS.replicants.previewScene.value && compositingOBS.replicants.previewScene.value.name;
	const pgmSceneName = compositingOBS.replicants.programScene.value && compositingOBS.replicants.programScene.value.name;
	const actualPvwSceneName = actualPgmSceneName === pvwSceneName ? pgmSceneName : pvwSceneName;

	if (actualPvwSceneName === 'Break') {
		return;
	}

	// Abort if the PVW scene is also the PGM scene.
	if (actualPvwSceneName === actualPgmSceneName) {
		return;
	}

	// Hide the transition graphic on gameplay scenes when they are in preview.
	if (gdqUtils.isGameScene(actualPvwSceneName)) {
		compositingOBS.setSceneItemRender({
			'scene-name': actualPvwSceneName,
			source: 'Transition Graphic',
			render: false
		}).catch((error: Error) => {
			nodecg.log.error(`Failed to hide Transition Graphic on scene "${actualPvwSceneName}":`, error);
		});
	}
});

function cycleRecording(obs: any) {
	return new Promise((resolve, reject) => {
		let rejected = false;
		const timeout = setTimeout(() => {
			rejected = true;
			reject(new Error(`Timed out waiting for ${obs.namespace} to stop recording.`));
		}, 30000);

		const recordingStoppedListener = () => {
			if (rejected) {
				return;
			}

			obs.log.info('Recording stopped.');
			clearTimeout(timeout);

			setTimeout(() => {
				resolve();
			}, 2500);
		};

		obs.once('RecordingStopped', recordingStoppedListener);
		obs.stopRecording().catch((error: Error) => {
			if ((error as any).error === 'recording not active') {
				obs.removeListener('RecordingStopped', recordingStoppedListener);
				resolve();
			} else {
				obs.log.error(error);
				reject(error);
			}
		});
	}).then(() => {
		return obs.startRecording();
	});
}

export function resetCropping() {
	return compositingOBS.send('ResetCropping').catch((error: Error) => {
		nodecg.log.error('resetCropping error:', error);
	});
}

export function setCurrentScene(sceneName: string) {
	return compositingOBS.setCurrentScene({
		'scene-name': sceneName
	});
}

export async function cycleRecordings() {
	nodecg.log.info('Cycling recordings...');
	cyclingRecordingsRep.value = true;

	try {
		const cycleRecordingPromises = [];
		if (recordingOBS._connected) {
			cycleRecordingPromises.push(cycleRecording(recordingOBS));
		} else {
			nodecg.log.error('Recording OBS is disconnected! Not cycling its recording.');
		}

		if (compositingOBS._connected) {
			cycleRecordingPromises.push(cycleRecording(compositingOBS));
		} else {
			nodecg.log.error('Compositing OBS is disconnected! Not cycling its recording.');
		}

		if (encodingOBS._connected) {
			cycleRecordingPromises.push(cycleRecording(encodingOBS));
		} else {
			nodecg.log.error('Encoding OBS is disconnected! Not cycling its recording.');
		}

		if (cycleRecordingPromises.length <= 0) {
			nodecg.log.warn('No instances of OBS are connected, aborting cycleRecordings.');
			return;
		}

		await Promise.all(cycleRecordingPromises);

		nodecg.log.info('Recordings successfully cycled.');
		cyclingRecordingsRep.value = false;
		nodecg.sendMessage('obs:recordingsCycled');

		if (uploadScriptPath && autoUploadRecordings.value && !uploadScriptRunning) {
			uploadScriptRunning = true;
			nodecg.log.info('Executing upload script...');
			exec(`python "${uploadScriptPath}"`, {
				cwd: path.parse(uploadScriptPath).dir
			}, (error, stdout, stderr) => {
				uploadScriptRunning = false;

				if (error) {
					nodecg.log.error('Upload script failed:', error);
					return;
				}

				if (stderr) {
					nodecg.log.error('Upload script failed:', stderr);
					return;
				}

				if (stdout.trim().length > 0) {
					nodecg.log.info('Upload script ran successfully:', stdout.trim());
				} else {
					nodecg.log.info('Upload script ran successfully.');
				}
			});
		}
	} catch (error) {
		cyclingRecordingsRep.value = false;
		nodecg.sendMessage('obs:recordingsCycled', error);
		throw error;
	}
}

export function compositingOBSConnected() {
	return compositingOBS._connected;
}
