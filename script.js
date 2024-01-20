"use strict";

let hls;

/**
 * @type {number[]}
 */
let existing = JSON.parse(localStorage.getItem("openWindows") ?? "[]");
let hasUserInteraction = false;

let screenTop = localStorage.getItem("screenTop");
let isImportantWindow = false;

function supportsHLS() {
  var video = document.createElement('video');
  return Boolean(video.canPlayType('application/vnd.apple.mpegURL') || video.canPlayType('audio/mpegurl'))
}

function obtainUserInteraction (callback) {
	if (hasUserInteraction) return callback();
	console.log("Obtaining user interaction");
	document.getElementById('click-anywhere').style.display = "flex";
	const onClick = () => {
		document.removeEventListener('click', onClick);
		document.getElementById('click-anywhere').style.display = "none";
		hasUserInteraction = true;
		callback();
	}
	document.addEventListener('click', onClick);
}
/**
 * @type {HTMLVideoElement}
 */
let player;

function updatePosition() {
	player.style.top = `${screenTop - window.screenY}px`;
	player.style.bottom = `${(window.screen.availHeight - window.outerHeight - window.screenY - screenTop) * -1}px`;
	player.style.left = `${window.screenX * -1}px`;
	player.style.right = `${(window.screen.availWidth - window.outerWidth - window.screenX) * -1}px`;
}

let seekDate = Date.now();

function playFromEvent() {
	console.log("Playing from event");
	seekDate = Number(localStorage.getItem("seekDate"));
	setTimeout(() => {
		player.play();
		player.currentTime = Number(localStorage.getItem("seek"));
	}, seekDate - Date.now());
}

function pauseFromEvent() {
	console.log("Pausing from event");
	seekDate = Number(localStorage.getItem("seekDate"));
	setTimeout(() => {
		player.pause();
		player.currentTime = Number(localStorage.getItem("seek"));
	}, seekDate - Date.now());
}

function main() {
	existing = JSON.parse(localStorage.getItem("openWindows") ?? "[]");
	if (existing == null || existing.length == 0) {
		isImportantWindow = true;
		console.log("This window is the important window.");
	}
	if (existing == null) existing = [];
	const id = existing.length == 0 ? 0 : existing[existing.length - 1] + 1;
	existing.push(id);
	localStorage.setItem("openWindows", JSON.stringify(existing));
	const container = document.getElementById("stream-container");
	container.style.display = "block";
	player.style.position = "absolute";
	const toolBarHeight = window.outerHeight - window.innerHeight;
	player.style.width = `${window.screen.availWidth}px`;
	player.style.height = `${window.screen.availHeight - toolBarHeight}px`;
	player.addEventListener('click', () => {
		if (player.paused) {
			playPlayer();
		} else {
			pausePlayer();
		}
	});
	player.addEventListener('pause', () => {
		player.currentTime = Number(localStorage.getItem("seek"));
	});
	player.addEventListener('ended', () => {
		player.currentTime = 0;
		pausePlayer();
	});
	window.addEventListener('resize', () => {
		updatePosition();
	});
	setInterval(() => {
		updatePosition();
	}, 30);

	setInterval(() => {
		if (isImportantWindow) {
			if (!player.paused) {
				localStorage.setItem("autoSyncSeekDate", Date.now());
				localStorage.setItem("autoSyncSeek", player.currentTime);
				if (localStorage.getItem("playing") == "false") {
					player.pause();
				}
			} else {
				if (localStorage.getItem("playing") == "true") {
					player.play();
				}
			}
		}
	}, 1000);

	let syncFrameArrived = false;

	let outOfSync = 0;

	const storageUpdate = (event) => {
		if (event.key == "openWindows") {
			console.log(event.newValue);
			const newExisting = JSON.parse(event.newValue ?? "[]");
			if (!newExisting || newExisting?.indexOf(id) == -1) {
				setTimeout(() => {
					existing = JSON.parse(localStorage.getItem("openWindows") ?? "[]");
					if (!existing || existing?.indexOf(id) == -1) {
						existing.push(id);
						localStorage.setItem("openWindows", JSON.stringify(existing));
					}
					if (existing.indexOf(id) == 0) {
						if (!isImportantWindow) console.log("This window is the important window.");
						isImportantWindow = true;
					} else {
						if (isImportantWindow) console.log("This window is no longer the important window.");
						isImportantWindow = false;
					}
				}, 5 * id);
			} else {
				existing = newExisting;
				if (existing.indexOf(id) == 0) {
					if (!isImportantWindow) console.log("This window is the important window.");
					isImportantWindow = true;
				} else {
					if (isImportantWindow) console.log("This window is no longer the important window.");
					isImportantWindow = false;
				}
			}
		} else if (event.key == "playing") {
			syncFrameArrived = true;
			if (event.newValue == "true") {
				console.log("Playing from storage");
				playFromEvent();
			} else {
				console.log("Pausing from storage");
				pauseFromEvent();
			}
		} else if (event.key == "syncFrameRequested") {
			if (isImportantWindow && event.newValue == "true") {
				window.localStorage.setItem("syncFrameRequested", "false");
				console.log("Sync Frame");
				pausePlayer();
				setTimeout(() => {
					playPlayer();
				}, 300);
			}
		} else if (event.key == "autoSyncSeek") {
			setTimeout(() => {
				if (isImportantWindow) return;
				const difference = player.currentTime - (Number(event.newValue) + 1);
				if (Math.abs(difference) > 0.02) {
					outOfSync++;
				} else {
					outOfSync = 0;
				}
				if (outOfSync > 5) {
					window.localStorage.setItem("syncFrameRequested", "true");
					outOfSync = 0;
				}
			}, (Number(localStorage.getItem("autoSyncSeekDate")) + 1000) - Date.now());
		}
	};

	addEventListener("storage", storageUpdate);
	
	if (isImportantWindow) {
		console.log("I am important so I'll play this automagically!");
		localStorage.setItem("syncFrameRequested", "false");
		playPlayer();
	} else {
		console.log("Refreshing Present List");
		existing = [];
		localStorage.setItem("openWindows", JSON.stringify(existing));
		setTimeout(() => {
			console.log("Requesting sync frame");
			window.localStorage.setItem("syncFrameRequested", "true");
			setTimeout(() => {
				if (!syncFrameArrived && existing.length == 0) {
					console.log("I'll just assume I'm important and play it anyway");
					existing = [id];
					localStorage.setItem("openWindows", JSON.stringify(existing));
					localStorage.setItem("syncFrameRequested", "false");
					if (!isImportantWindow) console.log("This window is the important window.");
					isImportantWindow = true;
					playPlayer();
				}
			}, 500);
		}, 500);
	}

	// event listener for when current window is about to ble closed
	window.addEventListener('beforeunload', function (e) 
	{
		removeEventListener("storage", storageUpdate);
		if (existing?.length > 0) existing.splice(existing.indexOf(id), 1);
		localStorage.setItem("openWindows", JSON.stringify(existing));
		if (!existing || existing?.length == 0) {
			console.log("Clearing shit");
			window.localStorage.removeItem("seek");
			window.localStorage.removeItem("seekDate");
			window.localStorage.removeItem("playing");
			window.localStorage.removeItem("syncFrameRequested");
			window.localStorage.removeItem("autoSyncSeek");
			window.localStorage.removeItem("autoSyncSeekDate");
		}
	});

	updatePosition();
}

function pausePlayer() {
	window.localStorage.setItem("seek", player.currentTime);
	seekDate = Date.now() + 200;
	window.localStorage.setItem("seekDate", seekDate);
	window.localStorage.setItem("playing", "false");
	pauseFromEvent();
}

function playPlayer() {
	window.localStorage.setItem("seek", player.currentTime);
	seekDate = Date.now() + 200;
	window.localStorage.setItem("seekDate", seekDate);
	window.localStorage.setItem("playing", "true");
	playFromEvent();
}

function load() {
	let src = "/stream/stream.m3u8";
	const vidElement = document.createElement("video");
	vidElement.setAttribute("id", "stream-player");
	vidElement.setAttribute("crossorigin", "anonymous");
	player = vidElement;
	document.getElementById("stream-container").appendChild(vidElement);
	if (supportsHLS() && navigator.userAgent.toLowerCase().includes("iphone")) {
		const srcElement = document.createElement("source");
		srcElement.setAttribute("src", src);
		srcElement.setAttribute("id", "stream-source");
		vidElement.setAttribute("preload", "auto");
		vidElement.appendChild(srcElement);
	} else if (Hls.isSupported()) {
		hls = new Hls();
		hls.attachMedia(vidElement);
		hls.on(Hls.Events.MEDIA_ATTACHED, function () {
      hls.loadSource(src);
    });
	}

	if (!screenTop) {
		document.getElementById("calibration").style.display = "flex";
		const onKeyDown = evt => {
			if (evt.key == " ") {
				document.removeEventListener('keydown', onKeyDown);
				screenTop = window.screenTop;
				localStorage.setItem("screenTop", window.screenTop);
				document.getElementById("calibration").style.display = "none";
				obtainUserInteraction(main);
			}
		}
		document.addEventListener('keydown', onKeyDown);
	} else {
		obtainUserInteraction(main);
	}
}

load();