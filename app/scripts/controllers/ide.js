'use strict';
var app = angular.module('codeboardApp');

app.controller('IdeCtrl',
  ['$scope', '$rootScope', '$log', '$sce', '$location', '$routeParams', '$window', '$http', '$timeout', '$uibModal', 'ProjectFactory', 'projectData', 'ltiData', 'IdeMsgService', 'IdeSnippetsSrv','UserSrv', 'WebsocketSrv',
    function ($scope, $rootScope, $log, $sce, $location, $routeParams, $window, $http, $timeout, $uibModal, ProjectFactory, projectData, ltiData, IdeMsgService, IdeSnippetsSrv, UserSrv, WebsocketSrv) {


      // First we handle all data that was injected as part of the app.js resolve.
      // set the ProjectFactory to contain the project loaded from the server
      ProjectFactory.setProjectFromJSONdata(projectData, ltiData);
     // var server = require('../../../server.js');

      /**
       * Function to load the saved version of a project for a user.
       * Note: this function needs to execute when the controller is loaded. We invoke the function at the end
       * of the controller. Don't invoke it any earlier as we first need to parse all the functions declared
       * in the controller.
       */
      var loadUserProject = function() {

        // if the current user in the role of 'user' (and not 'owner'),
        // we check if there's a saved version that we could load
        // also, we only need to check if the current user is actually authenticated (rather than being #anonymous)
        if (ProjectFactory.getProject().userRole == 'user' &&  UserSrv.isAuthenticated()) {

          // the url from which to get the files of the user's project
          var _urlForUserProject = '/api/users/' + UserSrv.getUsername() + '/projects/' + $routeParams.projectId;

          // if we have a Lti user, we need to attach the Lti parameters because the server checks if the user is an lti user and grants access accordingly
          if($routeParams.ltiSessionId && $routeParams.ltiUserId && $routeParams.ltiNonce) {
            _urlForUserProject += '?ltiSessionId=' + $routeParams.ltiSessionId + '&ltiUserId=' + $routeParams.ltiUserId + '&ltiNonce=' + $routeParams.ltiNonce;
          }

          // check if the user has a saved version of a project
          $http
            .get(_urlForUserProject)
            .success(function(result) {

              /** The controller for the modal */
              var loadUserProjectModalInstanceCtrl =  ['$scope', '$uibModalInstance', 'UserSrv', function ($scope, $uibModalInstance, UserSrv) {

                $scope.ok = function () {
                  $uibModalInstance.close();
                };

                $scope.cancel = function () {
                  $uibModalInstance.dismiss();
                };

                $scope.getUsername = function() {
                  return UserSrv.getUsername();
                }
              }];


              /** Function to open the modal where the user must confirm the loading of the project */
              var openModal = function(closeAction, dismissAction) {

                var modalInstance = $uibModal.open({
                  templateUrl: 'ideLoadUserProjectModal.html',
                  controller: loadUserProjectModalInstanceCtrl
                });

                modalInstance.result.then(
                  function () {
                    // the user clicked ok (i.e. the promise resolves successfully)
                    $log.debug('User confirmed to load saved project.');

                    // run the closeAction function if it's defined
                    if (closeAction) {
                      closeAction();
                    }

                    // we need to request that the URI is check for any "?view=..." query string
                    // in order to display some files in the ace editor
                    $rootScope.$broadcast(IdeMsgService.msgProcessViewQueryStringRequest().msg);
                  },
                  function () {
                    // the user canceled (i.e. the promise is rejected)
                    $log.debug('User canceled loading of the saved project.');

                    // run the dissmissAction if it's defined
                    if (dismissAction) {
                      dismissAction();
                    }

                    // we need to request that the URI is check for any "?view=..." query string
                    // in order to display some files in the ace editor
                    $rootScope.$broadcast(IdeMsgService.msgProcessViewQueryStringRequest().msg);
                  });
              };


              // the http call to check if the user has a saved version was successful, thus
              // we call the openModal() function; as a first arguement we provide a function
              // that will load the user's version into the ProjectFactory
              openModal(function() {

                // this inner function will be called if the user agrees
                // it will overwrite the default version of the project with the user's version
                var userProjectData = {
                  // the name of the project
                  name: ProjectFactory.getProject().name,
                  // the last unique Id that was used to create a file
                  lastUId: result.project.lastUId,
                  // programming language of the project
                  language: ProjectFactory.getProject().language,
                  // the role of the user who is currently looking at the project in the browser
                  userRole: ProjectFactory.getProject().userRole,
                  // the files of the user
                  fileSet: result.files
                };


                // update the project data in the ProjectFactory
                ProjectFactory.setProjectFromJSONdata(userProjectData, ltiData, ProjectFactory.getProject().staticFiles);


                // make sure the Tree reloads and shows the user's version
                $rootScope.$broadcast(IdeMsgService.msgReloadTreeFromProjectFactory().msg);

              });
            })
            .error(function(err) {
              $log.debug(err);

              // we need to request that the URI is check for any "?view=..." query string
              // in order to display some files in the ace editor
              $rootScope.$broadcast(IdeMsgService.msgProcessViewQueryStringRequest().msg);
            });
        }
        else {
          // don't need to show the modal for loading a user project
          // but we need to request that the URI is check for any "?view=..." query string
          // in order to display some files in the ace editor
          $rootScope.$broadcast(IdeMsgService.msgProcessViewQueryStringRequest().msg);
        }
      };



      // this function is called when closing or reloading the browser window
      $window.onbeforeunload = function (event) {
        var message = 'You currently have unsaved changes.';

        // make sure we saved the content currently displayed before deciding if there are unsaved changes
        saveCurrentlyDisplayedContent();

        if (typeof event == 'undefined') {
          event = window.event;
        }
        if (event && ProjectFactory.isProjectModified()) {
          event.returnValue = message;
          return message;
        }
        else {
          // returning a void values prevents the popup to be shown
          return null;
        }
      }


      // this function is called when the user clicks on some UI element (e.g. button) that changes the location
      $scope.$on('$locationChangeStart', function(event) {

        // make sure we saved the content currently displayed before deciding if there are unsaved changes
        saveCurrentlyDisplayedContent();

        // if the user has unsaved changes, show the message
        if(ProjectFactory.isProjectModified()) {

          var message = 'You currently have unsaved changes.\n\nAre you sure you want to leave this page?';

          var answer = confirm(message);
          if (!answer) {
            event.preventDefault();
          }
        }
      });


      // if the project Url has a query string with a "view" parameter, we use that information
      // to open some files in the editor
      // Example: ?view=2.1-1.0 would open the files with nodeId 2 and nodeId 1 and make file 2 the active one
      // The general format is: ?view=nodeId.active-nodeId.active-nodeId.active-...
      var processViewQueryString = function processViewQueryString () {

        // check for the "view" query string
        if($routeParams.view) {

          $log.debug('idejs.processViewQueryString: Found a "view" query string in the URL: ' + $routeParams.view);

          // Array containing objects where each object defines the settings for a particualr file
          var viewSettings = [];

          // split the "view" query string on all "-" characters
          var queryStringElements = ($routeParams.view).split('-');


          for(var i = 0; i < queryStringElements.length; i++) {

            // split the element at the "dot" to get the nodeId and the active setting
            var details = queryStringElements[i].split('.');

            // we expect that a details has 2 numbers (check via isNaN)
            if(!(details.length == 2 && isNaN(details[0]) && isNaN(details[1]))) {

              var nodeId = parseInt(details[0]);
              var nodeActive = parseInt(details[1])

              // check that the nodeId actually exists in the project and that it's not representing a folder
              if (ProjectFactory.hasNode(nodeId) && !(ProjectFactory.getNode(nodeId).isFolder)) {

                var viewSetting = {
                  nodeId: nodeId,
                  nodeActive: nodeActive
                };

                // store the view setting for the current file
                viewSettings.push(viewSetting);
              }
            }
          }

          // open all the files based on their nodeId
          for (var i = 0; i <  viewSettings.length; i++) {
              var req = IdeMsgService.msgDisplayFileRequest(viewSettings[i].nodeId);
              $rootScope.$broadcast(req.msg, req.data);
          }

          // now that all files have been opened in the right order, we figure out which file should be the active one
          for (var i = 0; i <  viewSettings.length; i++) {
            if(viewSettings[i].nodeActive) {
              var req = IdeMsgService.msgDisplayFileRequest(viewSettings[i].nodeId);
              $rootScope.$broadcast(req.msg, req.data);
            }
          }
        }
      };


      /**
       * Function that handles the displaying of a Mantra WebSocket output.
       * @param {string} aStreamUrl - the WS Url to connect to the Mantra container
       * @param {string} aStartUrl - the Url to start the Mantra container
       * @param {boolean} [aRenderAsHtmlOutput=false] - should the output be rendered as HTML
       */
      var displayWSOutputStream = function(aStreamUrl, aStartUrl, aRenderAsHtmlOutput) {

        // counter for the number of messages added to the output (1 on every WS send event)
        var numOfMessages = 0;
        // max number of messages we allow
        var maxNumOfMessageCharacters = 15000;

        // if aRenderAsHtmlOutput is undefined, default to false
        // if the language doesn't require compilation, e.g. Python, enable the html rendering of the output
        var lRenderOutputAsHTML = aRenderAsHtmlOutput || !($scope.isCompilationNeeded());

        // clear the output
        setOutput('', lRenderOutputAsHTML);
        //setOutput('displayWSOutputStream',lRenderOutputAsHTML);

        var onWSOpenCallback = function () {

          $http.get(aStartUrl)
            .then(function (success) {
              $scope.mantraID = aStartUrl.split('/')[3];
              $log.debug('websocketSrvjs.onOpen: container successfully started');
              
              if(ideState.actionAllowsForStopping) {
                // send out a msg that now a container is running that could be stopped (e.g. by the user)
                $rootScope.$broadcast(IdeMsgService.msgStoppableActionAvailable().msg);
              }
            },
            function (errorResponse) {
              $log.debug('websocketSrvjs.onOpen: problem starting container.');
              $log.debug(errorResponse);
            });
        };

        var aNewlyReceivedData = '';
        var mensajes = [];

        // Function to handle the event of the WS receiving data
        var onWSDataHandler = function(aNewlyReceivedData) {
          
//AQUI RECIBE EL MENSAJE DE LA COMPILACION
          var outputLength = addToOutput(aNewlyReceivedData, lRenderOutputAsHTML);
          mensajes.push(aNewlyReceivedData);
          //CODIGO MIO JESUS
          //$window.alert(aNewlyReceivedData);
          //if(!$scope.mensajeEnviado){
            /*var urlPrueba = '/api/' + UserSrv.getUsername() + '/test';
            var data = {
              date : new Date(),
              user: UserSrv.getUsername(),
              id:$routeParams.projectId,
              action:$scope.accion,
              project:ProjectFactory.getProject(),
              output:aNewlyReceivedData
              //
              };
              var dataJ = JSON.stringify(data);
              $http({
                method: 'POST',
                url: urlPrueba,
                data: dataJ,
                timeout: 4000
            }).then(function(result){
              $window.alert('Output de la compilacion enviado');
            });*/
            $scope.mensajeEnviado = true;            
         // }
          /*var req = IdeMsgService.msgCompileRequest();
          $http.post(urlPrueba,req).then(function(result){
            $window.alert('Output de la compilacion enviado');
          });*/
          //HASTA AQUI
          // account for the number of messages
          numOfMessages += 1;
          //if(numOfMessages > maxNumOfMessages) {
          if(outputLength > maxNumOfMessageCharacters) {
            addToOutput("\n\nYour program output has more than " + maxNumOfMessageCharacters + " characters. That's quite a lot.\n" +
              'For this reason, Codeboard has terminated your program.\n\n', lRenderOutputAsHTML);

            WebsocketSrv.close(true);
          }
        }

        // Function to handle the event of the WS closing
        var onWSCloseCallback = function() {
          // if no message was added via WS, we set a message that the action completed
          //$window.alert('Socket closed');

        /*  if(/error/.test(mensajes[mensajes.length - 1])){
            $window.alert("Compilation Error");
          };
          if(/Exception/.test(mensajes[mensajes.length - 1])){
            $window.alert("Running Error");
          };*/
          var usuario;
          if (UserSrv.getUsername() == ""){
            usuario = "anonymous";
          }else{
            usuario = UserSrv.getUsername();
          }
          var urlPrueba = '/api/' + usuario + '/test';
          var data = {
            date : $scope.startT,
            user: usuario,
            id:$scope.mantraID,
            projectId:$routeParams.projectId,
            action:$scope.accion,
            project:ProjectFactory.getProject(),
            output:mensajes.toString()
            //
            };
            var dataJ = JSON.stringify(data);
            $http({
              method: 'POST',
              url: urlPrueba,
              data: dataJ,
              timeout: 4000
          }).then(function(result){
            //$window.alert('Output de la compilacion enviado');
          });
          if(numOfMessages === 0) {
            addToOutput('--Session ended without output.--', false);
          }

          // we no longer have a stoppableAction
          // send out a msg stoppableActionGone
          // that could trigger that the stop button disappears
          $rootScope.$broadcast(IdeMsgService.msgStoppableActionGone().msg);

          setEnabledActions(1,1,1,1,1);
        };

        // TODO stopAction: make a callback function or onOpen which makes the http startUrl call
        // the startUrl call should return the stopUrl
        // we could then broadcast a msg: stoppableActionAvailable
        // with that message, the stopBtn appears
        //

        WebsocketSrv.connect(aStreamUrl, onWSOpenCallback, onWSDataHandler, onWSCloseCallback);
      };


      /**
       * Calling this function will trigger a saving of the content that's currently
       * displayed in the editor. This should e.g. be done before compiling or
       * submitting a solution.
       */
      var saveCurrentlyDisplayedContent = function() {
        // if the editor is currently displaying a file, we need to store the content first
        if ($scope.ace.currentNodeId !== -1) {
          // if the value is !== -1, then some tab is open
          ProjectFactory.getNode($scope.ace.currentNodeId).content = $scope.ace.editor.getSession().getValue();
        }
      }


      /**
       * Sets the output.
       * Note that the argument renderAsHtml can be overriden by
       * the UI setting "showOutputAsText"
       * @param outputToDisplay the value to display in the output
       * @param renderAsHtml should the output be rendered as html
       */
      var setOutput = function(outputToDisplay, renderAsHtml) {

        $scope.renderHtmlOutput = false;

        if(renderAsHtml && !($scope.uiSettings.showOutputAsText)) {
          $scope.output = '';
          $scope.htmlOutput = $sce.trustAsHtml(outputToDisplay);
          $scope.renderHtmlOutput = true;
        }
        else {
          $scope.output = outputToDisplay;
          $scope.htmlOutput = '';
          $scope.renderHtmlOutput = false;
        }
      };

      // the output in the console of the ide
      setOutput('This will display the output.', false);

      /**
       * Adds the given aOutputToAdd to the existing output
       * @param aOutputToAdd the value to add to the output
       * @param renderAsHtml should the output be rendered as html
       * @return {number} the number of characters displayed in the output
       */
      var addToOutput = function(aOutputToAdd, renderAsHtml) {

        $scope.renderHtmlOutput = false;

        if(renderAsHtml && !($scope.uiSettings.showOutputAsText)) {

          // get the current output and add the new output
          var lConcatOutput = $scope.htmlOutput + aOutputToAdd;
          $scope.htmlOutput = $sce.trustAsHtml(lConcatOutput);
          $scope.renderHtmlOutput = true;
        }
        else {
          $scope.output += aOutputToAdd;
          $scope.renderHtmlOutput = false;
        }

        // if there is an htmlOutput, we need to unwarp it before we can count it's length.
        return $scope.output.length + ($scope.htmlOutput.$$unwrapTrustedValue ? $scope.htmlOutput.$$unwrapTrustedValue().length : 0);
      };


      // check if Websockets are supported; if not, show a warning message
      if ('WebSocket' in window && (typeof WebSocket === 'function' || typeof WebSocket === 'object')) {
        $log.debug('Info: Browser supports WebSockets')
      } else {
        setOutput('Warning: your browser does not support WebSockets.\n' +
          'This may cause Codeboard to not work properly.\n' +
          'Please consider updating to a newer browser.', false);
      }


      /**
       * Function that executes a compilation of the current project.
       * @param runCleanCompile if true, a clean-compilation will be requested
       */
      var compileProject = function (runCleanCompile) {

        // make sure we saved the content before compiling
        saveCurrentlyDisplayedContent();

        // remove previous compilation results
        setOutput('Waiting for results...', false);

        // disable all actions till the compile request is completed
        setEnabledActions(0,0,0,0,0);

        // the factory makes the call to the server, returns a promise
        var promise = ProjectFactory.compileProject(runCleanCompile);

        // handler for when the promise is resolved
        promise.then(
          function (data) { // note: we only get the data because the resolution to 'then' indicates that the call was successful; thus no header information

            //
            ideState.stopUrl = data.stopUrl;

            // the success case gives us a url to the Mantra WebSocket and a url how to start the container
            displayWSOutputStream(data.streamUrl, data.startUrl);
          },
          function (reason) {
            // the error callback
            $log.debug('Error while trying to run your program. The server responded:\n' + reason);

            setOutput('Error while trying to run your program. The server responded:\n' + reason, false);

            // disable the action to send another compile request
            setEnabledActions(1,0,0,1,0);

            // make sure all listeners know that there's no stoppable action available
            $rootScope.$broadcast(IdeMsgService.msgStoppableActionGone().msg);
          }
        );
      };


      /**
       * Function that executes a "run" of the current project.
       */
      var runProject = function () {

        // remove previous output message
        setOutput('Waiting for results...', false);

        // disable all actions while we wait for the request to complete
        setEnabledActions(0,0,0,0,0);

        ProjectFactory
          .runProject()
          .then(function (data) { // note: we only get the data because the resolution to 'then' indicates that the call was successful; thus no header information

            // set the Url on how to stop the current run-action
            ideState.stopUrl = data.stopUrl;

            // the success case gives us a url to the Mantra WebSocket and a url how to start the container
            displayWSOutputStream(data.streamUrl, data.startUrl, true);

          },
          function (reason) {
            // the error callback
            $log.debug('Error when trying to run your program. The server responded:\n' + reason);

            // display the error to the user
            setOutput('Error when trying to run your program. The server responded:\n' + reason, false);

            // something went wrong while trying to run the program (maybe it was deleted?)
            // so we only allow the user to compile
            setEnabledActions(1,0,0,1,0);

            // make sure all listeners know that there's no stoppable action available
            $rootScope.$broadcast(IdeMsgService.msgStoppableActionGone().msg);
          }
        );

        // set the focus on the editor so user can start typing right away
        $scope.ace.editor.focus();
      };


      /**
       * Tests the current project
       */
      var testProject = function() {
        // make sure we save the current content before submitting
        saveCurrentlyDisplayedContent();

        // update the message in the console
        setOutput('Testing your solution. This might take a few seconds. Please wait...', false);

        // disable all other actions while we wait for the test to complete
        setEnabledActions(0,0,0,0,0);

        // test the project
        var promise = ProjectFactory.testProject();
        promise.then(
          function(data) {
            $log.debug('Testing successful.');

            if(data.compilationError) {
              // a compilation error occured and thus the tests will not have been run
              // we display the compilation error
              setOutput('Testing failed. Your program does not compile.\nFix all compilation errors and try again.\n\n--- Details ---\n\n' + data.outputCompiler, false);
            } else {
              setOutput('Number of passing tests: ' + data.numTestsPassing + '\nNumber of failing tests: ' + data.numTestsFailing + '\n\n--- Details ---\n\n' + data.output, false);
            }

            // enable all actions except running
            setEnabledActions(1,0,1,1,1);
          },
          function(reason) {
            $log.debug('Error while trying to test your program. The server responded:\n' + reason);

            setOutput('Error while trying to test your program. The server responded:\n' + reason, false);

            // something went wrong so we only enable compilation and testing again
            setEnabledActions(1,0,1,1,0);
          }
        )
      }


      /**
       * Execute the "tool" action on the current project
       */
      var toolAction = function() {
        // make sure we save the current content before submitting
        saveCurrentlyDisplayedContent();

        // update the message in the console
        setOutput('Analyzing your project. This might take a few seconds. Please wait...', false);

        // disable all other actions while we wait for the test to complete
        setEnabledActions(0,0,0,0,0);

        // test the project
        var promise = ProjectFactory.toolAction();
        promise.then(
          function(data) {
            $log.debug('Tool action successful.');

            if(data.compilationError) {

              // a compilation error occured and thus the tests will not have been run
              // we display the compilation error
              setOutput('Analysis failed. Your program does not compile.\nFix all compilation errors and try again.\n\n--- Details ---\n\n' + data.outputCompiler, false);
            } else {
              // setOutput('Number of passing tests: ' + data.numTestsPassing + '\nNumber of failing tests: ' + data.numTestsFailing + '\n\n--- Details ---\n\n' + data.output, false);
              setOutput(data.output, false);
            }

            // enable all actions except running
            setEnabledActions(1,0,1,1,1);
          },
          function(reason) {
            $log.debug('Error while running the tool-action on your program. The server responded:\n' + reason);

            setOutput('Error while running the requested action on your program. The server responded:\n' + reason, false);

            // something went wrong so we only enable compilation and testing again
            setEnabledActions(1,0,1,1,0);
          }
        )
      };


      /**
       * Submits the current project (e.g. for grading).
       */
      var submitProject = function () {
        // make sure we save the current content before submitting
        saveCurrentlyDisplayedContent();

        // update the message in the console
        setOutput('Submitting your solution. This might take a few seconds. Please wait...', false);

        // disable all other actions while we wait for the submission to complete
        setEnabledActions(0,0,0,0,0);

        // submit the project
        var promise = ProjectFactory.submitProject();
        promise.then(
          function(data) {
            $log.debug('Submission successful.');
            setOutput(data.msg, false);

            // enable compilation and submission (not running, because what the submission compiles might differ from the last compilation if the user changed something; that could be confusing for the user)
            setEnabledActions(1,0,1,1,1);
          },
          function(reason) {
            $log.debug('Submission failed.' + reason.data.msg);
            setOutput(reason.data.msg, false);

            // the submission failed; because we don't know why, we enable compilation and submission
            setEnabledActions(1,0,1,1,1);
          }
        )
      }


      /** Function to stop an action (e.g. run); Requires that ideState.stopUrl is set */
      var stopAction = function stopAction() {
        if (ideState.stopUrl) {

          $http.get(ideState.stopUrl)
            .success(function(data, status, headers, config){
              addToOutput('\n\n--Program stopped--', true)
            })
            .error(function(data, status, headers, config) {
              $log.debug('An error occurred while trying to stop your program.');
              addToOutput('\n\nAn error occurred while trying to stop your program.', true);
            });
        }
      };


      // we need a way to hold some state of the IDE; this object contains the states that are required
      var ideState = {
        // if the user clicks an action (e.g. compile, run), this variable can be set to indicate that the action supports user-stopping
        actionAllowsForStopping: false,
        // the Url that must be called to stop an action
        stopUrl: ''
      };


      $scope.projectName = ProjectFactory.getProject().name;

      $scope.ace = {
        currentNodeId: -1,
        editor: null,
        isVisible: false // by default, the editor is hidden
      };


      /**
       * Function that's called when the ace editor is loaded the first time.
       * This comes as part of the ace-angular wrapper.
       * @param aEditor the ace editor instance
       */
      $scope.aceLoaded = function (aEditor) {
        // we store access to the ace instance
        $scope.ace.editor = aEditor;
      };


      /** Settings for different UI elements, e.g. should buttons be visible */
      $scope.uiSettings = {

        // do we show the submit button?
        showSubmissionBtn: projectData.isSubmissionAllowed,

        // by default we also render the output as Html; this setting does not get persisted
        showOutputAsText: false
      };

      // state variables to indicate which actions in the IDE are disabled
      $scope.disabledActions = {
        compile: false,
        run: true,
        stop: true,
        test: true,
        tool: false,
        submit: true
      };

      // state variables to indicate which actions in the IDE are hidden
      $scope.hiddenActions = {
        compileDynamic: false,
        run: false,
        stop: true
      };


      /**
       * Default settings of the editor
       */
      $scope.aceEditorSettings = {
        theme: 'eclipse',
        fontSize: '12px',
        handler: 'ace',
        tabSize: 4,
        invisibles: 'Hide',
        gutter: 'Show'
      };

      var aceKeyboardHandler; // default ace keyword handler


      /**
       * Object that provides functions used to help the user signin.
       * @type {{userIsAuthenticated: Function, signinPathWithRedirect: Function}}
       */
      $scope.signinSettings = {
        /**
         * Function that checks if the user is currently authenticated.
         * @return {*|Boolean} true if user is authenticated, otherwise false
         */
        userIsAuthenticated: function() {
          return UserSrv.isAuthenticated();
        },

        /**
         * Function that returns the URL string that that should be used to
         * load the Signin page and afterwards redirect back to the current project.
         * @return {string} the url for the signin with a 'redirect' query parameter
         */
        signinPathWithRedirect: function() {
          return '/signin?redirect=' + encodeURIComponent($location.url());
        }
      }


      /**
       * Enable or disable UI elements for actions.
       * @param compile {number} if 1, compile action will be set enabled
       * @param run {number} if 1, run action will be set enabled
       * @param test {number} if 1, test action will be set enabled
       * @param tool {number} if 1, tool action will be set enabled
       * @param submit {number} if 1, submit action will be set enabled
       */
      var setEnabledActions = function(compile, run, test, tool, submit) {
        $scope.disabledActions.compile = !(compile == 1);
        $scope.disabledActions.run = !(run == 1);
        $scope.disabledActions.test = !(test == 1);
        $scope.disabledActions.tool = !(tool == 1);
        $scope.disabledActions.submit = !(submit == 1);

        // trigger a digest because when the WebSocket closes, the buttons sometimes don't get enabled
        if(!$scope.$$phase) {
          $scope.$digest();
        }
      };


      /** Returns true if the user looking at the project in the ide is an owner of the project*/
      // TODO: deprecated as we replaced it with currentRoleIsOwner
      $scope.currentUserIsOwner = function() {
        return ProjectFactory.getProject().userRole === 'owner';
      }

      /** Returns true if the current role is that of project 'owner' */
      $scope.currentRoleIsOwner = function() {
        return ProjectFactory.getProject().userRole === 'owner';
      }

      /** Returns true if the current role is that of project 'user' */
      $scope.currentRoleIsUser = function() {
        return ProjectFactory.getProject().userRole === 'user';
      }

      /** Returns true if the current role is that of project 'submission' */
      $scope.currentRoleIsSubmission = function() {
        return ProjectFactory.getProject().userRole === 'submission';
      }

      /** Returns true if the current role is that of project 'userproject' */
      $scope.currentRoleIsUserProject = function() {
        return ProjectFactory.getProject().userRole === 'userproject';
      }


      /**
       * Function that broadcasts messages when an element in the NavBar is clicked by the user.
       * @param {string} aClickId the clickId that tells the code which element the user clicked
       */
      $scope.navBarClick = function (aClickId) {
        $scope.accion = aClickId;
        $scope.mensajeEnviado = false;
        $log.debug('NavBarClick with id: ' + aClickId);

        switch (aClickId) {
          case ('add_file'):
            var req = IdeMsgService.msgNewNodeRequest('file');
            $rootScope.$broadcast(req.msg, req.data);
            break;
          case ('add_folder'):
            var req = IdeMsgService.msgNewNodeRequest('folder');
            $rootScope.$broadcast(req.msg, req.data);
            break;
          case ('rename_node'):
            var req = IdeMsgService.msgRenameNodeRequest();
            $rootScope.$broadcast(req.msg);
            break;
          case ('remove_node'):
            var req = IdeMsgService.msgRemoveNodeRequest();
            $rootScope.$broadcast(req.msg);
            break;
          case ('save_project'):
            var req = IdeMsgService.msgSaveProjectRequest();
            $rootScope.$broadcast(req.msg);
            break;
          case ('hide_file'):
            var req = IdeMsgService.msgHideNodeRequest();
            $rootScope.$broadcast(req.msg);
            break;
          case ('show_share_project'):
            var req = IdeMsgService.msgShowShareProjectModalRequest();
            $rootScope.$broadcast(req.msg);
            break;
          case ('show_editor_settings'):
            var req = IdeMsgService.msgShowEditorSettingsRequest($scope.aceEditorSettings);
            $rootScope.$broadcast(req.msg, req.data);
            break;
          case ('show_output_as_text'):
            var req = IdeMsgService.msgShowOutputAsText();
            $rootScope.$broadcast(req.msg);
            break;
          case ('compile'):
            if(!($scope.disabledActions.compile)) {
              var req = IdeMsgService.msgCompileRequest();
              $rootScope.$broadcast(req.msg);
              $scope.startT = new Date();
            }
            break;
          case ('compileDynamic'):
            if(!($scope.disabledActions.compile)) {
              var req = IdeMsgService.msgCompileRequest();
              $rootScope.$broadcast(req.msg);
              $scope.startT = new Date();

              ideState.actionAllowsForStopping = true;
            }
            break;
          case ('compile_clean'):
            if(!($scope.disabledActions.compile)) {
              var req = IdeMsgService.msgCompileCleanRequest();
              $scope.startT = new Date();

              $rootScope.$broadcast(req.msg);
            }
            break;
          case ('run'):
            if(!($scope.disabledActions.run)) {
              $scope.startT = new Date();

              var req = IdeMsgService.msgRunRequest();
              $rootScope.$broadcast(req.msg);

              ideState.actionAllowsForStopping = true;
            }
            break;
          case ('stop'):
            var req = IdeMsgService.msgStopRequest();
            $rootScope.$broadcast(req.msg);
            break;
          case ('test'):
            if(!($scope.disabledActions.test)) {
              var req = IdeMsgService.msgTestRequest();
              $rootScope.$broadcast(req.msg);
            }
            break;
          case ('tool'):
            if(!($scope.disabledActions.tool)) {
              var req = IdeMsgService.msgToolRequest();
              $rootScope.$broadcast(req.msg);
            }
            break;
          case ('submit'):
            if(!($scope.disabledActions.submit)) {
              var req = IdeMsgService.msgSubmitRequest();
              $rootScope.$broadcast(req.msg);
            }
            break;
        }
      };


      /**
       * Function to update the session displayed by the ace editor
       * when there's a request to display a different file from the one current displayed
       */
      $scope.$on(IdeMsgService.msgDisplayFileRequest().msg, function (aEvent, aMsgData) {

        if ($scope.ace.currentNodeId !== -1) {
          // if the value is !== -1, then some tab is already open
          // thus, we need to store the session related the current tab before loading the session for the requested tab
          ProjectFactory.getNode($scope.ace.currentNodeId).session = $scope.ace.editor.getSession();

          // update the content
          ProjectFactory.getNode($scope.ace.currentNodeId).content = $scope.ace.editor.getSession().getValue();
        }


        // restore the session (if one had been persisted before)
        if (ProjectFactory.getNode(aMsgData.nodeId).session !== undefined && ProjectFactory.getNode(aMsgData.nodeId).session !== null) {
          $scope.ace.editor.setSession(ProjectFactory.getNode(aMsgData.nodeId).session);
        }
        else {
          // get the file
          var lNode = ProjectFactory.getNode(aMsgData.nodeId);

          // get the content of the node
          var lFileContent = lNode.content;

          // the mode that should be used in this session
          var lAceMode = 'ace/mode/text';

          // get the file type
          var lFileType = lNode.filename.split('.').pop();

          switch (lFileType) {
            case 'e':
              lAceMode = 'ace/mode/eiffel';
              break;
            case 'ecf':
              lAceMode = 'ace/mode/xml';
              break;
            case ('java'):
              lAceMode = 'ace/mode/java';
              break;
            case ('html'):
              lAceMode = 'ace/mode/html';
              break;
            case ('htm'):
              lAceMode = 'ace/mode/html';
              break;
            case ('py'):
              lAceMode = 'ace/mode/python';
              break;
            case ('c'):
              lAceMode = 'ace/mode/c_cpp';
              break;
            case ('h'):
              lAceMode = 'ace/mode/c_cpp';
              break;
            case ('cpp'):
              lAceMode = 'ace/mode/c_cpp';
              break;
            case ('hs'):
              lAceMode = 'ace/mode/haskell';
              break;
            case ('json'):
              lAceMode = 'ace/mode/json';
              break;
            default:
              lAceMode = 'ace/mode/text';
          }

          // create a new session, set the context and the mode
          $scope.ace.editor.setSession(ace.createEditSession(lFileContent, lAceMode));

          // set the aceKeyboardHandler to the default 'ace'
          aceKeyboardHandler= $scope.ace.editor.getKeyboardHandler()

          // setting the tabsize for haskell to be 8 (requested by Andreas)
          if(lAceMode === 'ace/mode/haskell') {
            $scope.ace.editor.getSession().setTabSize(8);
          } else {
            $scope.ace.editor.getSession().setTabSize(4);
          }

          // enable ACE autocompletion and snippets
          var snippetManager = ace.require("ace/snippets").snippetManager;
          var config = ace.require("ace/config");

          ace.config.loadModule('ace/ext/language_tools', function () {
            $scope.ace.editor.setOptions({
              enableBasicAutocompletion: true,
              enableSnippets: true,
              enableLiveAutocompletion: false
            })
          });

          if (lAceMode=='ace/mode/eiffel') {
            // update Eiffel snippets
            ace.config.loadModule("ace/snippets/eiffel", function(m) {
              if (m) {
                snippetManager.files.eiffel = m;

                m.snippetText = 'snippet feature modifier\n	feature {${1:CLASS}} -- ${2:comment}  \n';
                m.snippets = snippetManager.parseSnippetFile(m.snippetText);

                // add the Eiffel snippets (snippet objects defined in IdeSnippetsSrv)
                for (var i=0; i<IdeSnippetsSrv.getEiffelSnippet().length;i++) {
                  m.snippets.push(IdeSnippetsSrv.getEiffelSnippet()[i]);
                }
                snippetManager.register(m.snippets, m.scope);
              }
            });
          }

          // Note: this relates to static files only (only they have a isContentSet property and a url for now)
          if(lNode.url && !lNode.isContentSet) {
            $http
              .get(lNode.url)
              .success(function(result) {

                $log.debug('Got HTTP response for content of the file');

                // we store the content so the next time we don't need to load it from the server
                ProjectFactory.getNode(aMsgData.nodeId).content = result;
                ProjectFactory.getNode(aMsgData.nodeId).isContentSet = true;

                $scope.ace.editor.getSession().setValue(result);

              })
              .error(function(err) {
                $log.debug(err);
              });

          }
        }


        // if the currently displayed nodeId indicates that we're displaying a static file, we need to make the editor read-only
        if(typeof(aMsgData.nodeId) === 'string' && aMsgData.nodeId.charAt(0) === 's') {
          $scope.ace.editor.setReadOnly(true);
        }
        else {
          // otherwise the user is allowed to edit the file
          $scope.ace.editor.setReadOnly(false);
        }


        // update the information about which node is currently displayed in the editor
        $scope.ace.currentNodeId = aMsgData.nodeId;


        // set the focus on the editor so user can start typing right away
        $scope.ace.editor.focus();
      });


      /**
       * When users resize the IDE layout using the Kendo-Splitter,
       * we send a message because the Ace edtior needs to update it's layout.
       */
      $scope.splitterResizeEvent = function() {
        var req = IdeMsgService.msgEditorResizeRequest();
        $rootScope.$broadcast(req.msg);
      };


      /**
       * Triggers a resize of the editor.
       * This can be necessary e.g. when the user changed the layout using the draggable splitters.
       */
      $scope.$on(IdeMsgService.msgEditorResizeRequest().msg, function () {
        $scope.ace.editor.resize();
      });


      $scope.$on(IdeMsgService.msgSaveProjectRequest().msg, function () {
        $log.debug('Save request received');

        //  we need to store the current content first
        saveCurrentlyDisplayedContent();

        // send the entire project to the server
        ProjectFactory
          .saveProjectToServer()
          .then(
            function(result) {
              setOutput('<span style="color: green;">Changes successfully saved.</span>', true);

              // the success message should disappear after some time
              $timeout(
                function(){setOutput('This will display the output.', false)},
                2500
              );
            },
            function(reason) {
              setOutput('<span style="color: red">' +
                'WARNING: Unable to save your changes.<br><br>' +
                "What now: maybe you're currently not logged in.<br>" +
                'Open a new browser tab for codeboard.io, login, and then come back to this tab and try to save your changes.<br>' +
                'If the problem persists, contact us at: info@codeboard.io' +
                '</span>', true);
            }
          );

        // set the focus on the editor so user can start typing right away
        $scope.ace.editor.focus();
      });


      /** Handles the event that editor settings show be shown. */
      $scope.$on(IdeMsgService.msgShowEditorSettingsRequest().msg, function (aEvent, aMsgData) {



        /** The controller for the modal */
        var editorSettingsModalInstanceCtrl =  ['$rootScope','$scope', '$uibModalInstance', function ($rootScope, $scope, $uibModalInstance) {

          var lastEditorSettings = angular.copy(aMsgData.settings) ;

          $scope.editorSettings = angular.copy(aMsgData.settings);

          $scope.ok = function () {
            var req = IdeMsgService.msgEditorSettingsChanged($scope.editorSettings);
            $rootScope.$broadcast(req.msg, req.data);
            $uibModalInstance.close();
          };

          $scope.preview = function () {
            var req = IdeMsgService.msgEditorSettingsChanged($scope.editorSettings);
            $rootScope.$broadcast(req.msg, req.data);
          };

          $scope.cancel = function () {
            //$scope.aceEditorSettings = lastEditorSettings;
            var req = IdeMsgService.msgEditorSettingsChanged(lastEditorSettings);
            $rootScope.$broadcast(req.msg, req.data);
            $uibModalInstance.dismiss();
          };
        }];



        /** Function to open the modal where the user must confirm the loading of the project */
        var openModal = function(closeAction, dismissAction) {

          var modalInstance = $uibModal.open({
            templateUrl: 'ideEditorSettingsModal.html',
            controller: editorSettingsModalInstanceCtrl
          });


          modalInstance.result.then(
            function () {
              // the user clicked ok
              $log.debug('User confirmed changes to editor settings.');
              // run the closeAction function if it's defined
              if (closeAction) {
                closeAction();
              }
            },
            function () {
              // the user canceled
              $log.debug('User canceled changes to editor settings.');
              // run the dissmissAction if it's defined
              if (dismissAction) {
                dismissAction();
              }
            });
        };

        // call the function to open the modal (we don't give it any function for dismiss)
        openModal(function() {}, function() {});
      });


      /** Handles the event that changed the editor options. aMsgData has the selected settings for the editor */
      $scope.$on(IdeMsgService.msgEditorSettingsChanged().msg, function (aEvent, aMsgData) {

        $scope.aceEditorSettings = aMsgData.settings;
        if ($scope.aceEditorSettings.handler!="ace") {
          $scope.ace.editor.setKeyboardHandler('ace/keyboard/' + $scope.aceEditorSettings.handler);
        }
        else {
          $scope.ace.editor.setKeyboardHandler(aceKeyboardHandler);
        }

        //console.log('You changed the editor');
        $scope.ace.editor.setTheme('ace/theme/' + $scope.aceEditorSettings.theme);

        $scope.ace.editor.setFontSize($scope.aceEditorSettings.fontSize);
        $scope.ace.editor.getSession().setTabSize($scope.aceEditorSettings.tabSize);
        if ($scope.aceEditorSettings.invisibles==='Show') {
          $scope.ace.editor.setShowInvisibles(true);
        }
        else {
          $scope.ace.editor.setShowInvisibles(false);
        }
        if ($scope.aceEditorSettings.gutter==='Show') {
          $scope.ace.editor.renderer.setShowGutter(true);
        }
        else {
          $scope.ace.editor.renderer.setShowGutter(false)
        }
      });


      /** Handles the event that output should be rendered as HTML or not. */
      $scope.$on(IdeMsgService.msgShowOutputAsText().msg, function() {
        $scope.uiSettings.showOutputAsText = !($scope.uiSettings.showOutputAsText);
      });


      /** Handles a "compileReqeusted" event */
      $scope.$on(IdeMsgService.msgCompileRequest().msg, function () {
        $log.debug('Compile request received');
        compileProject(false);
        // set the focus on the editor so user can start typing right away
        $scope.ace.editor.focus();
      });


      /** Handles a "cleanCompileRequest" event */
      $scope.$on(IdeMsgService.msgCompileCleanRequest().msg, function () {
        $log.debug('Clean-compile request received');
        compileProject(true);
        // set the focus on the editor so user can start typing right away
        $scope.ace.editor.focus();
      });


      /** Handles a "runRequest" event */
      $scope.$on(IdeMsgService.msgRunRequest().msg, function () {
        $log.debug('Run request received');
        runProject();
      });


      $scope.$on(IdeMsgService.msgStopRequest().msg, function () {
        $log.debug('Stop request received');

        stopAction();
      });


      /** Handles a "testRequested" event */
      $scope.$on(IdeMsgService.msgTestRequest().msg, function () {
        $log.debug('Test request received');
        testProject();
        // set the focus on the editor so user can start typing right away
        $scope.ace.editor.focus();
      });


      /** Handles a "toolRequested" event */
      $scope.$on(IdeMsgService.msgToolRequest().msg, function () {
        $log.debug('Tool request received');
        toolAction();
        // set the focus on the editor so user can start typing right away
        $scope.ace.editor.focus();
      });


      /** Handles a "submitRequest" event */
      $scope.$on(IdeMsgService.msgSubmitRequest().msg, function () {
        $log.debug('Submit request received');


        if(UserSrv.isAuthenticated() || ProjectFactory.getProject().hasLtiData) {
          // the user is authenticated or the project is using LTI, thus a submission is
          // likely to be forwarded to an LTI tool consumer
          // so we simply submit
          submitProject();
        }
        else {

          // open a modal to ask if the user really wants to make an anonymous submission

          /** The controller for the modal */
          var anonymousSubissionModalInstanceCtrl =  ['$scope', '$uibModalInstance', function ($scope, $uibModalInstance) {

            $scope.ok = function () {
              $uibModalInstance.close();
            };

            $scope.cancel = function () {
              $uibModalInstance.dismiss();
            };
          }];

          /** Function to open the modal where the user must confirm the loading of the project */
          var openModal = function(closeAction, dismissAction) {

            var modalInstance = $uibModal.open({
              templateUrl: 'ideConfirmAnonymousSubmissionModal.html',
              controller: anonymousSubissionModalInstanceCtrl
            });

            modalInstance.result.then(
              function () {
                // the user clicked ok
                $log.debug('User confirmed submit anonymously.');
                // run the closeAction function if it's defined
                if (closeAction) {
                  closeAction();
                }
              },
              function () {
                // the user canceled
                $log.debug('User canceled anonymous submission.');
                // run the dissmissAction if it's defined
                if (dismissAction) {
                  dismissAction();
                }
              });
          };

          // call the function to open the modal (we don't give it any function for dismiss)
          openModal(submitProject);
        }

        // set the focus on the editor so user can start typing right away
        $scope.ace.editor.focus();
      });


      /** Handles request to show or hide the editor */
      $scope.$on(IdeMsgService.msgDisplayEditorRequest().msg, function (aEvent, aMsgData) {
        if (aMsgData.displayEditor) {
          $scope.ace.isVisible = true;
        }
        else {
          $scope.ace.isVisible = false;
        }
      });


      /**
       * Listens for confirmation that a node was removed.
       * If a node was removed that's currently shown in the editor we must no longer try to
       * persist it's ace session (in fact, that would throw an exception). This function
       * handles this case.
       */
      $scope.$on(IdeMsgService.msgRemoveNodeConfirmation().msg, function (aEvent, aMsgData) {
        if($scope.ace.currentNodeId === aMsgData.uniqueId) {

          // the ace was currently showing the node that was deleted
          // thus, we'll not try to save the ace session when switching to another file.
          $scope.ace.currentNodeId = -1;
        }
      });


      $scope.$on(IdeMsgService.msgStoppableActionAvailable().msg, function() {

        $log.debug('Event received: Stoppable action available');

        $scope.hiddenActions.compileDynamic = true;
        $scope.hiddenActions.run = true;
        $scope.hiddenActions.stop = false;
      });


      $scope.$on(IdeMsgService.msgStoppableActionGone().msg, function() {

        $log.debug('Event received: Stoppable action gone');

        // reset the state of hidden buttons to default
        $scope.hiddenActions.compileDynamic = false;
        $scope.hiddenActions.run = false;
        $scope.hiddenActions.stop = true;

        // reset that a stoppable action is available
        ideState.actionAllowsForStopping = false;
      });


      /**
       * Handles an request event for processing the URI query string "?view=...".
       */
      $scope.$on(IdeMsgService.msgProcessViewQueryStringRequest().msg, function () {
        // we want to call the processViewQueryString function but only once we're sure Angular is done rendering the HTML page
        // because only at that time is the ACE editor ready to open any files
        // To achieve this, we use a $timeout as describe here: http://tech.endeepak.com/blog/2014/05/03/waiting-for-angularjs-digest-cycle/
        $timeout(function(){
          processViewQueryString();
        });
      });


      /**
       * Returns false if a language doesn't need compilation
       * but can be run directly.
       * @return {boolean}
       */
      $scope.isCompilationNeeded = function() {

        var _dynamicLanguages = ['Python', 'Python-UnitTest'];
        var _compilationIsNeeded = true;

        if(_dynamicLanguages.indexOf(ProjectFactory.getProject().language) !== -1) {
          _compilationIsNeeded = false;
        }

        // $log.debug('Project uses langguage that needs compilation: ' + result);
        return _compilationIsNeeded;
      };


      /**
       * Returns true if a language supports testing with some testing framework.
       * @return {boolean}
       */
      $scope.isTestSupported = function() {

        var _testingProjects = ['Haskell-HSpec', 'Java-JUnit', 'Python-UnitTest'];
        var _testIsSupported = false;

        if(_testingProjects.indexOf(ProjectFactory.getProject().language) !== -1) {
          _testIsSupported = true;
        }

        // $log.debug('Project uses testing framework: ' + result);
        return _testIsSupported;
      };


      /**
       * Returns true if a language supports testing with some testing framework.
       * @return {boolean}
       */
      $scope.isToolSupported = function() {

        var _toolProjects = ['Infer-Java'];
        var _toolIsSupported = false;

        if(_toolProjects.indexOf(ProjectFactory.getProject().language) !== -1) {
          _toolIsSupported = true;
        }

        // $log.debug('Project uses testing framework: ' + result);
        return _toolIsSupported;
      };


      /**
       * Returns true if the language of the current project is Eiffel.
       * @return {boolean}
       */
      $scope.isEiffelLanguageCompatible = function() {
        //console.log("Language "+ProjectFactory.getProject().language);
        return ProjectFactory.getProject().language ==='Eiffel';
      };


      /**
       * Function to send the input of a user to her program.
       * @param {string} aUserInput the input to send to the program
       * @param {string} aElementIdToSetFocus a DOM element id; the element wit that id will get focus after the sending
       */
      $scope.sendUserInputClick = function(aUserInput, aElementIdToSetFocus) {
        // append a newline to the userInput. Otherwise, the users program won't continue execution but
        // wait for the user to hit the enter key

        if (!(aUserInput)) {
          // aUserInput might be undefined if the ng-model never gets instanciated because the user doesn't enter
          // any value
          WebsocketSrv.sendData('\n');
        }
        else {
          WebsocketSrv.sendData(aUserInput + '\n');
        }

        // Note: doing the DOM manipulation in the controller is not "the Angular way"
        // However, we would need 2 more directives otherwise (one for enter-click, one for send-button click)
        // About element selection see: http://mlen.io/angular-js/get-element-by-id.html
        var domElem = angular.element(document.querySelector('#' + aElementIdToSetFocus));
        if(domElem) {
          domElem.focus();
        }
      };


      /** Below list all one-time invocations for functions which should run whenever the controller is loaded from scratch.*/

      // invoke function to check if the user has a saved version of this project
      loadUserProject();
    }]);


app.controller('TreeCtrl', ['$scope', '$rootScope', '$log', 'ProjectFactory', 'IdeMsgService',
  function ($scope, $rootScope, $log, ProjectFactory, IdeMsgService) {

  $scope.projectNodes = ProjectFactory.getProject().files;


  /**
   * Adds a new file to the project model (which feeds the tree view)
   */
  $scope.addFile = function () {
    var req = IdeMsgService.msgNewNodeRequest('file');
    $rootScope.$broadcast(req.msg, req.data);
  };


  /**
   * Adds a new folder to the project model (which feeds the tree view)
   */
  $scope.addFolder = function () {
    var req = IdeMsgService.msgNewNodeRequest('folder');
    $rootScope.$broadcast(req.msg, req.data);
  };


  /**
   * Broadcasts a msg that a node was selected (only if selected node is not a folder).
   */
  $scope.nodeClick = function () {
    var lSelectedNode = ProjectFactory.getNode($scope.mytree.currentNode.uniqueId);

    // ignore the click if the selected node is a folder
    if (lSelectedNode != null && !lSelectedNode.isFolder) {
      var req = IdeMsgService.msgDisplayFileRequest(lSelectedNode.uniqueId);
      $rootScope.$broadcast(req.msg, req.data);
    }
  };


  /**
   * Listen for an event to rename a node. The currently selected node will be renamed.
   */
  $scope.$on(IdeMsgService.msgRenameNodeRequest().msg, function(aEvent) {

    // if the node to rename is the root node, we prevent it
    if($scope.mytree.currentNode.uniqueId === 0) {
      alert("The root folder can't be renamed.");
    }
    else {
      // get the file name and file type
      var lNodeId = $scope.mytree.currentNode.uniqueId;
      var lNodeName = ProjectFactory.getNode(lNodeId).filename;
      var lNodeType = ProjectFactory.getNode(lNodeId).isFolder ? 'folder' : 'file';

      var req = IdeMsgService.msgDisplayRenameNodeModalRequest(lNodeId, lNodeName, lNodeType);
      $rootScope.$broadcast(req.msg, req.data);
    }

  });


  /**
   * Listens for the event when the user has provided a new name for the node that should be renamed.
   */
  $scope.$on(IdeMsgService.msgRenameNodeNameAvailable().msg, function (aEvent, aMsgData) {


    ProjectFactory.renameNode(aMsgData.nodeId, aMsgData.nodeName);

    //$scope.projectNodes = ProjectFactory.getProject().files;

    // need to broadcast a ReloadTreeFromProjectFactory msg
    $rootScope.$broadcast(IdeMsgService.msgReloadTreeFromProjectFactory().msg);

  });


  /**
   * Listens for an event to remove a node. The currently selected node will be removed.
   */
  $scope.$on(IdeMsgService.msgRemoveNodeRequest().msg, function(aEvent) {

    // if the node to delete is the root node, we prevent it
    if($scope.mytree.currentNode.uniqueId === 0) {
      alert("The root folder can't be deleted.");
    }
    else {

      // get the file name
      var filename = ProjectFactory.getNode($scope.mytree.currentNode.uniqueId).filename;
      var type = ProjectFactory.getNode($scope.mytree.currentNode.uniqueId).isFolder ? 'folder' : 'file';

      var confirmMsg = "Do you really want to delete " + type + " '" + filename + "'?";
      var confirmMsg = ProjectFactory.getNode($scope.mytree.currentNode.uniqueId).isFolder ? confirmMsg + "\n\nNote: when deleting a folder, make sure it's empty." : confirmMsg;

      // ask the user to confirm deletion.
      var _userConfirmed = confirm(confirmMsg);
      if(_userConfirmed) {
        var lSelectedNodeUId = $scope.mytree.currentNode.uniqueId;
        ProjectFactory.removeNode(lSelectedNodeUId, false);

        // Note: we need to select a new node; that's gonna be the root node
        // set the root node to be selected
        ProjectFactory.getNode(0).selected = 'selected';
        // set the root node as the current node
        $scope.mytree.currentNode = ProjectFactory.getNode(0);

        // broadcast a message about which node was removed; e.g. tabs belonging to this node need to be closed
        var req = IdeMsgService.msgRemoveNodeConfirmation(lSelectedNodeUId);
        $rootScope.$broadcast(req.msg, req.data);
      }
    }
  });


  /**
   * Listens for the event when the user has provided a name for the new node that should be added.
   */
  $scope.$on(IdeMsgService.msgNewNodeNameAvailable().msg, function (aEvent, aMsgData) {

    var lSelectedNodeUId = $scope.mytree.currentNode.uniqueId;

    switch (aMsgData.nodeType) {
      case('file'):
        ProjectFactory.addFile(lSelectedNodeUId, aMsgData.nodeName);
        break;
      case('folder'):
        ProjectFactory.addFolder(lSelectedNodeUId, aMsgData.nodeName);
        break;
    }
  });


  /**
   * Listens for the event that the tree should update.
   * Such an update is needed if the ProjectFactory changes the 'files' array (e.g.
   * when loading a user's version of a project) after the 'files' array was already
   * assigned to $scope.projectNodes
   */
  $scope.$on(IdeMsgService.msgReloadTreeFromProjectFactory().msg, function(aEvent) {

    // update the scope to reference the new version of the project
    $scope.projectNodes = ProjectFactory.getProject().files;
  });


  /**
   * Listens for the event that node should be hidden.
   * If received the currently selected node will be hidden or unhidden, depending on its current status.
   */
  $scope.$on(IdeMsgService.msgHideNodeRequest().msg, function () {
    $log.debug('Hide_node request received');


    var lSelectedNodeUId = $scope.mytree.currentNode.uniqueId;

    if(lSelectedNodeUId > 0) {
      $log.debug('Node is hidden: ' + ProjectFactory.getNode(lSelectedNodeUId).isHidden);
      ProjectFactory.setNodeHidden(ProjectFactory.getNode(lSelectedNodeUId));
      $log.debug('Node is hidden: ' + ProjectFactory.getNode(lSelectedNodeUId).isHidden);
    }
    else {
      alert("The root folder can't be hidden.");
    }


  });


  // TODO: it should be save to remove this because we now always have a node selected
  /**
   * Listens for an event that a new node should be added;
   * If currently no node is selected, this will select the root node.
   */
  //$scope.$on(IdeMsgService.msgNewNodeRequest().msg, function (aEvent, aMsgData) {
  //
  //  // check if there's no node selected currently
  //  if($scope.mytree.currentNode === undefined) {
  //
  //    // set the root node to be selected
  //    ProjectFactory.getNode(0).selected = 'selected';
  //    // set the root node as the current node
  //    $scope.mytree.currentNode = ProjectFactory.getNode(0);
  //  }
  //});
}]);


app.controller('TabCtrl', ['$scope', '$rootScope', '$log', '$uibModal', 'ProjectFactory', 'IdeMsgService',
  function ($scope, $rootScope, $log, $uibModal, ProjectFactory, IdeMsgService) {

  $scope.tabs = [];

  /**
   * Function to set a particular tab as active and set all other tabs inactive.
   * @param aArrayIndex the index of the tab to set active
   */
  var makeTabActive = function (aArrayIndex) {

    for (var i = 0; i < $scope.tabs.length; i++) {
      $scope.tabs[i].isActive = i === aArrayIndex;
    }
  };


  /**
   * Function to check if a tab already exists for a specific node.
   * @param {number} aNodeId the uniqueId of the node
   * @return {number} returns -1 if no tab exists yet, otherwise the array index of the tab
   */
  var doesTabAlreadyExist = function (aNodeId) {
    for (var i = 0; i < $scope.tabs.length; i++) {
      if ($scope.tabs[i].nodeIndex === aNodeId) {
        return i;
      }
    }
    return -1;
  };


  /**
   * Function that is called when a tab is clicked on by the user.
   * @param {number} aArrayIndex the array index (it's a property of a tab) of the tab that was clicked on
   */
  $scope.selectClick = function (aArrayIndex) {

    var req = IdeMsgService.msgDisplayFileRequest($scope.tabs[aArrayIndex].nodeIndex);
    $rootScope.$broadcast(req.msg, req.data);
  };

  /**
   * Removes a tab from the array
   * @param aArrayIndex the array index at which position the tab is stored
   */
  $scope.closeClick = function (aArrayIndex) {
    $log.debug('Close-tab clicked; array-index:' + aArrayIndex);

    // all tabs are to the right of the tab to-be-deleted need to update their arrayIndex position
    for (var i = aArrayIndex + 1; i < $scope.tabs.length; i++) {
      $scope.tabs[i].arrayIndex = $scope.tabs[i].arrayIndex - 1;
    }

    // if the tab to be closed was active, pick a neighboring tab be active
    if ($scope.tabs[aArrayIndex].isActive) {

      // need to handle different cases:
      if ($scope.tabs.length === 1) {
        // the tab to-be-removed is the only tab; after closing there are not tabs open
        // signal that the editor should be hidden
        var req = IdeMsgService.msgDisplayEditorRequest(false);
        $rootScope.$broadcast(req.msg, req.data);
      }
      else if (aArrayIndex === 0) {
        // other tabs exist and the tab to-be-removed is the left-most; so we activate this neighbor to the right
        var req = IdeMsgService.msgDisplayFileRequest($scope.tabs[aArrayIndex + 1].nodeIndex)
        $rootScope.$broadcast(req.msg, req.data);
      }
      else {
        // other tabs exist and the tab to-be-removed has neighboring tabs to the left; we select the left neighbor
        var req = IdeMsgService.msgDisplayFileRequest($scope.tabs[aArrayIndex - 1].nodeIndex);
        $rootScope.$broadcast(req.msg, req.data);
      }
    }

    // remove the tab
    $scope.tabs.splice(aArrayIndex, 1);
  };


  $scope.$on(IdeMsgService.msgDisplayFileRequest().msg, function (aEvent, aMsgData) {

    // if no tab is displayed yet, send a message that the editor shall be displayed
    if ($scope.tabs.length === 0) {
      var req = IdeMsgService.msgDisplayEditorRequest(true);
      $rootScope.$broadcast(req.msg, req.data);
    }

    // check if the requested file already has an opened tab
    var k = doesTabAlreadyExist(aMsgData.nodeId);

    if (k === -1) {
      // there's no tab for the request file yet, so we create one

      // get the node for which a tab should be added
      var lRequestedNode = ProjectFactory.getNode(aMsgData.nodeId);

      // push a new tab to the list of tabs
      $scope.tabs.push(
        {
          name: lRequestedNode.filename,
          title: lRequestedNode.path + '/' + lRequestedNode.filename,
          nodeIndex: aMsgData.nodeId,
          arrayIndex: $scope.tabs.length,
          isActive: false
        });

      //make the new tab active (this call will also make the previous active tab inactive)
      makeTabActive($scope.tabs.length - 1);
    }
    else {
      // there's already a tab opened for the request file
      // so we simply activate that tab
      makeTabActive(k);
    }
  });


  /**
   * Listens for the event when the user has provided a new name for the node that should be renamed.
   * This event handler then changes the name of the open tab (if one exists).
   */
  $scope.$on(IdeMsgService.msgRenameNodeNameAvailable().msg, function (aEvent, aMsgData) {

    // if a tab for the node-to-be-renamed is open, get its id
    var tabId = doesTabAlreadyExist(aMsgData.nodeId);

    if(tabId !== -1) {
      $scope.tabs[tabId].name = aMsgData.nodeName;
    }
  });


  /**
   * Listen for a confirmation that a node was removed. If a tab for that node is open
   * we need to close it.
   * TODO: if remove is a folder, close all children
   */
  $scope.$on(IdeMsgService.msgRemoveNodeConfirmation().msg, function (aEvent, aMsgData) {

    // if a tab for the node-to-be-removed is open, get its id
    var tabId = doesTabAlreadyExist(aMsgData.uniqueId);

    if(tabId !== -1) {
      $scope.closeClick(tabId);
    }
  });


  /** Handles the event that the Modal for "Share Project" should show be shown. */
  $scope.$on(IdeMsgService.msgShowShareProjectModalRequest().msg, function (aEvent, aMsgData) {

    // need a reference to the tabs which is accessible inside the modal; $scope.tabs won't work because the modal has it's own scope.
    var tabs = $scope.tabs;

    /** The controller for the modal */
    var shareProjectModalInstanceCtrl =  ['$rootScope','$scope', '$location', '$uibModalInstance', function ($rootScope, $scope, $location, $uibModalInstance) {

      /** Function returns the full Url but with all query strings removed, i.e. after the '?' */
      var getAbsUrlWithoutQueryString = function getAbsUrlWithoutQueryString () {
        var result = $location.absUrl();
        var queryStartIndex = result.indexOf('?');

        if (queryStartIndex >= 0) {
          result = result.substr(0, queryStartIndex);
        }

        return result;
      }


      // data-binding for the from that shows the Share-Url and a checkbox
      // Note: we use getAbsUrlWithoutQueryString because the user might have open e.g. /projects/11?view=2.1
      // Now if were to simply use $location.absUrl, then we would append another ?view=x.x onto the existing one, giving us /project/11?view=2.1?view=x.x
      // To avoid this, we get the Url without the query string.
      $scope.form = {
        inputText: getAbsUrlWithoutQueryString(),
        inputCheckbox: false
      };

      /** Append or remove the "?view=..." query string */
      $scope.checkboxChanged = function () {

        // we always show the default, absolute Url
        $scope.form.inputText = getAbsUrlWithoutQueryString();

        // append the view query string if the checkbox is selected
        if ($scope.form.inputCheckbox) {

          // by default the view query string is empty
          var viewQueryString = ''

          // if tabs are open, we append to the veiw query string
          if (tabs.length > 0) {

            // the key of the query string
            viewQueryString += '?view='
            // calculates the values of the query string
            for (var i = 0; i < tabs.length; i++) {

              // get the nodeId and if the node is active or not
              viewQueryString += tabs[i].nodeIndex + '.' + (tabs[i].isActive ? '1' : '0');

              // add the separator "-", as in 2.1-3.0-4.0 (except after the last tab)
              viewQueryString += (i < tabs.length - 1) ? '-' : '';
            }
          }

          // append the calculated view query string
          $scope.form.inputText += viewQueryString;
        }
      };


      $scope.closeModal = function () {
        $uibModalInstance.close();
      };
    }];


    // call the function to open the modal (we ignore the modalInstance returned by this call as we don't need to access any data from the modal)
    $uibModal.open({
        templateUrl: 'ideShareProjectModal.html',
        controller: shareProjectModalInstanceCtrl
      });

  });

}]);


app.controller('LibraryCtrl', ['$scope', '$rootScope', '$http', 'ProjectFactory', 'IdeMsgService', function($scope, $rootScope, $http, ProjectFactory, IdeMsgService){

  // the currently selected file (the ng-model)
  $scope.file = {};

  // all the library files
  $scope.files = [];


  // fetch the list of files from the server
  var init = function() {

    $http
      .get('staticfiles/eiffelfiles.json')
      .success(function(result) {

        $scope.files = result;

      })
      .error(function(err) {
        console.log(err);
      })

  }();


  $scope.showFile = function() {
    var req = IdeMsgService.msgDisplayFileRequest($scope.file.selected.index);
    $rootScope.$broadcast(req.msg, req.data);

    $scope.file = {};

  }

  $scope.foo = function() {
    alert('Click');
  }


//  $scope.isEiffelLanguageCompatible = function() {
//    //console.log("Language "+ProjectFactory.getProject().language);
//    return ProjectFactory.getProject().language ==='Eiffel';
//  }

  /** Array that will have information about static files (i.e. the eiffelfiles.json file) */
  //var staticFiles = [];

  /** fetch the information about the static files */
  $scope.fetchStaticFiles = function() {
    $http
      .get('staticfiles/eiffelfiles.json')
      .success(function(result) {
        ProjectFactory.getProject().staticFiles = result;
      })
      .error(function(err) {

      })
  }();

}]);


app.controller('IdeFooterStatusBarCtrl', ['$scope', '$routeParams', 'UserSrv', 'ProjectFactory', function($scope, $routeParams, UserSrv, ProjectFactory){

  /* Returns the username of the current user or '#anonymous' if user is not logged in */
  $scope.getUsername = function() {

    var _msg = 'User: ';

    if (UserSrv.isAuthenticated()) {
      _msg += UserSrv.getUsername();
    }
    else {
      _msg += '#anonymous (<a href="' + $scope.signinSettings.signinPathWithRedirect() + '">sign in</a> to save your progress)';
    }

    return _msg;
  };


  /* Returns a string that details the current user's role */
  $scope.getRole = function() {
    if ($scope.currentRoleIsOwner()) {
      return 'Project owner';
    }
    else if ($scope.currentRoleIsUser()) {
      return 'Project user';
    }
    else if ($scope.currentRoleIsSubmission()) {
      var _submissionRole = 'Inspection of a submission';

      // we check we now the name of the user we're inspecting; if yes, we use the name as part of the role description
      if(ProjectFactory.getProject().userBeingInspected) {
        _submissionRole = 'Inspecting submission from user "' +  ProjectFactory.getProject().userBeingInspected + '"';
      }
      return _submissionRole;
    }
    else if ($scope.currentRoleIsUserProject()) {
      var _userProjectRole = "Inspection of a user's project";

      // we check if the url has parameter ?username=xxx; if yes, we use the name as part of the role description
      if(ProjectFactory.getProject().userBeingInspected) {
        _userProjectRole = 'Inspecting user-project from user "' +  ProjectFactory.getProject().userBeingInspected + '"';
      }
      return _userProjectRole;
    }
  }

  /** Returns 'true' is the project is using Lti for the submission */
  $scope.isUsingLti = function() {
    return ProjectFactory.getProject().hasLtiData;
  }

}]);
