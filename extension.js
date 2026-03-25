const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const https = require('https');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	vscode.window.showInformationMessage('Super Mario OG Extension is now Active!');

	let disposable = vscode.commands.registerCommand('super-mario-og.play', function () {
		const panel = vscode.window.createWebviewPanel(
			'marioOG',
			'Super Mario OG',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.file(path.join(context.extensionPath, 'webview'))
				]
			}
		);

		panel.webview.html = getWebviewContent(context, panel.webview);

		// Fetch ROM in extension host to bypass CORS
		const ROM_URL = 'https://www.smbgames.be/roms/super-mario-bros-1.nes';
		https.get(ROM_URL, (res) => {
			let data = [];
			res.on('data', (chunk) => data.push(chunk));
			res.on('end', () => {
				const buffer = Buffer.concat(data);
				const romBase64 = buffer.toString('base64');
				panel.webview.postMessage({ command: 'loadROM', data: romBase64 });
			});
		}).on('error', (err) => {
			console.error('Error fetching ROM:', err);
		});
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent(context, webview) {
	const jsnesPath = webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'webview', 'jsnes.min.js')));
	const emulatorPath = webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'webview', 'emulator.js')));
	const cssPath = webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'webview', 'style.css')));

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Super Mario OG</title>
	<link rel="stylesheet" href="${cssPath}">
</head>
<body>
	<div id="controls">
		<button id="save-btn" title="Save Progress (Key: P)">💾 Save</button>
		<button id="load-btn" title="Load Progress (Key: L)">📂 Load</button>
	</div>
	<canvas id="nes-canvas" width="256" height="240" tabindex="0" onclick="this.focus()"></canvas>
	<div id="rom-input-section">
		<div id="loading-indicator">🍄 Powering Up...</div>
	</div>
	<script src="${jsnesPath}"></script>
	<script src="${emulatorPath}"></script>
</body>
</html>`;
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
