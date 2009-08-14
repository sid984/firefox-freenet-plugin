var TcpClient = new Class({
		
		initialize: function(host, port, listener){
			this.host = host;
			this.port = port;
			for(var k in listener)
				this[k] = listener[k];
			this.data = "";
			log("init tcpclient");
		},
		
		connect: function(){
			try{
				log("Connecting to " + this.host + ":" + this.port + " ...");
				var socketTransportService = Components.classes["@mozilla.org/network/socket-transport-service;1"]
					.getService(Components.interfaces.nsISocketTransportService);
				this.socketTransport = socketTransportService.createTransport(["starttls"], 1, this.host, this.port, null);
	
				this.inputStream = this.socketTransport.openInputStream(0, 0, 0);
				this.scriptible = Components.classes["@mozilla.org/scriptableinputstream;1"]
					.createInstance(Components.interfaces.nsIScriptableInputStream);
				this.scriptible.init(this.inputStream);
				
				this.outputStream = this.socketTransport.openOutputStream(0, 0, 0);
	
				var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
					.createInstance(Components.interfaces.nsIInputStreamPump);
				pump.init(this.inputStream, -1, -1, 0, 0, true); //!!!!!!! false ?
	
				pump.asyncRead(this, null);
			} catch(e) {
				alert(e);
			}
		},
		
		write: function(data){
			try{ 
				this.outputStream.write(data, data.length);
				log("Sent [" + data + "]");
			} catch(e){
				log("Socket write error");
			}
		},
		
		close: function(){
			if(this.connected){
				this.inputStream.close();
				this.outputStream.close();
				this.connected = false;
				this.onClose();
			}
		},
		
		onStartRequest: function(request, context){
			log("Start connecting to socket...");
			this.connected = true;
			this.onConnect();
		},
		
		onStopRequest: function(request, context, status){
			log("Connection to socket closed");
			this.close();
		},
		
		onDataAvailable: function(request, context, inputStream, offset, count){
			log("Data avaiable ["+count+"] long");
			try
			{
				var reply = this.scriptible.read(count);
				//log( "Reading ["+count+"]["+offset+"]["+reply+"]");
				this.onData(reply);
				this.data += reply;
			}
			catch( ex )
			{
				alert("Error on Data Avaialable ["+ex+"]");
			}	
		},
		
		onData: function(){},		// OVERRIDE
		onConnect: function(){},	// OVERRIDE
		onClose: function(){} 		// OVERRIDE
});