var Server = new Class({

		bind: function(port){
			try{
				var loopback_only = true;
				this.port = port;
				
				this.server = Components.classes["@mozilla.org/network/server-socket;1"].createInstance();
				this.server = this.server.QueryInterface(Components.interfaces.nsIServerSocket);
				this.server.init(port, loopback_only, -1);
				this.server.asyncListen(this);
				log("Server started");
			} catch(e){
				log("Bind error: " + e);
			}
		},
		
		onStopListening: function(socket, status) {
			// noop
		},

		onSocketAccepted: function(socket, transport) {
			try {
				var outstream = transport.openOutputStream(0,10000000,100000);
				var stream = transport.openInputStream(0,0,0);
				var instream = Components.classes["@mozilla.org/scriptableinputstream;1"]
					.createInstance(Components.interfaces.nsIScriptableInputStream);
				instream.init(stream);
	
				
				var connection = new Connection(this.server, instream, outstream, stream);
				var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
					.createInstance(Components.interfaces.nsIInputStreamPump);
				pump.init(stream, -1, -1, 0, 0, false);
				pump.asyncRead(connection, null);
			} catch (e) {
				log("onSocketAccepted error: " + e);
			}
		},
		
		close: function(){
			this.server.close();
		}
		
});

var Connection = new Class({
		
		initialize: function(server, instream, outstream, stream){
			this.data = "";
			this.server = server;
			this.stream = stream;
			this.instream = instream;
			this.outstream = outstream;
		},
		
		onStartRequest: function(request, context) {
			//log("onStartRequest");
			this.connected = true;
			this.onConnect();
		},
	
		onStopRequest: function(request, context, status) {
			//log("onStopRequest with data: " + this.data);
			this.close();
		},
	
		onDataAvailable: function(request, context, inputStream, offset, count ) {
			log("onDataAvailable");
			
			var bis = Components.classes["@mozilla.org/binaryinputstream;1"]
					.createInstance( Components.interfaces.nsIBinaryInputStream );
			bis.setInputStream(this.stream);
			
			var postBytes = bis.readByteArray(bis.available());  
	
			var message = String.fromCharCode.apply(null, postBytes); //bis.readBytes(count);
			this.data += message;
			//log("data: " + this.data);
			
			if(this.proxy != null){
				// не юзается!!!
				this.proxy.onClientData(message);
			} else {
				var matches;
				if(matches = this.data.match(/(\S+)\s.*?\/(\S*).*/)){
					var index1 = matches[0].length;
					var index2 = this.data.indexOf("\r\n\r\n");
					
					var method = matches[1];
					var path = matches[2];
					var body = this.data.substr(index2 + 4);
					var headers = {};
					
					var re = /(\S+)\: (.*)/;
					var headers_str = this.data.substr(index1 + 2, index2 - index1 - 2);
					var headers_arr = headers_str.split("\r\n");
					for(var i = 0; i < headers_arr.length; i++){
						var m;
						var header = headers_arr[i];
						if(m = header.match(re))
							headers[m[1]] = m[2];
					}
					
					this.onHTTPRequest(method, path, headers, body);
				} else {
					log(matches);
					log("chunked request. waiting for last chunk...");
				}
			}
		},
	
		close: function(){
			log("Closing client connection...");
			if(this.connected){
				this.instream.close();
				this.outstream.close();
				this.connected = false;
				this.onClose();
			}
		},
	
		write: function(data){
			try {
				this.outstream.write(data, data.length);
			} catch(e){
				log("write failed: " + e);
			}
		},
	
		onHTTPRequest: function(method, path, headers, body){
			/*
			log("method: " + method);
			log("path: " + path);
			dump(headers);
			log("body: " + body);
			*/
			var response;
			
			if(method == "GET"){
				this.getStaticContent(path);
			} else if(method == "POST"){ 
				if(path == ""){
					var request = JSON.parse(body);
					dump(request);
					this.write("ok");
					this.close();
				} else if(path == "proxy"){
					this.proxy = new Proxy(this, body, headers);
				}
			} else {
				this.write("Wrong request");
				this.close();
			}
		},
		
		getStaticContent: function(path){
			try {
				
				path = path == "" ? "index.html" : path;
				var m = /.*?\.([a-z]+)$/.exec(path);
				var ext = m[1];
				var extensions = {
					js: "text/javascript",
					html: "text/html",
					css: "text/css",
					png: "image/png",
					ico: "image/ico"
				};
				
				var MY_ID = "noname@freenet";
				var em = Components.classes["@mozilla.org/extensions/manager;1"]
					.getService(Components.interfaces.nsIExtensionManager);
				// the path may use forward slash ("/") as the delimiter
				// returns nsIFile for the extension's install.rdf
				var file = em.getInstallLocation(MY_ID).getItemFile(MY_ID, "web/" + path);
				var filestring = file.path;

				log("PATH: " + file.path);
	
				var output;
				var headers = {
					Connection: "close",
					Server: "Freenet"
				};
				
				var binary = true; //extensions[ext].substr(0, 4) != "text";
			
				if( binary) {
					// BINARY file
					var data = {};
					var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
						.createInstance(Components.interfaces.nsIFileInputStream);
					fstream.init(file, 1, 0, false);
					var bis = Components.classes["@mozilla.org/binaryinputstream;1"]
						.createInstance( Components.interfaces.nsIBinaryInputStream );
					bis.setInputStream(fstream);
					//headers["Content-Length"] = file.fileSize;
					output = bis.readBytes(file.fileSize);
					bis.close();
					fstream.close();
				} else {
					/*
					var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
						.createInstance(Components.interfaces.nsIFileInputStream);
					
					var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
						.createInstance(Components.interfaces.nsIConverterInputStream);
					fstream.init(file, -1, 0, 0);
					cstream.init(fstream, "UTF-8", 0, 0); // you can use another encoding here if you wish
					
					var str = {};
					cstream.readString(-1, str); // read the whole file and put it in str.value
					output = str.value;
					cstream.close(); // this closes fstream
					//log(output);
					*/
				}
				
				headers["Content-Type"] = extensions[ext] || "text/html";
				
			} catch (e) {
				log("Error: " + e);
				this.response("404 Not found");
				this.close();
				return "";
			}
			
			this.response(null, headers, output);
			this.close();
		},
		
		response: function(code, headers, body){
			code = code || "200 OK";
			headers = headers || {};
			body = body || "";
			
			var response = "HTTP/1.1 " + code + "\r\n" ;
			for(var k in headers){
				response += k + ": " + headers[k] + "\r\n";
			}
			this.write(response + "\r\n" + body);
		},
		
		onConnect: function(){},	// OVERRIDE
		onClose: function(){} 		// OVERRIDE
	
});

var Proxy = new Class({

		initialize: function(connection, body, headers){
			this.client = connection;
			
			if(headers && headers.session != null){
				// write to existing proxy-connection request
				
				log("Proxy push: " + body);
				
				var instance = Proxy.instances[headers.session];
				if(instance == null){
					this.client.response(null, null, "Session not found");
				} else {
					instance.onClientData(body);
					this.client.response(null, null, "ok");
				}
				this.client.close();
			} else {
				// new proxy-connection request
				
				this.port = headers.port;
				log("New proxied request on port " + this.port);
			
				this.session = this.generateSession();
			
				Proxy.instances = Proxy.instances || {};
				Proxy.instances[this.session] = this;
				
				this.client.onClose = F(this, this.onClientClose);
				this.client.response(null, {session: this.session});
					
				this.proxify(body);	
			}
		},
		
		proxify: function(body){
			try{
				this.server = new TcpClient("localhost", this.port, {
					onClose: 		F(this, this.onServerClose),
					onData: 			F(this, this.onServerData),
					onConnect: 	F(this, this.onServerConnect)
				});
				this.server.connect();
				//log("body: " + body);
				if(body)
					this.server.write(body);
			} catch(e){
				log("Proxy connect error: " + e);
			}
		},
		
		generateSession: function(){
			// TODO: придумать че нибудь поумнее
			this.session_tmp = this.session_tmp || 0;
			return ++this.session_tmp;
		},
		
		onClientData: function(data){
			log("Proxy: onClientData: " + data);
			this.server.write(data);
		},
		
		onServerData: function(data){
			log("Proxy: onServerData: " + data);
			this.client.write(data);
		},
		
		onServerConnect: function(){
			//log("Proxy: onServerConnect");
			//this.client.write("* OK\n");
		},
		
		onClientClose: function(){
			log("Proxy: Client connection closed");
			this.session && delete Proxy.instances[this.session];
			this.server.close(); // ???
		},
		
		onServerClose: function(data){
			log("Proxy: Server connection closed");
			this.client.write("* ERROR connection failed");
			this.client.close();
		}
});