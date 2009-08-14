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

function Freenet_Debug(){
	log("debug");
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