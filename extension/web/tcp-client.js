var TCP_Client = new Class({

		patterns: [],
		
		connect: function(){
			this.req = new XMLHttpRequest();
			this.req.onreadystatechange = F(this, this.onreadystatechange);
			this.req.open("POST", this.URL, true);
			this.req.send("port=" + this.port);	
		},
		
		disconnect: function(){
			log("disconnecting...");
			this.disconnected = true;
			this.req.abort();
		},
		
		onreadystatechange: function(){
			//Log("Connect state: " + this.state + " => " + this.req.readyState);
					
			this.state = this.req.readyState;
			log("state: " + this.state);
				
			switch(this.state){
				case 2:
					this.connected = true;
					this.index = 0;
					this.onConnect();
					break;
				case 3:
					this.session = this.session || this.req.getResponseHeader("session");
					break;
				case 4:
					this.connected = false;
					this.onDisconnect();
					if(!this.disconnected){
						//this.connect();
					} else {
						this.session = null;
					}
					break;
			}
			
			try{
				var resp = this.req.responseText || "";
				if(this.index < resp.length) {
					line = resp.substring(this.index);
					this.index = resp.length;
					this.onData(line);
				}
			} catch(e){
			}
		},
		
		onData: function(data){
			log("onData: " + data);
			
			if(this.parser != null){
				this.parser.parse(data);
			} else {
				var m;
				var matched = false;
				for(var i = 0; i < this.patterns.length; i += 2){
					var re = this.patterns[i];
					var f = this.patterns[i + 1];
					if(m = re.exec(data)){
						matched = true;
						f.apply(this, m.slice(1));
					}
				}
				if(!matched)
					log("No matches where found");
			}
		},
		
		write: function(data){
			try{
				var request = new XMLHttpRequest();
				request.onreadystatechange = function(){
					if(this.readyState == 3)
						log(this.responseText == "ok" ? "Proxy push ok" : "Proxy push failed");
				};
				
				request.open("POST", "/proxy", true);
				request.setRequestHeader("session", this.session);
				log("push: " + data);
				request.send(data + "\n");
			} catch(e){
				log(e);
			}
		},
		
		onConnect: function(){},
		onDisconnect: function(){}

});