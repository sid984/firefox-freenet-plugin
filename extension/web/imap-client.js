var IMAP_Client = Extends(TCP_Client, new Class({

		USE_BLOCKS: true,
		
		mailboxes: {
			inbox: 			"inbox",
			outbox: 		"inbox.Sent",
			contacts: 	"inbox.Contacts"
		},
		
		contact_fields: ["Name", "Long", "Short", "Type"],
		
		initialize: function(URL, port){
			this.counter = 0;
			this.patterns = [
				/\*\sOK\s\[CAPABILITY.*\].*/, 		this.onConnectEstablished,
				/\*\sERROR\s.*/,							this.onConnectFailed
			];
			this.URL = URL;
			this.port = port;
			this.queue = [];
			this.checkNewMail();
		},
		
		checkNewMail: function(){
			if(this.connected)
				this.status();
			setTimeout(F(this, this.checkNewMail), 60000);
		},
		
		block: function(blocked){
			this.blocked = blocked;
			this.onStatus("block", blocked);
		},
		
		// request = {command: ..., params: ..., .....}
		exec: function(request){
			if(this.USE_BLOCKS && this.blocked){
				this.queue.push(request);
				return;
			}
			
			this.block(true, true);
			
			this.counter++;
			var prefix = ("000" + String(this.counter));
			prefix = prefix.substring(prefix.length - 3);
			prefix = "a" + prefix + " ";
			
			this.parser = new IMAP_Parser(
				request,
				prefix,
				F(this, this.onEvent),
				F(this, this.dropParser)
			);
			this.write(prefix + request.command + " " + (request.params || ""));
		},
		
		releaseQueue: function(){
			var request = this.queue.shift();
			if(request)
				this.exec(request);
		},
		
		dropParser: function(){
			this.parser = null;
		},
		
		onEvent: function(event, message, data, request){
			log("onEvent: " + event);
			log(data);
			
			this.block(false);
			
			switch(event){
				case "onLogin":
					this.onLogin(true);
					//this.select();
					break;
				case "onLoginFailed":
					this.onLogin(false);
					break;
				case "onStatus":
					this.onUnseen(data[0].matches[0]);
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
					
					Each(this.mailboxes, function(m, k){
						if(request.params == m)
							this.mailbox = k;
					}, this);
					
					this.onMailboxTotal(this.mailbox, total.exists, total.recent);
					break;
				case "noMailbox":
					this.createMailbox(request.params);
					break;
				case "onCreate":
					this.select(request.params);
					break;
				case "onFetch":
					var list = [];
					var mail = {};
					
					for(var i = 0; i < data.length; i++){
						if(data[i].name == "list"){
							
							var mail = this.parseEnvelope(data[i].matches);
							//var headers = this.parseHeaders(data[i].data);
							list.push(mail);
							
						} else if(data[i].name == "contact"){
							
							var item = {
								id: data[i].matches[0]
							};
							var contact = this.parseContacts(data[i].data);
							contact.Mail = this.cutFreemailAddress(contact.Long);
							log(contact);
							list.push(Apply(item, contact));
							
						} else if(data[i].name == "mail"){
							
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
					
					if(request.type == "mail")
						this.onFetch(Apply(mail, {mailbox: this.mailbox}));
					else
						this.onMailboxData(list, request.mailbox);
						
					break;
				/*
				case "onStore":
					this.expunge();
					break;
				*/
			}
			
			if(request.callback)
				request.callback();
			
			if(!this.blocked)
				this.releaseQueue();
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
				var re = new RegExp("^" + fields[k] + ":\\s?(.*)", "m");
				if(m = re.exec(headers))
					result[fields[k]] = m[1];
			}
			return result;
		},
		
		parseEnvelope: function(matches){
			var fields = qw("id flags date subject from to");
			var data = {};
			Every(fields, function(k, i){
				if(k == "from" || k == "to"){
					var m = /(NIL|\".*?\")\s+(NIL|\".*?\")\s+(NIL|\".*?\")\s+(NIL|\".*?\")/
						.exec(matches[i]).slice(1);
					Every(m, function(v, i){
						m[i] = v == "NIL" ? null : v.substring(0, v.length - 1).substring(1);
					});
					data[k] = {
						name: m[0],
						mail: this.cutFreemailAddress(m[2] + "@" + m[3]),
					};
				} else if(k == "date" || k == "subject"){
					if(matches[i] != "NIL")
						data[k] = matches[i].substring(0, matches[i].length - 1).substring(1);
				} else if(k == "flags"){
					var f = matches[i].split(/\s+/);
					data[k] = {};
					Every(f, function(v){
						if(v)
							data[k][v.substring(1)] = true;
					});
				} else {
					data[k] = matches[i];
				}
			}, this);
			return data;
		},
		
		parseContacts: function(data){
			var result = {};
			var m;
			
			var n = data.indexOf("\r\n\r\n");
			result.Notes = data.substring(n + 4);
			data = data.substring(0, n);
			
			for(var k in this.contact_fields){
				var re = new RegExp("^" + this.contact_fields[k] + ":\\s(.*)", "m");
				if(m = re.exec(data))
					result[this.contact_fields[k]] = m[1];
			}
			return result;
		},
		
		cutFreemailAddress: function(address){
			if(address && (m = /([\w\d\_]+\@)([\w\d\_]{30,154})(\.freemail)/.exec(address))){
				var key = m[2];
				//var cutted = m[1] + key.substring(0, 3) + "..." + key.substring(key.length - 3, key.length) + m[3];
				var cutted = m[1] + key.substring(0, 6) + ".." + m[3];
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
			this.status();
			this.onStatus("logged", logged);
		},
		
		onMailboxTotal: function(mailbox, exists, recent){
			//log("exists/recent = " + exists + "/" + recent);
			this.onStatus("total", {
				exists: exists,
				recent: recent,
				mailbox: mailbox
			});
		},
		
		onMailboxData: function(list, mailbox){
			//log(list);
			this.onStatus("data", {
				list: list,
				mailbox: mailbox
			});
		},
		
		onFetch: function(mail){
			//log(mail);
			this.onStatus("mail", mail);
		},
		
		onConnectEstablished: function(){
			this.onStatus("ready");
		},
		
		onUnseen: function(count){
			this.onStatus("unseen", count);
		},
		
		onStatus: function(status, data){}, // OCERRIDE
		
		
		// ******* PUBLIC ********
		
		login: function(login, password){
			if(this.connected){
				log("Logging with session " + this.session + "...    ");
				this.exec({
					command: "LOGIN",
					params: login + " " + password
				});
			} else {
				this.onConnectEstablished = F(this, function(){
					this.onStatus("ready");
					this.login();
				});
				this.connect();
			}
		},
		
		logout: function(){
			this.exec({
				command: "LOGOUT"
			});
			this.disconnect();
		},
		
		// mailbox = inbox | inbox.Sent | inbox.Contacts
		select: function(mailbox, callback){
			this.mailbox = mailbox || this.mailbox; 
			this.exec({
				command: "SELECT",
				params: this.mailbox,
				callback: F(this, this.expunge, [callback])
			});
		},
		
		fetchMailbox: function(name, callback){
			var mailbox = this.mailboxes[name];
			this.select(mailbox, name == "contacts" 
				? F(this,this.fetchContacts, [callback])
				: F(this,  this.fetchAll,	[name, callback])
			);
		},
		
		fetchAll: function(mailbox, callback){
			this.exec({
				command: "FETCH",
				//params: "1:* (FLAGS BODY[HEADER.FIELDS (FROM SUBJECT DATE)])",
				params: "1:* (FLAGS ENVELOPE)",
				mailbox: mailbox,
				callback: callback
			});
		},
		
		fetch: function(n, mailbox){
			var _fetch = F(this, this.exec, [{
				command: "FETCH",
				params: n + " (FLAGS INTERNALDATE ENVELOPE BODY[])",
				mailbox: mailbox,
				type: "mail"
			}]);
			if(this.mailbox == mailbox)
				_fetch();
			else
				this.select(mailbox, _fetch);
		},
		
		fetchContacts: function(callback){
			this.exec({
				command: "FETCH",
				params: "1:* (BODY[])",
				mailbox: "contacts",
				callback: callback
			});
		},
		
		saveContact: function(contact, callback){
			var body = "\r\n";
			Every(this.contact_fields, function(name){
				if(contact[name])
					body += name + ": " + contact[name] + "\r\n";
			});
			body += "\r\n" + contact.Notes; 
			
			/*
			SELECT, EXPUNGE
			? STORE n FLAGS+ (\Deleted)
			? EXPUNGE
			APPEND
			FETCH
			*/
			
			var append = F(this, this.append, [
				this.mailboxes.contacts,
				body,
				F(this, this.fetchContacts, [callback])
			]);
			
			var remove = F(this, this.remove, [
				contact.id,
				F(this, this.expunge, [append])
			]);
			
			this.select(this.mailboxes.contacts, contact.id == null	? append : remove);
		},
		
		removeContact: function(id, callback){
			/*
			SELECT, EXPUNGE
			STORE n FLAGS+ (\Deleted)
			EXPUNGE
			FETCH
			*/
			this.select(this.mailboxes.contacts, F(this, this.remove, [
				id,
				/*F(this, this.expunge, [
					F(this, this.fetchContacts, [callback])
				])*/
				callback
			]));
		},
		
		addMail: function(mailbox, mail){
			var mailbody = "\r\n";
			for(var k in mail.headers){
				mailbody += k + ": " + mail.headers[k] + "\r\n";
			}
			mailbody += "\r\n" + mail.text;
			
			log("trying to save outgoing mail: " + mailbody);
			this.append(this.mailboxes[mailbox], mailbody);
		},
		
		append: function(mailbox, mail, callback){
			this.exec({
				command: "APPEND",
				params: mailbox + " (\\Seen) {" + mail.length + "}" + mail,
				callback: callback
			});
		},
		
		remove: function(id, callback){
			this.store(id, true, "Deleted", callback);
			/*
			this.exec({
				command: "STORE",
				params: id + " +FLAGS (\\Deleted)",
				callback: callback
			});
			*/
		},
		
		store: function(id, add, flag, callback){
			this.exec({
				command: "STORE",
				params: id + " " + (add ? "+" : "-") + "FLAGS (\\" + flag + ")",
				callback: callback
			});
		},
		
		expunge: function(callback){
			this.exec({
				command: "EXPUNGE",
				callback: callback
			});
		},
		
		createMailbox: function(mailbox){
			this.exec({
				command: "CREATE",
				params: mailbox
			});
		},
		
		status: function(){
			this.exec({
				command: "STATUS",
				params: this.mailboxes.inbox + " (Unseen)"
			});
		}
	
}));
