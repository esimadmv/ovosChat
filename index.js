
// importing npm packages
var express = require('express'),
path = require('path'),
app = express(),
http = require('http').Server(app),
Parse = require('parse/node'),
io = require('socket.io')(http);

// Initializing Parse
Parse.initialize("iz50eqmf1pBaAzHMbuPQPkJCH8U55RSsJ7xUwKqj","3rhAxDqtNFKBhpUp70vYKZkvseFEucjFkWYdTKKf");
Parse.serverURL = 'https://ovoschat.back4app.io';

app.use(express.static('public'));

// loading HTML
app.get('/',function(req,res){
  res.sendFile(path.join(__dirname,'public/index.html'));
});

http.listen(8001, function(){
  console.log('listening on *:8000');
});

// Initiating Parse Chats and Users tables
var Chats = Parse.Object.extend("Chats");
var Users = Parse.Object.extend("Users");

var numUsers = 0;

// Connecting to Socket.io
io.on('connection', function (socket) {
  var addedUser = false;
  
  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    var chatMessage = new Chats();
    if (data.hasFile) {
      socket.broadcast.emit('new message', {
        username: data.username,
        message: data.message,
        dataUrl: data.dataUrl,
        fileName: data.fileName,
        date: data.date,
        hasFile: true
      });
      var base64 = data.dataUrl.split('base64,')[1];
      var file = new Parse.File(data[1], { base64: base64 });
      file.save().then(function(success) {
        chatMessage.set("imageUrl", success._url);
	chatMessage.set("hasFile",true);
        chatMessage.set("message", data.message);
        chatMessage.set("username", data.username);
        chatMessage.set("date", data.date);
        chatMessage.save(null, {
          success: function(chatMessage) {
        // Execute any logic that should take place after the object is saved.
        console.log('New object created with objectId: ' + chatMessage.id);
        },
        error: function(chatMessage, error) {
            // Execute any logic that should take place if the save fails.
            // error is a Parse.Error with an error code and message.
            console.log('Failed to create new object, with error code: ' + error.message);
          }
        });
        // The file has been saved to Parse.
      }, function(error) {
        // The file either could not be read, or could not be saved to Parse.
      }); 
    } else {
      socket.broadcast.emit('new message', {
        username: data.username,
        message: data.message,
        date: data.date,
        hasFile: false
      });
        chatMessage.set("date", data.date);
        chatMessage.set("message", data.message);
        chatMessage.set("hasFile",false);
	chatMessage.set("username", data.username);
        chatMessage.save(null, {
          success: function(chatMessage) {
        // Execute any logic that should take place after the object is saved.
        console.log('New object created with objectId: ' + chatMessage.id);
        },
        error: function(chatMessage, error) {
            // Execute any logic that should take place if the save fails.
            // error is a Parse.Error with an error code and message.
            console.log('Failed to create new object, with error code: ' + error.message);
          }
        });
    }
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (data) {
    if (addedUser) return;
    
     var queryChats = new Parse.Query(Chats);
    queryChats.ascending("createdAt").find().then(
     function(res) {
        var data = [];
        for (var i=0;i<10;i++) {
          data[i] = { username : res[i].get("username"),
          message : res[i].get("message"),
	  hasFile: res[i].get("hasFile"),
          dataUrl : res[i].get("imageUrl")};
        }
        socket.emit("history",data);
     });

    // we store the username in the socket session for this client
    socket.username = data[0];
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
    var queryUsers = new Parse.Query(Users);
    queryUsers.equalTo("ip", data[1]["ip"]);
    queryUsers.first({
    success: function(object) {
      console.log(object)
      if (!object) {
        var user = new Users();
        user.set("username",socket.username);
        user.set("ip",data[1]["ip"]);
        user.save(null, {
          success: function(user) {
        // Execute any logic that should take place after the object is saved.
        console.log('New object created with objectId: ' + chatMessage.id);
        },
        error: function(user, error) {
            // Execute any logic that should take place if the save fails.
            // error is a Parse.Error with an error code and message.
            console.log('Failed to create new object, with error code: ' + error.message);
          }
        });

      }
      // Successfully retrieved the object.
    },
    error: function(error) {
      alert("Error: " + error.code + " " + error.message);
    }
    });
  });

  socket.on('user ip', function (data){
    var queryUsers = new Parse.Query(Users);
    queryUsers.equalTo("ip", data["ip"]);
    queryUsers.first({
    success: function(object) {
      if (typeof object != "undefined") {
        var username = object.get("username");
        socket.emit('user ip', username);
      }
      // Successfully retrieved the object.
    },
    error: function(error) {
      alert("Error: " + error.code + " " + error.message);
    }
    });

  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('remove', function (data) {
    var queryChats = new Parse.Query(Chats);
    queryChats.ascending("createdAt").find().then(
     function(res) {
      res[0].destroy({
        success: function(myObject) {
          // The object was deleted from the Parse Cloud.
        },
        error: function(myObject, error) {
          // The delete failed.
          // error is a Parse.Error with an error code and message.
        }
        });

     }
    );
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
