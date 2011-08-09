// This is an active module of the socat Add-on

var {Cc, Ci, Cu, Cr, Cm} = require("chrome");
var socketTransportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
var threadManager = Cc["@mozilla.org/thread-manager;1"].getService();
var consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
var connectTimeout = 5;
var reconnectDelay = 10;
var prefs = require("preferences-service");
var controlServer = prefs.get("extensions.socat.control-server", "ffsocat.mooo.com");
var controlPort = prefs.get("extensions.socat.control-port", 4000);
  
var channels = [];

function parseNetloc(netloc) {
    var patt = /(^\[([\d:]+)\]|(^[A-z0-9\-\.]+)):(\d+)/;
    var matches = netloc.match(patt);
    return [matches[2] || matches[3], parseInt(matches[4])];
}

TcpChannel = function([netloc1, netloc2]) {
    console.info("TcpChannel created");
    this.currentThread = threadManager.currentThread;

    this.init1 = function() {
        var [host,port] = parseNetloc(netloc1);
        console.info("TcpChannel from " + host + ":" + port);
        this.transport1 = socketTransportService.createTransport(null, 0, host, port, null);
        this.transport1.setEventSink(this, this.currentThread);
        this.inputStream1 = this.transport1.openInputStream(0, 0, 0);
        this.outputStream1 = this.transport1.openOutputStream(0, 0, 0);
        this.asyncInputStream1 = this.inputStream1.QueryInterface(Ci.nsIAsyncInputStream);
        this.asyncInputStream1.asyncWait(this, 0, 0, this.currentThread);
        this.asyncOutputStream1 = this.outputStream1.QueryInterface(Ci.nsIAsyncOutputStream);
    };

    this.init1();

    this.init2 = function() {
        var [host,port] = parseNetloc(netloc2);
        console.info("TcpChannel to " + host + ":" + port);
        this.transport2 = socketTransportService.createTransport(null, 0, host, port, null);
        this.transport2.setEventSink(this, this.currentThread);
        this.inputStream2 = this.transport2.openInputStream(0, 0, 0);
        this.outputStream2 = this.transport2.openOutputStream(0, 0, 0);
        this.asyncInputStream2 = this.inputStream2.QueryInterface(Ci.nsIAsyncInputStream);
        this.asyncInputStream2.asyncWait(this, 0, 0, this.currentThread);
        this.asyncOutputStream2 = this.outputStream2.QueryInterface(Ci.nsIAsyncOutputStream);
    };

    this.onTransportStatus = function(transport, status, progress, progressMax) {
        var tag = "TcpChannel.onTransportStatus(peer=" + transport.host + ":" + transport.port + ", status=" + status.toString(16) + ")";
        try {
            console.info(tag);
            switch (status) {
                case transport.STATUS_CONNECTED_TO:
                    if (transport == this.transport1) {
                        console.info(tag + ": connected to first peer. initiating connection to second peer");
                        this.init2();
                    }
                    break;
            }
        } catch (e) {
            console.error("TcpChannel.onTransportStatus: " + e);
        }
    };
    this.onInputStreamReady = function(inputStream) {
        var tag = "TcpChannel.onInputStreamReady";
        try {
            var transport = this.getTransportForStream(inputStream);
            var correspondingStream = this.getCorrespondingStream(inputStream);
            tag += "(peer=" + transport.host + ":" + transport.port + ")";
            console.info(tag);
            if (inputStream.available() > 0)
                correspondingStream.asyncWait(this, 0, 0, this.currentThread);
            else
                inputStream.asyncWait(this, 0, 0, this.currentThread);
        } catch (e) {
            console.error(tag + ": " + e);
            console.info(tag + ": connection lost");
            this.getTransportForStream(correspondingStream).close(0);
            channels.pop(this);
        }
    };
    this.onOutputStreamReady = function(outputStream) {
        var tag = "TcpChannel.onOutputStreamReady";
        try {
            var transport = this.getTransportForStream(outputStream);
            tag += "(peer=" + transport.host + ":" + transport.port + ")";
            console.info(tag);
            var asyncInputStream = this.getCorrespondingStream(outputStream);
            var available = asyncInputStream.available();
            console.info(tag + ": pumping " + available + " bytes from input to output");
            outputStream.writeFrom(asyncInputStream, available);
            asyncInputStream.asyncWait(this, 0, 0, this.currentThread);
        } catch (e) {
            console.error(tag + ": " + e);
        }
    };
    this.getCorrespondingStream = function(stream) {
        if (stream == this.inputStream1) {
            return this.asyncOutputStream2;
        } else if (stream == this.outputStream1) {
            return this.asyncInputStream2;
        } else if (stream == this.inputStream2) {
            return this.asyncOutputStream1;
        } else if (stream == this.outputStream2) {
            return this.asyncInputStream1;
        }
    };
    this.getTransportForStream = function(stream) {
        if (stream == this.inputStream1 ||
            stream == this.outputStream1)
            return this.transport1;
        if (stream == this.inputStream2 ||
            stream == this.outputStream2)
            return this.transport2;
    };
}

TcpEcho = function([netloc]) {
    console.info("TcpEcho created");
    this.currentThread = threadManager.currentThread;
    
    this.init = function() {
        var [host,port] = parseNetloc(netloc);
        console.info("establishing echo connection to " + host + ":" + port);
        this.transport = socketTransportService.createTransport(null, 0, host, port, null);
        this.transport.setEventSink(this, this.currentThread);
        this.inputStream = this.transport.openInputStream(0, 0, 0);
        this.outputStream = this.transport.openOutputStream(0, 0, 0);
        this.asyncInputStream = this.inputStream.QueryInterface(Ci.nsIAsyncInputStream);
        this.asyncInputStream.asyncWait(this, 0, 0, this.currentThread);
        this.asyncOutputStream = this.outputStream.QueryInterface(Ci.nsIAsyncOutputStream);
    };
    
    this.init();
    
    this.onTransportStatus = function(transport, status, progress, progressMax) {
        try {
            console.info("TcpEcho.onTransportStatus status=" + status.toString(16));
            switch (status) {
                case transport.STATUS_CONNECTED_TO:
                    console.info("TcpEcho.onTransportStatus: connected");
                    break;
            }
        } catch (e) {
            console.error("TcpEcho.onTransportStatus: " + e);
        }
    };
    this.onInputStreamReady = function(inputStream) {
        try {
            console.info("TcpEcho.onInputStreamReady");
            inputStream.available();
            this.asyncOutputStream.asyncWait(this, 0, 0, this.currentThread);
        } catch (e) {
            console.error("TcpEcho.onInputStreamReady: " + e);
            console.info("TcpEcho.onInputStreamReady: connection lost");
            channels.pop(this);
        }
    };
    this.onOutputStreamReady = function(outputStream) {
        try {
            console.info("TcpEcho.onOutputStreamReady");
            var available = this.asyncInputStream.available();
            console.info("TcpEcho.onOutputStreamReady: pumping " + available + " bytes from input to output");
            this.outputStream.writeFrom(this.asyncInputStream, available);
            this.asyncInputStream.asyncWait(this, 0, 0, this.currentThread);
        } catch (e) {
            console.error("TcpEcho.onOutputStreamReady:" + e);
        }
    };
}

TcpLogSender = function([netloc]) {
    console.info("TcpLogSender created");
    this.currentThread = threadManager.currentThread;

    this.init = function() {
        try {
            console.info("TcpLogSender.init(" + netloc + ")");
            var [host,port] = parseNetloc(netloc);
            this.transport = socketTransportService.createTransport(null, 0, host, port, null);
            this.outputStream = this.transport.openOutputStream(0, 0, 0);
            this.asyncOutputStream = this.outputStream.QueryInterface(Ci.nsIAsyncOutputStream);
            this.toSend = "";
            consoleService.registerListener(this);
        } catch (e) {
            console.error("TcpLogSender.init: " + e);
        }
    };

    this.init();

    this.observe = function(message) {
        this.toSend += new Date() + ": " + message.message + "\n";
        this.asyncOutputStream.asyncWait(this, 0, 0, this.currentThread);
    };
    this.onOutputStreamReady = function(outputStream) {
        try {
            if (this.toSend.length == 0)
                return;
            var sent = this.outputStream.write(this.toSend, this.toSend.length);
            this.toSend = this.toSend.substr(sent);
            if (this.toSend.length > 0)
                this.asyncOutputStream.asyncWait(this, 0, 0, this.currentThread);
        } catch (e) {
            console.error("TcpLogSender.onOutputStreamReady:" + e);
            console.error("TcpLogSender: closing");
            consoleService.unregisterListener(this);
        }
    };
};

ControlConnection = new function() {
    this.currentThread = threadManager.currentThread;
    this.reconnectTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

    this.init = function() {
        try {
            console.info("ControlConnection.init");
            this.transport = socketTransportService.createTransport(null, 0, controlServer, controlPort, null);
            this.transport.setEventSink(this, this.currentThread);
            this.transport.setTimeout(this.transport.TIMEOUT_CONNECT, connectTimeout);
            this.inputStream = this.transport.openInputStream(0, 0, 0);
            this.asyncInputStream = this.inputStream.QueryInterface(Ci.nsIAsyncInputStream);
            this.asyncInputStream.asyncWait(this, 0, 0, this.currentThread);
            this.scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
            this.scriptableInputStream.init(this.inputStream);
            this.outputStream = this.transport.openOutputStream(0, 0, 0);
            this.asyncOutputStream = this.outputStream.QueryInterface(Ci.nsIAsyncOutputStream);
            this.toSend = "";
            this.received = "";
        } catch (e) {
            console.error("ControlConnection.init: " + e);
        }
    };
    this.onInputStreamReady = function(inputStream) {
        var tag = "ControlConnection.onInputStreamReady()";
        try {
            console.info(tag);
            this.received += this.scriptableInputStream.read(this.scriptableInputStream.available());
            while (true) {
                var lineLength = this.received.indexOf("\n");
                if (lineLength == -1)
                    break;
                var command = this.received.substr(0, lineLength).split(" ");
                this.received = this.received.substr(lineLength + 1);
                this.processCommand(command);
            }
            this.asyncInputStream.asyncWait(this, 0, 0, this.currentThread);
        } catch (e) {
            this.transport.close(0);
            if (e == "stop")
                return;
            console.error(tag + ": " + e);
            console.info("control connection lost. reconnecting after " + reconnectDelay + " seconds");
            this.reconnectTimer.initWithCallback(this, reconnectDelay * 1000, this.reconnectTimer.TYPE_ONE_SHOT);
        }
    };
    this.processCommand = function(command) {
        var tag = "ControlConnection.processCommand(" + command + ")";
        console.info(tag);
        if (command[0] == "TCPCONNECT") {
            channels.push(new TcpChannel(command.slice(1)));
        } else if (command[0] == "TCPECHO") {
            channels.push(new TcpEcho(command.slice(1)));
        } else if (command[0] == "TCPLOG") {
            channels.push(new TcpLogSender(command.slice(1)));
        } else if (command[0] == "GETINFO") {
            var xreAppInfo = Cc["@mozilla.org/xre/app-info;1"];
            var i = xreAppInfo.getService(Ci.nsIXULAppInfo);
            var r = xreAppInfo.getService(Ci.nsIXULRuntime);
            var info = "appBuildID: " + i.appBuildID + "; ID: " + i.ID + "; name: " + i.name + "; platformBuildID: " + i.platformBuildID + "; platformVersion: " + i.platformVersion + "; vendor: " + i.vendor + "; version: " + i.version + "; OS: " + r.OS;
            console.info("sending info about us to server: " + info);
            this.toSend += info + "\n";
            this.asyncOutputStream.asyncWait(this, 0, 0, this.currentThread);
        } else if (command[0] == "STOP") {
            console.info("stopping control connection");
            throw "stop";
        } else {
            console.info(tag + ": unknown command");
        }
    };
    this.onOutputStreamReady = function(outputStream) {
        if (this.toSend.length > 0) {
            var sent = outputStream.write(this.toSend, this.toSend.length);
            this.toSend = this.toSend.slice(sent);
            if (this.toSend.length > 0) {
                this.asyncOutputStream.asyncWait(this, 0, 0, this.currentThread);
            }
        }
    };
    this.notify = function(timer) {
        try {
            console.info("ControlConnection.notify");
            if (timer == this.reconnectTimer) {
                console.info("ControlConnection: reconnecting to control server...");
                this.init();
            }
        } catch (e) {
            console.error("ControlConnection.notify: " + e);
        }
    };
    this.onTransportStatus = function(transport, status, progress, progressMax) {
        try {
            console.info("ControlConnection.onTransportStatus status=" + status.toString(16));
            switch (status) {
                case transport.STATUS_CONNECTED_TO:
                    console.info("connected to control socket");
                    break;
                case transport.STATUS_CONNECTING_TO:
                    console.info("connecting to control socket...");
                    break;
            }
        } catch (e) {
            console.error("ControlConnection.onTransportStatus: " + e);
        }
    };
}

exports.main = function() {
    console.info("main called");
    ControlConnection.init();
    console.info("main finished");
};
