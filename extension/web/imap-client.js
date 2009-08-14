var IMAP_Client = Extends(TCP_Client, new Class({

		initialize: function(URL, port){
			this.counter = 0;
			this.patterns = [
				/\*\sOK\s\[CAPABILITY.*\].*/, 		this.onConnectEstablished,
				/\*\sERROR\s.*/,							this.onConnectFailed
			];
			this.URL = URL;
			this.port = port;
		},
		
		exec: function(command, params){
			this.counter++;
			var prefix = ("000" + String(this.counter));
			prefix = prefix.substring(prefix.length - 3);
			prefix = "a" + prefix + " ";
			
			this.parser = new IMAP_Parser(command, prefix, F(this, this.onEvent), F(this, this.dropParser));
			this.write(prefix + command + " " + (params || ""));
		},
		
		dropParser: function(){
			this.parser = null;
		},
		
		onEvent: function(event, message, data){
			log("onEvent: " + event);
			log(data);
			switch(event){
				case "onLogin":
					this.onLogin(true);
					this.select();
					break;
				case "onLoginFailed":
					this.onLogin(false);
					break;
				case "onSelect":
					var total = {
						exists: 0,
						recent: 0
					};
					for(var i = 0; i < data.length; i++){
						for(var k in total){
							if(data[i].name == k)
								total[k] = data[i].matches; 
						}
					}
					this.onMailboxTotal(total.exists, total.recent);
					this.fetchAll();
					break;
				case "onFetch":
					var type;
					var list = [];
					var mail = {};
					for(var i = 0; i < data.length; i++){
						if(data[i].name == "item"){
							type = "list";
							var headers = this.parseHeaders(data[i].data);
							headers.ShortFrom = this.cutFreemailAddress(headers.From);
							var item = {
								id: data[i].matches[0]
							};
							list.push(Apply(item, headers));
						} else if(data[i].name == "item_ext"){
							type = "mail";
							var n = data[i].data.indexOf("\r\n\r\n");
							mail.headers = this.parseHeaders( data[i].data.substring(0, n) );
							var body = data[i].data.substring(n + 4);
							
							if(mail.headers["Content-Type"] && mail.headers["Content-Type"].match(/^Multipart\/Mixed/)){
								var boundary, m;
								if(m = /boundary="(.*?)"/.exec(mail.headers["Content-Type"])){
									boundary = m[1];
									var parts = this.parseAttachments(boundary, body);
									mail.body = parts[1].body;
									mail.attachments = parts.slice(2);
								}
							} else {							
								mail.body = body;
							}
						}
					}
					if(type == "list")
						this.onMailboxData(list);
					else if(type == "mail")
						this.onFetch(mail);
					break;
			}
		},
		
		parseAttachments: function(boundary, body){
			var parts = body.split("--" + boundary);
			
			for(var k in parts){
				var n = parts[k].indexOf("\r\n\r\n");
				var headers = this.parseHeaders( parts[k].substring(0, n) );
				var body = parts[k].substring(n + 4);
				parts[k] = {
					body: body,
					headers: headers
				}; 
			}
			return parts;
		},
		
		parseHeaders: function(headers){
			// From: Dave Baker <dave@dbkr.freemail>\r\nSubject: Welcome to Freemail!\r\n\r\n
			var fields = ["To", "From", "Subject", "Date", "Content-Type"];
			var result = {};
			var m;
			
			for(var k in fields){
				var re = new RegExp(fields[k] + ":\\s(.*)");
				if(m = re.exec(headers))
					result[fields[k]] = m[1];
			}
			return result;
		},
		
		cutFreemailAddress: function(address){
			if(address && (m = /([\w\d\_]+\@)([\w\d\_]{30,154})(\.freemail)/.exec(address))){
				var key = m[2];
				var cutted = m[1] + key.substring(0, 3) + "..." + key.substring(key.length - 3, key.length) + m[3];
				address = address.replace(m[0], cutted); 
			}
			return address;
		},
		
		
		// ****** Handlers *******
		
		onConnect: function(){
			//log("onConnect");
			this.onStatus("connected");
		},
		
		onConnectFailed: function(){
			//log("onConnectFailed");
			this.onStatus("failed");
		},
		
		onLogin: function(logged){
			//log(logged ? "Logged in" : "Login failed");
			this.onStatus("logged", logged);
		},
		
		onMailboxTotal: function(exists, recent){
			//log("exists/recent = " + exists + "/" + recent);
			this.onStatus("total", {exists: exists, recent: recent});
		},
		
		onMailboxData: function(list){
			//log(list);
			this.onStatus("data", list);
		},
		
		onFetch: function(mail){
			//log(mail);
			this.onStatus("mail", mail);
		},
		
		onConnectEstablished: function(){
			this.onStatus("ready");
		},
		
		onStatus: function(status, data){}, // OCERRIDE
		
		
		// ******* PUBLIC ********
		
		login: function(login, password){
			if(this.connected){
				log("Logging with session " + this.session + "...    ");
				this.exec("LOGIN", login + " " + password);
			} else {
				this.onConnectEstablished = F(this, function(){
					this.onStatus("ready");
					this.login();
				});
				this.connect();
			}
		},
		
		logout: function(){
			this.exec("LOGOUT");
			this.disconnect();
		},
		
		select: function(){
			this.exec("SELECT", "INBOX");
		},
		
		fetchAll: function(){
			this.exec("FETCH", "1:* (BODY[HEADER.FIELDS (FROM SUBJECT DATE)])");
		},
		
		fetch: function(n){
			this.exec("FETCH", n + " (FLAGS INTERNALDATE ENVELOPE BODY[])");
		}
	
}));

IMAP_Parser = new Class({

		events: {
			LOGIN: {
				OK: "onLogin",
				NO: "onLoginFailed"
			},
			SELECT: {
				OK: "onSelect"
			},
			FETCH: {
				OK: "onFetch"
			}
		},
		
		matches: {
			SELECT: {
				exists: /(\d+)\sEXISTS/,
				recent: /(\d+)\sRECENT/
			},
			FETCH: {
				item: [
					/(\d+)\sFETCH\s\(body\[[^\]]+\]\s+{(\d+)}$/i,
					2
				],
				item_ext: [
					/(\d+)\sFETCH\s*\(FLAGS\s*\((\S*)\)\s*INTERNALDATE\s*\"([^\"]+)\"\s*ENVELOPE\s*\((.*?)\)\s*BODY\[\]\s*\{(\d+)\}$/
					, 5 // 5th match - data
				]
			}
		},
		
		initialize: function(command, prefix, eventCallback, finishCallback){
			this.index = 0;
			this.matched = [];
			this.data = "";
			this.tmp = "";
			this.command = command;
			this.prefix = prefix;
			this.eventCallback = eventCallback;
			this.finishCallback = finishCallback;
		},
		
		parse: function(data){
			try {
				this.data += data;
				this.tmp = data;
				var line;
				var finished = false;
				while((line = this.get_line()) != null){
					//log("line: " + line);
					//this.match_data(line);
					finished |= this.match_status(line);	
				}
				
				if(finished){
					this.finishCallback();
					
					log("Parsing data...");
					
					this.tmp = this.data;
					while((line = this.get_line()) != null){
						//log("!!line: " + line);
						var match = this.match_data(line);
						if(match){
							if(match.data_length > 0){
								// read next `match.data_length` characters >> match.data
								log("reading " + match.data_length + " chars to data...");
								match.data = this.tmp.substring(0, match.data_length);
								this.tmp = this.tmp.substring(match.data_length);
							}
							this.matched.push(match);
						}
					}
					
					var handler = this.events[this.command];
					if(handler && handler[this.code])
						this.eventCallback(handler[this.code], this.message, this.matched);
					else
						log("NO HANDLER FOUND FOR COMMAND '" + this.command + "' WITH CODE '" + this.code + "'");
				}
			}catch(e){
				log("Parse error: " + e);
			}
		},
		
		get_line: function(){
			var length = this.tmp.indexOf("\n");
			//log("length: " + length);
			if(length == -1)
				return null;
			var line = this.tmp.substring(0, length - 1);
			this.tmp = this.tmp.substring(length + 1);
			return line;
		},
		
		match_status: function(line){
			var re = new RegExp(this.prefix + "([A-Z]+) (.*)$");
			var m;
			if(m = re.exec(line)){
				this.code = m[1];
				this.message = m[2];
				//log("code: " + this.code);
				//log("message: " + this.message);
				return true;
			}
			return false;
		},
		
		match_data: function(line){
			if(line.charAt(0) != '*')
				return;
			var matches = this.matches[this.command];
			if(matches == null)
				return;
			line = line.substring(2);
			
			for(var k in matches){
				var m;
				var re 	= isArray(matches[k]) ? matches[k][0] : matches[k];
				var ext 	= isArray(matches[k]) ? matches[k][1] :null;
				if(m = re.exec(line)){
					var match = {
						name: k,
						matches: m.length > 2 ? m.slice(1) : m[1],
						data: null,
						data_length: null
					};
					if(ext && m[ext] != null){
						match.data_length = Number(m[ext]);
					}
					return match;
				}
			}
		}
		
});