$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box
  var $buttonUpload = $('#upload'); // Upload image to message
  var $buttonSubmit = $('.buttonSubmit'); // Submit message

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();
  var file;
  var dataUrl;
  var fileName;
  var imageLoaded = false;
  var socket = io();
  var ipData;
  

  // Check the user ip and send it to database
  $.getJSON('http://freegeoip.net/json/?callback=?', function(data) {
    ipData = data;
    socket.emit('user ip', data);
  });

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  // Sets the client's username
  function setUsername () {
    if (!username) {
      username = cleanInput($usernameInput.val().trim());      
    }

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', [username,ipData]);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    if(new RegExp("([a-zA-Z0-9]+://)?([a-zA-Z0-9_]+:[a-zA-Z0-9_]+@)?([a-zA-Z0-9.-]+\\.[A-Za-z]{2,4})(:[0-9]+)?(/.*)?").test(message)) {
        
    }

    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if ((message || dataUrl) && connected) {
      $inputMessage.val('');
      if (dataUrl) {
       data = {
        username: username,
        message: message,
        dataUrl: dataUrl,
        fileName: fileName,
        hasFile: true,
        date: new Date()
      };
      } else {
        data = {
        username: username,
        message: message,
        hasFile: false,
        date: new Date()
      };
      }
      addChatMessage(data);
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', data);
      getHeight();
    }
  }

  function getHeight() {
    var total = 0;
    var totalMessages = -2;
    $('.messages').find('li').each(function() {
      total += $(this).innerHeight();
      ++totalMessages;
    });
    if (($window.height() - total - 100) < 0) {
      socket.emit('remove',totalMessages);
      $( "ul li:nth-child("+3+")" ).remove();
    }
  }
  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">');
    if(new RegExp("([a-zA-Z0-9]+://)?([a-zA-Z0-9_]+:[a-zA-Z0-9_]+@)?([a-zA-Z0-9.-]+\\.[A-Za-z]{2,4})(:[0-9]+)?(/.*)?").test(data.message)) {
      data.message = replaceURL(data.message);
      $messageBodyDiv.append(data.message);
    } else {
      $messageBodyDiv.text(data.message+" ");
    }
    if (data.hasFile) {
      var $img = $(" <img />");
      $img.attr('src', data.dataUrl);
      $img.attr("width", "220px");
      $img.css("border-radius","5px");
      $messageBodyDiv.append("</br></br>").append($img);
    }
    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .attr('id', data.date)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  function replaceURL(text) {
    var urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
    if (text.indexOf('http://') == -1 && text.indexOf('https://') == -1){
      return text.replace(urlRegex, function(url) {
        return '<a href="http://' + url + '">' + url + '</a>';
      });
    } else {
      return text.replace(urlRegex, function(url) {
        return '<a href="' + url + '">' + url + '</a>';
      });
    }
}

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function(event) {
    if (event.target.value == "") {
      $buttonSubmit.prop("disabled", true);   
    } else {
      $buttonSubmit.prop("disabled", false);   
    }
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  $buttonUpload.on('change',function (event) {
    file = event.target.files[0];
      emitFile(file);
  });

  $buttonSubmit.click(function() {
    sendMessage();
    $("label").children("img:first").remove();
    $("label").html("Upload Image");
    dataUrl = "";
    hasFile = false;
  });
            


  function emitFile(file){
    var fileReader = new FileReader();
    fileReader.onloadend = function (e) {
      dataUrl = e.target.result;
      if (username) {
        imageLoaded = true;
        preview();
        $buttonSubmit.prop("disabled", false);   
      }
    }
    fileReader.readAsDataURL(file)     
    fileReader.onerror = function (e) {
      throw 'Error loading image file';
    };
  }

  function preview() {
    $("label").html("");
    var $img = $("<img />");
    $img.attr('src', dataUrl);
    $img.attr("height", "18px");
    $("label").append($img)
  }


  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Ovos messaging";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('disconnect', function () {
    log('you have been disconnected');
  });

  socket.on('reconnect', function () {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', [username,ipData]);
    }
  });

  socket.on('reconnect_error', function () {
    log('attempt to reconnect has failed');
  });

// if user already exist go to chat page
  socket.on('user ip', function (data) {
    username = data;
    setUsername();
  });

});