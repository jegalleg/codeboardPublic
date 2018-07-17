'use strict';

/**
 * Created by haches on 18.07.2014.
 *
 * Controller for administrating an object.
 * We assume that this controller is only loaded
 * if the current user is an owner of the project.
 * Nevertheless, the server must validate the
 * users authorization again before storing any changes.
 *
 */

angular.module('codeboardApp')
  .controller('UserStatsCtrl', ['$scope', '$log', '$route', '$http', 'StatsSrv',
    function ($scope, $log, $route, $http, StatsSrv) {


      $scope.usuarioElegido = false;
      //JESUS Boolean flags to know which graph to show when buttons are clicked
      $scope.globalSelected = false;
      $scope.errorsSelected = false;
      $scope.globalPerProjectVisible = false;
      $scope.globalPerTimeVisible = false;
      $scope.errorsPerProjectVisible = false;
      $scope.errorsPerTimeVisible = false;

      // the model for "From" input box (default value: today - 1 month)
      $scope.fromDate = new Date();
      $scope.fromDate.setMonth($scope.fromDate.getMonth() - 1);

      // the model for the "Until" input box (default value: today)
      $scope.untilDate = new Date();

      // the latest date that a user can select in a date picker (default value: today)
      $scope.datePickerMaxSelectableDate = new Date();

      // date format for the date picker
      $scope.datePickerDateFormat = 'dd-MMMM-yyyy';

      // are the two date pickers open (false by default)
      $scope.datePickerFromOpen = false;
      $scope.datePickerUntilOpen = false;

      // get the projectId (to use as part of the link to the summary page)
      //$scope.projectId = $route.current.params.projectId;
      $scope.projectId = 1;
      $scope.username = $route.current.params.username;
      // is data for displaying the graphs being loaded from the server (default yes as we load on startup)
      $scope.isLoadingCompilationRunGraphData = false;
      $scope.isLoadingUserAccessGraphData = true;
      $scope.isLoadingCompilationRunGraphDataDetail = false;
      $scope.isLoadingCompilationRunGraphDataTime = false;//for errors by time


      // are the tables with detailed user data visible (default false)
      $scope.compilationRunTableVisible = false;
      $scope.projectAccessTableVisible = false;
      $scope.compilationRunTableVisibleDetail = false; // JESUS made for error graphs
      $scope.submissionTableVisible = false;

      // is data for the tables being loaded (default false)
      $scope.isLoadingCompilationRunDetails = false;
      $scope.isLoadingProjectAccessDetails = false;
      $scope.isLoadingSubmissionsDetails = false;


      $scope.compilationRunBtnLabel = "Show user details";
      $scope.compilationRunBtnLabelGraph = "Show compilation details";


      $scope.projectAccessBtnLabel = "Show user details";
      $scope.submissionBtnLabel = "Show user details";


      $scope.changeGlobal = function () {
        if ($scope.usuarioElegido == false) {
          alert("Please, select an user")
        } else {
          $scope.globalSelected = !$scope.globalSelected;
          $scope.errorsSelected = false;
          $scope.errorsPerProjectVisible = false;
          $scope.errorsPerTimeVisible = false;
          if ($scope.globalSelected == false) {
            $scope.globalPerProjectVisible = false;
            $scope.globalPerTimeVisible = false;

          }
        }
      }
      $scope.changeErrors = function () {
        if ($scope.usuarioElegido == false) {
          alert("Please, select an user")
        } else {

          $scope.errorsSelected = !$scope.errorsSelected;
          $scope.globalSelected = false;
          $scope.globalPerProjectVisible = false;
          $scope.globalPerTimeVisible = false;
          if ($scope.errorsSelected == false) {
            $scope.errorsPerProjectVisible = false;
            $scope.errorsPerTimeVisible = false;

          }
          if ($scope.usuario == '') {
            alert("Please, select an user")
          }
        }
      }


      $scope.globalPerProject = function () {
        $scope.globalPerProjectVisible = true;
        $scope.globalPerTimeVisible = false;
        getCompilationRunDataPerProjectForGraphByUser();
        getProjectAccessDataForGraphPerProject();
      }
      $scope.globalPerTime = function () {
        $scope.globalPerProjectVisible = false;
        $scope.globalPerTimeVisible = true;
        getCompilationRunDataForGraphByUser();
        getProjectAccessDataForGraphByUser();
      }
      $scope.errorsPerProject = function () {
        $scope.errorsPerProjectVisible = true;
        $scope.errorsPerTimeVisible = false;
        getCompilationRunDataPerProjectForGraphByUser();
        getCompilationRunDetailDataPerProjectForGraph();
        getProjectAccessDataForGraphPerProject();
      }
      $scope.errorsPerTime = function () {
        $scope.errorsPerProjectVisible = false;
        $scope.errorsPerTimeVisible = true;
        getCompilationRunDataForGraphByUser();
        getCompilationRunDetailDataPerTimeForGraph();
        getProjectAccessDataForGraphByUser();
      }

      // open the date picker for "From"
      $scope.openDatePickerFrom = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.datePickerFromOpen = true;
      };

      // open the date picker for "Until"
      $scope.openDatePickerUntil = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.datePickerUntilOpen = true;
      };

      // update the "From" input model with the value from the date picker
      $scope.updateFromDate = function () {
        if ($scope.fromDate > $scope.untilDate) {
          $scope.untilDate = new Date($scope.fromDate);
        }
        //update();
        $scope.userSelected($scope.usuario);
      };

      // update the "Until" input model with the value from the date picker
      $scope.updateUntilDate = function () {
        if ($scope.fromDate > $scope.untilDate) {
          $scope.fromDate = new Date($scope.untilDate);
        }
        // update();
        $scope.userSelected($scope.usuario);
      };


      /**
       * Given a source array with data, the function adds to the graph array the property .labels
       * which contains the labels for the x-axis of the graph
       *
       * Requires: graphArray.labels must exist and graphArray.labels = []
       *
       * @param aSourceArray {Array} contains elements of form {_id: {year:, month:, day:}, count: }
       * @param aGraphObject {Object} has property 'labels' that is an empty array; will be filled by running this function
       */
      var addLabelsToGraph = function (aSourceArray, aGraphObject) {

        // names of month for the x-axis labels
        var monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        // step-level defines if every data point on x-axis also get a label (default yes, thus value 1)
        var graphStepLevel = 1;
        // if x-axis has more than 20 points, not every point should get label
        // we recalculate the step-level based on number of points on x-axis
        if (aSourceArray.length > 20) {
          graphStepLevel = Math.ceil(aSourceArray.length / 20);
        }

        for (var i = 0; i < aSourceArray.length; i++) {
          if (i % graphStepLevel == 0) {
            // only set a labels at the graphStepLevel
            aGraphObject.labels.push(monthNames[aSourceArray[i]._id.month - 1] + " " + aSourceArray[i]._id.day);
          } else {
            aGraphObject.labels.push("");
          }
        }
      };


      /**
       * JESUS
       * 
       * 
       */
      var addLabelsToGraphByProject = function (aSourceArray, aGraphObject) {



        // step-level defines if every data point on x-axis also get a label (default yes, thus value 1)
        var graphStepLevel = 1;
        // if x-axis has more than 20 points, not every point should get label
        // we recalculate the step-level based on number of points on x-axis


        for (var i = 0; i < aSourceArray.length; i++) {
          // only set a labels at the graphStepLevel
          aGraphObject.labels.push(aSourceArray[i]._id);

        }

      };
      /**
       * Adds a new line to the given graph object.
       * @param aSourceArray {Array} contains elements that contain property {count: }
       * @param aGraphObject {Object} has property 'data' that is an empty array;
       * function will push a new array as element that contains the y-data points for line
       */
      var addLineToGraph = function (aSourceArray, aGraphObject) {
        var dataNew = [];
        for (var i = 0; i < aSourceArray.length; i++) {
          dataNew.push(aSourceArray[i].count);
        }
        aGraphObject.data.push(dataNew);
      }


      /**
       * Displays the graph for number of compilations per day
       * Requires: $scope.compilerSummaryLogs has the data as {_id, count}
       */
      var drawCompilationRunGraph = function () {
        // object containing the data for rendering the graph for compilation and runs
        $scope.compileRunGraph = {
          labels: [],
          series: [],
          data: []
        };

        // sort the array for compilation logs and add the missing dates (which have a count of 0)
        StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryLogs);
        // sort the array for compilation logs and add the missing dates (which have a count of 0)
        StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryRunLogs);


        $scope.compileRunGraph.series.push('Compilations');
        addLineToGraph($scope.compilerSummaryLogs, $scope.compileRunGraph);

        $scope.compileRunGraph.series.push('Runs');
        addLineToGraph($scope.compilerSummaryRunLogs, $scope.compileRunGraph);

        addLabelsToGraph($scope.compilerSummaryLogs, $scope.compileRunGraph)
      };
      //JESUS
      var drawCompilationRunGraphByUser = function () {
        // object containing the data for rendering the graph for compilation and runs
        $scope.compileRunGraphByUser = {
          labels: [],
          series: [],
          data: []
        };
        $http.get('/api/users/' + $route.current.params.username + '/projects', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.allProjectObjects = aReply.ownerSet;
            $scope.allProjectObjects.sort(function (a, b) { return a.id - b.id });

            //algorith modified by the explanation in the .docx

            if ($route.current.params.username != $scope.usuario) {
              $scope.compilerSummaryLogsByUser = intersection($scope.compilerSummaryLogsByUser, $scope.allProjectObjects);

              $scope.compilerSummaryRunLogsByUser = intersection($scope.compilerSummaryRunLogsByUser, $scope.allProjectObjects);
            };




            // sort the array for compilation logs and add the missing dates (which have a count of 0)
            StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryLogsByUser);
            // sort the array for compilation logs and add the missing dates (which have a count of 0)
            StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryRunLogsByUser);

            $scope.totalCompilationsDayByUserThroughTime = '(' + getTotal($scope.compilerSummaryLogsByUser, 'count') + ')';
            $scope.totalRunsDayByUserThroughTime = '(' + getTotal($scope.compilerSummaryRunLogsByUser, 'count') + ')';
            $scope.compileRunGraphByUser.series.push('Compilations');
            addLineToGraph($scope.compilerSummaryLogsByUser, $scope.compileRunGraphByUser);

            $scope.compileRunGraphByUser.series.push('Runs');
            addLineToGraph($scope.compilerSummaryRunLogsByUser, $scope.compileRunGraphByUser);

            addLabelsToGraph($scope.compilerSummaryLogsByUser, $scope.compileRunGraphByUser)

          })
          .error(function (reply) {
            $log.debug('Unable to get project names');
          });




      };
      /**JESUS
       * Function to represent the comp and runs for a specific user with projects in the x axis
       */

      var drawCompilationRunGraphByUserPerProject = function () {
        // object containing the data for rendering the graph for compilation and runs
        $scope.compileRunGraph = {
          labels: [],
          series: [],
          data: []
        };

        // sort the array for compilation logs and add the missing dates (which have a count of 0)
        // StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryLogsByUser);
        $scope.compilerSummaryLogsByUserPerProject.sort(function (a, b) { return a._id - b._id });
        // sort the array for compilation logs and add the missing dates (which have a count of 0)
        //StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryRunLogsByUser);
        $scope.compilerSummaryRunLogsByUserPerProject.sort(function (a, b) { return a._id - b._id });

        // getProjectNames();
        $http.get('/api/users/' + $route.current.params.username + '/projects', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.allProjectObjects = aReply.ownerSet;
            $scope.allProjectObjects.sort(function (a, b) { return a.id - b.id });
            if ($route.current.params.username != $scope.usuario) {
              $scope.compilerSummaryLogsByUserPerProject = intersectionProject($scope.compilerSummaryLogsByUserPerProject, $scope.allProjectObjects);

              $scope.compilerSummaryRunLogsByUserPerProject = intersectionProject($scope.compilerSummaryRunLogsByUserPerProject, $scope.allProjectObjects);
            };



            $scope.compilerSummaryLogsByUserPerProject = inflateProjects($scope.compilerSummaryRunLogsByUserPerProject, $scope.compilerSummaryLogsByUserPerProject);
            $scope.compilerSummaryRunLogsByUserPerProject = inflateProjects($scope.compilerSummaryLogsByUserPerProject, $scope.compilerSummaryRunLogsByUserPerProject);

            $scope.totalCompilationsDayByUserPerProject = '(' + getTotal($scope.compilerSummaryLogsByUserPerProject, 'count') + ')';
            $scope.totalRunsDayByUserPerProject = '(' + getTotal($scope.compilerSummaryRunLogsByUserPerProject, 'count') + ')';
            $scope.compileRunGraph.series.push('Compilations');
            addLineToGraph($scope.compilerSummaryLogsByUserPerProject, $scope.compileRunGraph);

            $scope.compileRunGraph.series.push('Runs');
            addLineToGraph($scope.compilerSummaryRunLogsByUserPerProject, $scope.compileRunGraph);

            addLabelsToGraphByProject($scope.compilerSummaryLogsByUserPerProject, $scope.compileRunGraph)

          })
          .error(function (reply) {
            $log.debug('Unable to get project names');
          });
      };


      /**JESUS
       * Function to represent the comp and runs for a specific user with projects in the x axis
       */

      var drawCompilationRunDetailGraphByUserPerProject = function () {
        // object containing the data for rendering the graph for compilation and runs
        $scope.compileGraphDetail = {
          labels: [],
          series: [],
          data: []
        };
        $scope.runGraphDetail = {
          labels: [],
          series: [],
          data: []
        };

        $scope.compilerSummaryLogsByUserPerProjectDetail.sort(function (a, b) { return a._id - b._id });
        $scope.compilerSummaryRunLogsByUserPerProjectDetail.sort(function (a, b) { return a._id - b._id });

        // getProjectNames();
        $http.get('/api/users/' + $route.current.params.username + '/projects', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.allProjectObjects = aReply.ownerSet;
            $scope.allProjectObjects.sort(function (a, b) { return a.id - b.id });
            if ($route.current.params.username != $scope.usuario) {
              $scope.compilerSummaryLogsByUserPerProjectDetail = intersectionProject($scope.compilerSummaryLogsByUserPerProjectDetail, $scope.allProjectObjects);
              $scope.compilerSummaryRunLogsByUserPerProjectDetail = intersectionProject($scope.compilerSummaryRunLogsByUserPerProjectDetail, $scope.allProjectObjects);
            };



            $scope.compilerSummaryLogsByUserPerProjectDetail = inflateProjects($scope.compilerSummaryRunLogsByUserPerProjectDetail, $scope.compilerSummaryLogsByUserPerProjectDetail);
            $scope.compilerSummaryRunLogsByUserPerProjectDetail = inflateProjects($scope.compilerSummaryLogsByUserPerProjectDetail, $scope.compilerSummaryRunLogsByUserPerProjectDetail);

            $scope.totalCompilationsDayByUserPerProjectDetail = '(' + getTotal($scope.compilerSummaryLogsByUserPerProjectDetail, 'count') + ')';//this is errors
            $scope.totalRunsDayByUserPerProjectDetail = '(' + getTotal($scope.compilerSummaryRunLogsByUserPerProjectDetail, 'count') + ')';
            //use the slice to get only the first elements that are in both arrays, the projects with errors (as they are already ordered)
            //following filters the result with no error against the one with errors
            //computing the intersection of arrays with no error and with error
            //array1.filter(function(n) { return array2.map(function(e){return e._id}).indexOf(n._id) !== -1;});



            $scope.totalCompilationsDayByUserPerProjectError = '(' + getTotal($scope.compilerSummaryLogsByUserPerProject.filter(function (n) { return $scope.compilerSummaryLogsByUserPerProjectDetail.map(function (e) { return e._id }).indexOf(n._id) !== -1; }), 'count') + ')';
            $scope.totalRunsDayByUserPerProjectError = '(' + getTotal($scope.compilerSummaryRunLogsByUserPerProject.filter(function (n) { return $scope.compilerSummaryRunLogsByUserPerProjectDetail.map(function (e) { return e._id }).indexOf(n._id) !== -1; }), 'count') + ')';


            //for comp error graph
            $scope.compileGraphDetail.series.push('Compilations');
            addLineToGraph($scope.compilerSummaryLogsByUserPerProject.filter(function (n) { return $scope.compilerSummaryLogsByUserPerProjectDetail.map(function (e) { return e._id }).indexOf(n._id) !== -1; }), $scope.compileGraphDetail);

            $scope.compileGraphDetail.series.push('Erroneous Compilations');
            addLineToGraph($scope.compilerSummaryLogsByUserPerProjectDetail, $scope.compileGraphDetail);

            addLabelsToGraphByProject($scope.compilerSummaryLogsByUserPerProjectDetail, $scope.compileGraphDetail)

            //for runs erros graph
            $scope.runGraphDetail.series.push('Runs');
            addLineToGraph($scope.compilerSummaryRunLogsByUserPerProject.filter(function (n) { return $scope.compilerSummaryRunLogsByUserPerProjectDetail.map(function (e) { return e._id }).indexOf(n._id) !== -1; }), $scope.runGraphDetail);

            $scope.runGraphDetail.series.push('Erroneous Executions');
            addLineToGraph($scope.compilerSummaryRunLogsByUserPerProjectDetail, $scope.runGraphDetail);

            addLabelsToGraphByProject($scope.compilerSummaryRunLogsByUserPerProjectDetail, $scope.runGraphDetail)

          })
          .error(function (reply) {
            $log.debug('Unable to get project names');
          });
      };

      /**JESUS
       * Function to represent the comp and runs for a specific user with projects in the x axis
       */

      var drawCompilationRunDetailGraphByUserPerTime = function () {
        // object containing the data for rendering the graph for compilation and runs
        $scope.compileGraphDetailTime = {
          labels: [],
          series: [],
          data: []
        };
        $scope.runGraphDetailTime = {
          labels: [],
          series: [],
          data: []
        };


        // sort the array for compilation logs and add the missing dates (which have a count of 0)
        StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryLogsByUserPerTimeDetail);
        // sort the array for compilation logs and add the missing dates (which have a count of 0)
        StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryRunLogsByUserPerTimeDetail);


        // getProjectNames();
        $http.get('/api/users/' + $route.current.params.username + '/projects', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.allProjectObjects = aReply.ownerSet;
            $scope.allProjectObjects.sort(function (a, b) { return a.id - b.id });
            //algorith modified by the explanation in the .docx
            if ($route.current.params.username != $scope.usuario) {
              $scope.compilerSummaryLogsByUserPerTimeDetail = intersection($scope.compilerSummaryLogsByUserPerTimeDetail, $scope.allProjectObjects);

              $scope.compilerSummaryRunLogsByUserPerTimeDetail = intersection($scope.compilerSummaryRunLogsByUserPerTimeDetail, $scope.allProjectObjects);
            };


            //algorith modified by the explanation in the .docx

            //for computing the intersection of two arrays by the attribute _id
            //array1.filter(function(n) { return array2.map(function(e){return e._id}).indexOf(n._id) !== -1;});

            // sort the array for compilation logs and add the missing dates (which have a count of 0)
            StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryLogsByUserPerTimeDetail);
            // sort the array for compilation logs and add the missing dates (which have a count of 0)
            StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryRunLogsByUserPerTimeDetail);



            $scope.totalCompilationsDayByUserPerTimetDetail = '(' + getTotal($scope.compilerSummaryLogsByUserPerTimeDetail, 'count') + ')';
            $scope.totalRunsDayByUserPerTimeDetail = '(' + getTotal($scope.compilerSummaryRunLogsByUserPerTimeDetail, 'count') + ')';

            $scope.compilerSummaryLogsByUser = intersection2($scope.compilerSummaryLogsByUser, $scope.compilerSummaryLogsByUserPerTimeDetail);
            //use the slice to get only the first elements that are in both arrays, the projects with errors (as they are already ordered)
           


            $scope.totalCompilationsDayByUserPerTimeError = '(' + getTotal($scope.compilerSummaryLogsByUser, 'count') + ')';
            $scope.totalRunsDayByUserPerTimeError = '(' + getTotal($scope.compilerSummaryRunLogsByUser, 'count') + ')';


            $scope.compilerSummaryRunLogsByUser = intersection2($scope.compilerSummaryRunLogsByUser, $scope.compilerSummaryRunLogsByUserPerTimeDetail);

            $scope.totalRunsDayByUserPerTimeError = '(' + getTotal($scope.compilerSummaryRunLogsByUser, 'count') + ')';

            //for comp error graph
            $scope.compileGraphDetailTime.series.push('Compilations');
            
            StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryLogsByUser);

            addLineToGraph($scope.compilerSummaryLogsByUser, $scope.compileGraphDetailTime);

            $scope.compileGraphDetailTime.series.push('Erroneous Compilations');
            addLineToGraph($scope.compilerSummaryLogsByUserPerTimeDetail, $scope.compileGraphDetailTime);

            addLabelsToGraph($scope.compilerSummaryLogsByUserPerTimeDetail, $scope.compileGraphDetailTime)

            //for runs erros graph   PROBLEMA: EN UN ARRAY LOS PROYECTOS ESTAN CON ID Y EN EL OTRO CON NOMBRE
            $scope.runGraphDetailTime.series.push('Runs');
            
            StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.compilerSummaryRunLogsByUser);

            addLineToGraph($scope.compilerSummaryRunLogsByUser, $scope.runGraphDetailTime);

            $scope.runGraphDetailTime.series.push('Erroneous Executions');
            addLineToGraph($scope.compilerSummaryRunLogsByUserPerTimeDetail, $scope.runGraphDetailTime);

            addLabelsToGraph($scope.compilerSummaryRunLogsByUserPerTimeDetail, $scope.runGraphDetailTime)

          })
          .error(function (reply) {
            $log.debug('Unable to get project names');
          });
      };


      /**
       * JESUS Function to retrieve the names of the projects receiving an array of project indexes.
       * 
       */

      var getProjectNames = function () {
        $http.get('/api/users/' + $route.current.params.username + '/projects', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.allProjectObjects = aReply.ownerSet;
            $scope.allProjectObjects.sort(function (a, b) { return a.id - b.id });
            $scope.compilerSummaryLogsByUserPerProject.forEach(function (element, index) {
              element._id = $scope.allProjectObjects[index].projectname;
            });

            //removeNotOwned();


          })
          .error(function (reply) {
            $log.debug('Unable to get project names');
          });


      }

      /**
       * JESUS
       * 
       */
      var removeNotOwned = function () {
        var valid = false;
        $scope.compilerSummaryLogsByUserPerProject.forEach(function (all, index1) {
          $scope.allProjectObjects.forEach(function (filtered, index2) {
            if (filtered.id == all._id) {
              valid = true;
            }
          });
          if (valid == false) {
            $scope.compilerSummaryLogsByUserPerProject.splice(index, 1);
          }
          valid = false;
        });
      }


      /**
       * Displays the graph for number project accesses per day
       * Requires: $scope.projectAccessPerDay has the data as {_id, count}
       */
      var drawProjectAccessGraph = function () {

        $scope.dataGraphUserAccess = {
          labels: [],
          series: [],
          data: []
        };



        $http.get('/api/users/' + $route.current.params.username + '/projects', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.allProjectObjects = aReply.ownerSet;
            $scope.allProjectObjects.sort(function (a, b) { return a.id - b.id });
            StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.projectAccessPerDay);

            //algorith modified by the explanation in the .docx
            if ($route.current.params.username != $scope.usuario) {
              $scope.projectAccessPerDay = intersection($scope.projectAccessPerDay, $scope.allProjectObjects);

            };

            $scope.totalAccessPerDayTime = '(' + getTotal($scope.projectAccessPerDay, 'count') + ')';

            $scope.dataGraphUserAccess.series.push('Project accesses');
            addLineToGraph($scope.projectAccessPerDay, $scope.dataGraphUserAccess);
            addLabelsToGraph($scope.projectAccessPerDay, $scope.dataGraphUserAccess);

          })
          .error(function (reply) {
            $log.debug('Unable to get project names');
          });


        // sort the array and add the missing dates (with value 0)


      };

      /**
       * Displays the graph for number project accesses per day
       * Requires: $scope.projectAccessPerDay has the data as {_id, count}
       */
      var drawProjectAccessGraphPerProject = function () {

        $scope.dataGraphUserAccessPerProject = {
          labels: [],
          series: [],
          data: []
        };

        // sort the array and add the missing dates (with value 0)
        //StatsSrv.sortAndAddMissingDates($scope.fromDate, $scope.untilDate, $scope.projectAccessPerDay);


        $scope.projectAccessPerDayPerProject.sort(function (a, b) { return a._id - b._id });

        $http.get('/api/users/' + $route.current.params.username + '/projects', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.allProjectObjects = aReply.ownerSet;
            $scope.allProjectObjects.sort(function (a, b) { return a.id - b.id });
            if ($route.current.params.username != $scope.usuario) {
              $scope.projectAccessPerDayPerProject = intersectionProject($scope.projectAccessPerDayPerProject, $scope.allProjectObjects);

            };

            /*var valid = false;
            $scope.aux = $scope.projectAccessPerDayPerProject.slice(0);
            var keep = 0;
            var j = 0;
            var i = 0;
            for (i = 0; i < $scope.aux.length; i++) {
              for (j = 0; j < $scope.allProjectObjects.length; j++) {
                if ($scope.projectAccessPerDayPerProject.length > keep) {
                  if ($scope.projectAccessPerDayPerProject[keep]._id == $scope.allProjectObjects[j].id) {
                    valid = true;
                    $scope.projectAccessPerDayPerProject[keep]._id = $scope.allProjectObjects[j].projectname;
                    keep++;
                  }
                }
              }
              if (valid == false) {
                $scope.projectAccessPerDayPerProject.splice(keep, 1);
              }
              valid = false;
            }*/
            $scope.totalAccessPerDayPerProject = '(' + getTotal($scope.projectAccessPerDayPerProject, 'count') + ')';

            $scope.dataGraphUserAccessPerProject.series.push('Project accesses');
            addLineToGraph($scope.projectAccessPerDayPerProject, $scope.dataGraphUserAccessPerProject);
            addLabelsToGraphByProject($scope.projectAccessPerDayPerProject, $scope.dataGraphUserAccessPerProject);

          })
          .error(function (reply) {
            $log.debug('Unable to get project names');
          });

      };

      /**
       * Requests the compilation and run summary per day for all projects
       * and displays a graph
       */
      var getCompilationRunDataForGraph = function () {

        $scope.isLoadingCompilationRunGraphData = true;
        //the projectId is going to be undefined. At the server, when the filter is applied to the ddbb, this field is checked and if it is undefined,
        //the results taken are not filtered by ID, all projects are taken
        var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/summaryCompilationRunDay/', {
          params: {
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {

            $scope.compilerSummaryLogs = aReply.compilerLogs;
            $scope.compilerSummaryRunLogs = aReply.compilerRunLogs;

            $scope.totalCompilationsDay = '(' + getTotal($scope.compilerSummaryLogs, 'count') + ')';
            $scope.totalRunsDay = '(' + getTotal($scope.compilerSummaryRunLogs, 'count') + ')';

            $scope.total
            /**for(var i = 0; i<$scope.compilerSummaryLogs.length;i++){
              $scope.totalCompilationsByUser = $scope.totalCompilationsByUser+
            }*/


            drawCompilationRunGraph();
            $scope.isLoadingCompilationRunGraphData = false;

          })
          .error(function (reply) {
            $log.debug('Unable to get compile and run logs statistics (summary per day).');
          });
      };
      //JESUS
      var getCompilationRunDataForGraphByUser = function () {

        $scope.isLoadingCompilationRunGraphData = true;

        // var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/getCompilationRunDataForGraphByUser/', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {

            $scope.compilerSummaryLogsByUser = aReply.compilerLogs;
            $scope.compilerSummaryRunLogsByUser = aReply.compilerRunLogs;

            //$scope.totalCompilationsDayByUser = '(' + getTotal($scope.compilerSummaryLogsByUser, 'count') + ')';//no sirve, es antes de filtrar los proyectos
            //$scope.totalRunsDayByUser = '(' + getTotal($scope.compilerSummaryRunLogsByUser, 'count') + ')';

            drawCompilationRunGraphByUser();
            $scope.isLoadingCompilationRunGraphData = false;

          })
          .error(function (reply) {
            $log.debug('Unable to get compile and run logs statistics (summary per day).');
          });
      };

      /** JESUS Function to retrieve the  compilation ERRORS and run info per specific user grouped by projects
            * and not grouped by time. It will be used to construct the graph comp/project. It al
            * 
            */
      var getCompilationRunDetailDataPerProjectForGraph = function () {

        $scope.isLoadingCompilationRunGraphDataDetail = true;

        // var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/getCompilationRunDataDetailPerProjectForGraph/', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            //receiving data for erroneous comp,
            $scope.compilerSummaryLogsByUserPerProjectDetail = aReply.compilerLogs;
            $scope.compilerSummaryRunLogsByUserPerProjectDetail = aReply.compilerRunLogs;



            drawCompilationRunDetailGraphByUserPerProject();
            $scope.isLoadingCompilationRunGraphDataDetail = false;

          })
          .error(function (reply) {
            $log.debug('Unable to get compile and run logs statistics (summary per day).');
          });
      };

      /** JESUS Function to retrieve the  compilation ERRORS and run info per specific user grouped by time
            * . It will be used to construct the graph comp/project. It al
            * 
            */
      var getCompilationRunDetailDataPerTimeForGraph = function () {

        $scope.isLoadingCompilationRunGraphDataDetailTime = true;

        // var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/getCompilationRunDataDetailPerTimeForGraph/', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            //receiving data for erroneous comp,
            $scope.compilerSummaryLogsByUserPerTimeDetail = aReply.compilerLogs;
            $scope.compilerSummaryRunLogsByUserPerTimeDetail = aReply.compilerRunLogs;



            drawCompilationRunDetailGraphByUserPerTime();
            $scope.isLoadingCompilationRunGraphDataDetailTime = false;

          })
          .error(function (reply) {
            $log.debug('Unable to get compile and run logs statistics (summary per day).');
          });
      };


      /** JESUS Function to retrieve the  compilation and run info per specific user grouped by projects
       * and not grouped by time. It will be used to construct the graph comp/project. 
       * 
       */
      var getCompilationRunDataPerProjectForGraphByUser = function () {

        $scope.isLoadingCompilationRunGraphData = true;

        // var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/getCompilationRunDataPerProjectForGraphByUser/', {
          params: {

            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {

            $scope.compilerSummaryLogsByUserPerProject = aReply.compilerLogs;
            $scope.compilerSummaryRunLogsByUserPerProject = aReply.compilerRunLogs;
            drawCompilationRunGraphByUserPerProject();
            $scope.isLoadingCompilationRunGraphData = false;

          })
          .error(function (reply) {
            $log.debug('Unable to get compile and run logs statistics (summary per day).');
          });
      };


      // JESUS get access data for specific user in one or all projects
      var getProjectAccessDataForGraphByUser = function () {

        $scope.isLoadingUserAccessGraphData = true;

        var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/summaryProjectAccessDayByUser/', {
          params: {
            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.projectAccessPerDay = aReply.projectAccessPerDay;
            //$scope.totalAccessPerDay = '(' + getTotal($scope.projectAccessPerDay, 'count') + ')';
            drawProjectAccessGraph();//it calls the previously used by default function to draw access graph
            $scope.isLoadingUserAccessGraphData = false;

          })
          .error(function (reply) {
          });
      };


      /**
       * Hides/shows the table with details of the compilation/run for each user
       * JESUS Modified function: it will show a graph with compilation and errors
       */
      $scope.hideShowCompilationRunDetail = function () {
        $scope.compilationRunTableVisibleDetail = !$scope.compilationRunTableVisibleDetail;
        if ($scope.compilationRunTableVisibleDetail) {
          $scope.compilationRunBtnLabelGraph = "Hide compilation details";
          getCompilationRunDetailDataPerProjectForGraph();
        }
        else {
          $scope.compilationRunBtnLabelGraph = "Show compilation details";
        }
      };

      /**Function to get the access data with projects in the x axis
       * 
       */
      // queries the data for the summary of the project access and draws the graph
      var getProjectAccessDataForGraphPerProject = function () {

        $scope.isLoadingUserAccessGraphData = true;

        var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/summaryProjectAccessDayPerProject/', {
          params: {
            user: $scope.usuario,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.projectAccessPerDayPerProject = aReply.projectAccessPerDay;
            drawProjectAccessGraphPerProject();
            $scope.isLoadingUserAccessGraphData = false;

          })
          .error(function (reply) {
          });
      };


      /**
       * Hides/shows the table with details of the compilation/run for each user
       */
      $scope.hideShowCompilationRunTable = function () {
        $scope.compilationRunTableVisible = !$scope.compilationRunTableVisible;
        if ($scope.compilationRunTableVisible) {
          $scope.compilationRunBtnLabel = "Hide compilation details";
          //getCompilationRunDataForTable();
          getCompilationRunDetailDataPerTimeForGraph();//function to retrieve the error comp by time
        }
        else {
          $scope.compilationRunBtnLabel = "Show compilation details";
        }
      };


      /**
       * Hides/shows the table with details of the project accesses for each user
       */
      $scope.hideShowProjectAccessDetails = function () {
        $scope.projectAccessTableVisible = !$scope.projectAccessTableVisible;
        if ($scope.projectAccessTableVisible) {
          $scope.projectAccessBtnLabel = "Hide user details";
          getProjectAccessDataForTable();
        }
        else {
          $scope.projectAccessBtnLabel = "Show user details";
        }
      };


      /**
       * Hides/shows the table with details of the submissions for each user
       */
      $scope.hideShowSubmissionsDetails = function () {
        $scope.submissionTableVisible = !$scope.submissionTableVisible;
        if ($scope.submissionTableVisible) {
          $scope.submissionBtnLabel = "Hide user details";
          getSubmissionDataForTable();
        }
        else {
          $scope.submissionBtnLabel = "Show user details";
        }

      };


      // Variables used for pagination
      $scope.currentPageProjectAccess = 0;
      $scope.currentPageCompilations = 0;
      $scope.currentPageRuns = 0;
      $scope.currentPageSubmissions = 0;
      $scope.numPerPage = 10;
      $scope.maxSizePage = 10;
      $scope.filteredProjAccesses = [];
      $scope.filteredCompilations = [];
      $scope.filteredRuns = [];
      $scope.filteredSubmissions = []

      /**
       * Function to filter the page taking the current page number
       * the original array with data and returns the filtered array
       */
      $scope.pageChanged = function (pageNum, originalArray) {
        var begin = (pageNum - 1) * $scope.numPerPage;
        var end = begin + $scope.numPerPage;
        if (originalArray != undefined) {
          return originalArray.slice(begin, end);
        }
        else {
          return [];
        }
      };


      /**
       * Function to update the information of the pagination for compilations stats (per user)
       */
      $scope.pageCompilationChanged = function () {
        $scope.filteredCompilations = $scope.pageChanged($scope.currentPageCompilations, $scope.compilationStats)
      };


      /**
       * Function to update the information of the pagination for run stats (per user)
       */
      $scope.pageRunsChanged = function () {
        $scope.filteredRuns = $scope.pageChanged($scope.currentPageRuns, $scope.runStats)
      };


      /**
       * Function to update the information of the pagination for project accesses (per user)
       */
      $scope.pageProjectAccessChanged = function () {
        $scope.filteredProjAccesses = $scope.pageChanged($scope.currentPageProjectAccess, $scope.accessStats)
      };


      /**
       * Function to update the information of the pagination for submissions (per user)
       */
      $scope.pageSubmissionsChanged = function () {
        $scope.filteredSubmissions = $scope.pageChanged($scope.currentPageSubmissions, $scope.submissionStats)
      };


      /**
       * Auxiliary function to sort the stats
       *
       */
      var sortStats = function (arr) {
        arr.sort(function (a, b) {
          // Turn your strings into dates, and then subtract them
          // to get a value that is either negative, positive, or zero.
          if (a._id < b._id) return -1;
          if (a._id > b._id) return 1;
          return 0;
        });
      };


      /**
       * Function to return the sum of all values stored in an array under "propertyname".
       * @param inputArray the array over which to iterate
       * @param propertyName the name of the property of each array element that should be summed
       * @return {number} the total sum
       */
      var getTotal = function (inputArray, propertyName) {
        var result = 0;

        for (var i = 0; i < inputArray.length; i++) {
          result += inputArray[i][propertyName];
        }

        return result;
      }


      /**
       * gets the stats about compilations and runs aggregated by user
       */
      var getCompilationRunDataForTable = function () {
        $scope.isLoadingCompilationRunDetails = true;//flag for original detail tables

        var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/summaryCompiler/' + projectId, {
          params: {
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        }).
          success(function (success) {
            $scope.compilationStats = success.compilerLogs;
            $scope.runStats = success.compilerRunLogs;

            $scope.totalCompilations = getTotal($scope.compilationStats, 'countProjectAccess');
            $scope.totalRuns = getTotal($scope.runStats, 'countProjectAccess');

            sortStats($scope.compilationStats);
            sortStats($scope.runStats);

            $scope.currentPageCompilations = 1;
            $scope.pageCompilationChanged();

            $scope.currentPageRuns = 1;
            $scope.pageRunsChanged();
            $scope.isLoadingCompilationRunDetails = false;
          }).
          error(function (reply) {
            $log.debug('Unable to get compile and run logs statistics.');
          });
      };


      /**
       * Gets from the server the project access data for the starting
       * and ending dates
       */
      var getProjectAccessDataForTable = function () {
        $scope.isLoadingProjectAccessDetails = true;
        var projectId = $route.current.params.projectId;

        $http.get('/api/log/user/summaryProjectAccess2/', {
          params: {
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        }).
          success(function (success) {
            $scope.accessStats = success.projectAccess;
            $scope.totalAccesses = getTotal($scope.accessStats, 'countProjectAccess');

            sortStats($scope.accessStats);

            $scope.currentPageProjectAccess = 1;
            $scope.pageProjectAccessChanged();
            $scope.isLoadingProjectAccessDetails = false;
          }).
          error(function (reply) {
            $log.debug('Unable to get compile and run logs statistics.');
          });
      };


      /**
       * Gets from the server the details of the submissions for the starting
       * and ending dates
       */
      var getSubmissionDataForTable = function () {
        $scope.isLoadingSubmissionsDetails = true;

        var projectId = $route.current.params.projectId;
        $http.get('/api/log/user/summarySubmitAccess/' + projectId, {
          params: {
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        }).
          success(function (success) {
            $scope.submissionStats = success.submitLogs;
            $scope.totalSubmissions = getTotal($scope.submissionStats, 'countProjectAccess');

            sortStats($scope.submissionStats);

            $scope.currentPageSubmissions = 1;
            $scope.pageSubmissionsChanged();

            $scope.isLoadingSubmissionsDetails = false;

          })
          .error(function (err) {
            $log.debug('Unable to get submission statistics.');
          });
      };



      /**
       * Updates the data when the starting or ending dates are changed
       */
      var update = function () {

        // check that the date models actually have a value; might be empty if e.g. user click "clear" in date picker
        if ($scope.fromDate && $scope.untilDate) {

          //getCompilationRunDataForGraph();

          //getProjectAccessDataForGraph();

          // update the table with compilation details if it's displayed
          if ($scope.isLoadingCompilationRunGraphData) {
            getCompilationRunDetailDataPerProjectForGraph();
          }

          // update the table with project access details if it's displayed
          if ($scope.projectAccessTableVisible) {
            getProjectAccessDataForTable();
          }

          // update the table with submissions details if  it's displayed
          if ($scope.submissionTableVisible) {
            getSubmissionDataForTable();
          }
        }
      };
      $scope.loadUsers = function () {
        getProjectAccessDataForTable();
      };


      $scope.userSelected = function (userS) {
        $scope.usuarioElegido = true;
        if (userS._id != undefined) {
          $scope.allProjectObjects = undefined;
          $scope.usuario = userS._id;
        }
        getCompilationRunDataForGraphByUser();//comp runs by time for one user
        getProjectAccessDataForGraphByUser();//accesses by time for one user
        getCompilationRunDataPerProjectForGraphByUser();//comp runs by project for one user
        getProjectAccessDataForGraphPerProject();//accesses by proejct for one user
        //if the data for the details is displayed, update it also
        if (!$scope.isLoadingCompilationRunGraphDataDetail) {
          getCompilationRunDetailDataPerProjectForGraph();
        };
        if (!$scope.isLoadingCompilationRunGraphDataTime) {
          getCompilationRunDetailDataPerTimeForGraph();
        };

      };
      // run update the first time the script is parsed
      $scope.usuario = '';
      update();
      $scope.update = function () {
        if ($scope.usuario != '') {
          $scope.userSelected($scope.usuario);//if the button search is clicked, call the function for the desplegable
          //getCompilationRunDataForGraphByUser();//JESUS
        }
      };

      var intersection = function (arrayActivity, arrayProjects) {
        //algorith modified by the explanation in the .docx
        var valid = false;
        var validProject = false;
        // var aux = arrayActivity.slice(0); //copio el array de compilaciones entero
        var aux = JSON.parse(JSON.stringify(arrayActivity));
        var keep = 0;//indica el numbero de proyectos que he manteindo y ya les he cambiado el nombre. Lo incremento porque estan ordenados ya ambos arrays
        //si meto uno en la posicion 1, el siguiente que me encuetre ira en la posicion 2, en la 1 imposible
        var j = 0;
        var i = 0;
        var k = 0;
        for (i = 0; i < aux.length; i++) { //para todo el array de compilaciones
          if (arrayActivity[i].projectId != undefined) {

            var aux2 = arrayActivity[i].projectId.slice(0);//copia del array de projectIds
            var keep2 = 0;
            for (k = 0; k < aux2.length; k++) {//compruebo cada projectId en la acividad de ese dia
              for (j = 0; j < arrayProjects.length; j++) {//compruebo cada elemento del array de proyectos del usuario
                if (arrayActivity.length > keep) {//si no he llegado al final del array (es necesaria?)

                  if (arrayActivity[i].projectId[keep2] == arrayProjects[j].id) {//compruebo si es igual el id en ambos, es decir, el proyecto pertenece al usuario
                    valid = true;
                    //$scope.compilerSummaryLogsByUser[keep]._id = $scope.allProjectObjects[j].projectname;//no necesito cambiar el nombre
                    keep2++;
                    validProject = true;
                    break;
                  }
                }
              }

              if (validProject == false) {
                arrayActivity[i].projectId.splice(keep2, 1);//si he recorrido todos los proyectos y no lo he encontrado: borro ese proyecto del array
                arrayActivity[i].count--;//resto una compilacion al total de ese dia
              }
              validProject = false;
            }
            /*if (valid == false) {
              $scope.compilerSummaryLogsByUser.splice(keep, 1);//elimino esa entrada
            }*/
            valid = false;
          }
        }
        return arrayActivity;
      }

      var intersection2 = function (arrayActivity, arrayProjects) {
        //algorith modified by the explanation in the .docx
        var valid = false;
        var validProject = false;
        // var aux = arrayActivity.slice(0); //copio el array de compilaciones entero
        var aux = JSON.parse(JSON.stringify(arrayActivity));
        var keep = 0;//indica el numbero de proyectos que he manteindo y ya les he cambiado el nombre. Lo incremento porque estan ordenados ya ambos arrays
        //si meto uno en la posicion 1, el siguiente que me encuetre ira en la posicion 2, en la 1 imposible
        var j = 0;
        var i = 0;
        var k = 0;
        var l = 0;
        for (i = 0; i < aux.length; i++) { //para todo el array de compilaciones
          if (arrayActivity[i].projectId != undefined) {
            var aux2 = arrayActivity[i].projectId.slice(0);//copia del array de projectIds
            var keep2 = 0;
            for (k = 0; k < aux2.length; k++) {//compruebo cada projectId en la acividad de ese dia
              for (j = 0; j < arrayProjects.length; j++) {//compruebo cada elemento del array de proyectos del usuario
                if (arrayActivity.length > keep) {//si no he llegado al final del array (es necesaria?)
                  if (arrayProjects[j].projectId != undefined) {
                    for (l = 0; l < arrayProjects[j].projectId.length; l++) {
                      if (arrayActivity[i].projectId[keep2] == arrayProjects[j].projectId[l]) {//compruebo si es igual el id en ambos, es decir, el proyecto pertenece al usuario
                        valid = true;
                        //$scope.compilerSummaryLogsByUser[keep]._id = $scope.allProjectObjects[j].projectname;//no necesito cambiar el nombre
                        keep2++;
                        validProject = true;
                        break;
                      }
                    }
                    if (validProject) {
                      break;
                    }
                  }
                }
              }
              if (validProject == false) {
                arrayActivity[i].projectId.splice(keep2, 1);//si he recorrido todos los proyectos y no lo he encontrado: borro ese proyecto del array
                arrayActivity[i].count--;//resto una compilacion al total de ese dia
              }
              validProject = false;
            }
            /*if (valid == false) {
              $scope.compilerSummaryLogsByUser.splice(keep, 1);//elimino esa entrada
            }*/
            valid = false;
          }
        }
        return arrayActivity;
      }

      var intersectionProject = function (arrayAct, arrayProjects) {
        var valid = false;
        //var aux = arrayAct.slice(0);
        var aux = JSON.parse(JSON.stringify(arrayAct));
        var keep = 0;
        var j = 0;
        var i = 0;
        for (i = 0; i < aux.length; i++) {
          for (j = 0; j < arrayProjects.length; j++) {
            if (arrayAct.length > keep) {
              if (arrayAct[keep]._id == arrayProjects[j].id) {
                valid = true;
                arrayAct[keep]._id = arrayProjects[j].projectname;
                keep++;
              }
            }
          }
          if (valid == false) {
            arrayAct.splice(keep, 1);
          }
          valid = false;
        }
        return arrayAct;
      }


      var inflateProjects = function (array1, array2) {

        //iterate through array1 and if project dont found in array2, add it in array 2
        // var aux1 = array1.slice(0);
        var aux1 = JSON.parse(JSON.stringify(array1));//in order to copy INDEPENDENT ARRAYS
        var aux2 = JSON.parse(JSON.stringify(array2));

        // var aux2 = array2.slice(0);
        var valid = false;
        for (var i = 0; i < array1.length; i++) {
          for (var j = 0; j < array2.length; j++) {
            if (aux1[i]._id == aux2[j]._id) {
              valid = true;
              break;
            }
          }
          if (valid == false) {
            aux2.push(aux1.slice(i, i + 1)[0]);
            aux2[aux2.length - 1].count = 0;
          }
          valid = false;
        }
        return aux2.sort(function (a, b) {
          if (a.projectname == undefined) {
            var a = a._id - b._id;
          } else {
            var a = traduccion(a._id) - traduccion(b._id);
          }
          return a;
        });
      }

      var traduccion = function (nombre) {
        var id;
        id = $scope.allProjectObjects[$scope.allProjectObjects.map(function (e) { return e.projectname }).indexOf(nombre)].id;
        return id;
      }
      var traduccion2 = function (ident) {
        var id;
        id = $scope.allProjectObjects[$scope.allProjectObjects.map(function (e) { return e.id }).indexOf(ident)].id;
        return id;
      }
      $scope.myFilter = function (user) {
        return user._id.startsWith($scope.usuario);
      };

      var studentConsult = function (arrayAct) {
        $http.get('/api/users/' + $route.current.params.username + '/projects', {
          params: {

            user: undefined,
            startDateLogs: $scope.fromDate,
            endDateLogs: $scope.untilDate
          }
        })
          .success(function (aReply) {
            $scope.allProjectObjects = aReply.ownerSet;
            $scope.allProjectObjects.sort(function (a, b) { return a.id - b.id });


            var valid = false;
            //var aux = arrayAct.slice(0);
            var aux = JSON.parse(JSON.stringify(arrayAct));
            var keep = 0;
            var j = 0;
            var i = 0;
            for (i = 0; i < aux.length; i++) {
              for (j = 0; j < allProjectObjects.length; j++) {
                if (arrayAct.length > keep) {
                  if (arrayAct[keep]._id == allProjectObjects[j].id) {
                    valid = true;
                    arrayAct[keep]._id = allProjectObjects[j].projectname;
                    keep++;
                  }
                }
              }
              if (valid == false) {
                arrayAct.splice(keep, 1);
              }
              valid = false;
            }
            return arrayAct;
          });
      }

    }]);
