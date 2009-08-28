var SMTP_Client = Extends(TCP_Client, new Class({

		initialize: function(URL, port, login, password){
			this.URL = URL;
			this.port = port;
			this.auth = Base64.encode('\0' + login + '\0' + password);
			this.authenticated = false;
			this.patterns = [
				/220\s\S+\sready/,	 					this.onConnectEstablished,
				/250\sAUTH\sLOGIN\sPLAIN/,		this.doAuth,
				/235\sAuthenticated/,					this.onLogin,
				/250\sOK/,										this.doWriteAddresses,
				/354\sGo\scrazy/,							this.doWriteBody,
				/553\s(.*)/,										this.onFail,
				/504\s(.*)/,										this.onFail,
				/250\sSo\sbe\sit/,							this.onSuccess,
			];
		},
		
		onConnectEstablished: function(){
			log("Using session " + this.session + "...    ");
			this.write("EHLO");
		},
		
		doAuth: function(){
			log("logging with auth " + this.auth + " ...");
			this.write("auth plain " + this.auth);
		},
		
		onLogin: function(){
			this.onStatus("authenticated");
			this.authenticated = true;
			this.step = 0;
			this.doWriteAddresses();
		},
		
		doWriteAddresses: function(){
			log("doWriteAddresses with state " + this.state);
			switch(this.step++){
				case 0:
					this.write("MAIL FROM:" + this.mail.from);
					break;
				case 1:
					this.write("RCPT TO:" + this.mail.to);
					break;
				case 2:
					this.write("DATA");
					break;
			}
		},
		
		doWriteBody: function(){
			log("doWriteBody ...");
			var body = "";
			for(var name in this.mail.headers){
				body += name + ": " + this.mail.headers[name] + "\n";
			}
			body += "\n" + this.mail.text + "\n.";
			this.write(body);
		},
		
		onFail: function(error){
			log("failed with error: " + error);
			this.onStatus("error", error);
			this.disconnect();
		},
		
		onSuccess: function(){
			log("success");
			this.onStatus("success", this.mail);
			this.disconnect();
		},
		
		
		
		// --- PUBLIC ---
		
		// mail = {from: ... , to: ... , text: ... , headers: {From: ... , To: ..., Subject: ... }}
		send: function(mail){
			log("Trying to send mail to " + mail.to + " with text " + mail.body);
			this.onStatus("sending");
			this.mail = mail;
			this.connect();
		},
		
		// --- OVERRIDE ---
		
		onStatus: function(status, message){
			log("onStatus: " + status + " - " + message);
		}
		
}));