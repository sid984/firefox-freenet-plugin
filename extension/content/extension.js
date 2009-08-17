const console = Components.classes['@mozilla.org/consoleservice;1']
	.getService(Components.interfaces.nsIConsoleService);

var server;
	
function init(){
	startServer();
}	

// --- Utils ---

function log(msg){
	console.logStringMessage(msg);
}

function error(e){
	Components.utils.reportError(e)
}

function Class(p){
	var object = (p.initialize = p.initialize || function(){});
	object.prototype = p;
	return object;
}

function F(o, f, a){
	return function(){return f.apply(o, a || arguments)};
}

function dump(o){
	log(">>>");
	for(var k in o){
		log(k + " => " + o[k] + " (" + typeof(o[k]) + ")");
	}
	log("<<<");
}

function Freenet_Open(){
	log("openig web UI");
	openAndReuseOneTabPerURL("http://localhost:9999/");
	//server.close();
	//Proxy_debug();
}

function Proxy_debug(){
	var data = "";
	try{ 
	for(var id in Proxy.instances){
		var inst = Proxy.instances[id];
		data += id + ": client " + (inst.client.connected ? "connected" : "disconnected")
			+ ", server " + (inst.server.connected ? "connected" : "disconnected")
			+ "\n";
	}
	}catch(e){
		alert(e);
	}
	alert(data);
}

function startServer(){
	server = new Server();
	server.bind(9999);
}

function openAndReuseOneTabPerURL(url) {
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		.getService(Components.interfaces.nsIWindowMediator);
	var browserEnumerator = wm.getEnumerator("navigator:browser");

	// Check each browser instance for our URL
	var found = false;
	while (!found && browserEnumerator.hasMoreElements()) {
		var browserWin = browserEnumerator.getNext();
		var tabbrowser = browserWin.getBrowser();

		// Check each tab of this browser instance
		var numTabs = tabbrowser.browsers.length;
		for(var index=0; index<numTabs; index++) {
			var currentBrowser = tabbrowser.getBrowserAtIndex(index);
			if (url == currentBrowser.currentURI.spec) {

				// The URL is already opened. Select this tab.
				tabbrowser.selectedTab = tabbrowser.mTabs[index];

				// Focus *this* browser-window
				browserWin.focus();

				found = true;
				break;
			}
		}
	}

	// Our URL isn't open. Open it now.
	if (!found) {
		var recentWindow = wm.getMostRecentWindow("navigator:browser");
		if (recentWindow) {
			// Use an existing browser window
			recentWindow.delayedOpenTab(url, null, null, null, null);
		} else {
			// No browser windows are open, so open a new one.
			window.open(url);
		}
	}
}
