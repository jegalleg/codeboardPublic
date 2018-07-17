/**
 * Created by Martin on 22/09/14.
 */

var logSrv = require('../services/logSrv.js');

var getLogs = function (req, res) {
  var result = {};
  var limit = req.params.limit;
  result = logSrv.showAllLogs(res, limit);
};

/**
 * Get compilation log summary per day. If the requests has a projectId defined, then
 * returns the summary for that projectID, otherwise it returns it for all projects
 * @param req
 * @param res
 */
var getCompilationPerDayLogs = function (req, res) {
  var projectId = req.params.projectId;
  //JESUS get the user data in order to filter
  
  logSrv.showCompilationPerDayLogs(req.param('startDateLogs'), req.param('endDateLogs'), projectId, res);
};

/**JESUS */

var getCompilationPerDayLogsByUser = function (req, res) {
  var projectId = req.params.projectId;
  //JESUS get the user data in order to filter
  if(req.param('user')){
    var user = req.param('user');
  }
  logSrv.showCompilationPerDayLogsByUser(req.param('startDateLogs'), req.param('endDateLogs'),user, projectId, res);
};

var getCompilationPerUserAllProjectsLogs = function (req, res) {
  var projectId = req.params.projectId;
  //JESUS get the user data in order to filter
  if(req.param('user')){
    var user = req.param('user');
  }
  logSrv.showCompilationPerDayLogsByUser(req.param('startDateLogs'), req.param('endDateLogs'),user,projectId, res);
};
/**JESUS
 * 
 * @param {*} req 
 * @param {*} res 
 */
var getCompilationPerUserPerProjectsLogs = function (req, res) {
  var projectId = req.params.projectId;
  //JESUS get the user data in order to filter
  if(req.param('user')){
    var user = req.param('user');
  }
  logSrv.showCompilationPerProjectLogsByUser(req.param('startDateLogs'), req.param('endDateLogs'),user,projectId, res);
};
/**JESUS
 * 
 * @param {*} req 
 * @param {*} res 
 */
var getCompilationDetailPerUserPerProjectsLogs = function (req, res) {
  var projectId = req.params.projectId;
  //JESUS get the user data in order to filter
  if(req.param('user')){
    var user = req.param('user');
  }
  logSrv.showCompilationDetailPerProjectLogsByUser(req.param('startDateLogs'), req.param('endDateLogs'),user,projectId, res);
};
/**JESUS
 * 
 * @param {*} req 
 * @param {*} res 
 */
var getCompilationDetailPerUserPerTimeLogs = function (req, res) {
  var projectId = req.params.projectId;//projectId is going to be undefined (keep it if in a future exapansion, this is wanted by a specific project)
  //JESUS get the user data in order to filter
  if(req.param('user')){
    var user = req.param('user');
  }
  logSrv.showCompilationPerDayLogsByUserError(req.param('startDateLogs'), req.param('endDateLogs'),user,projectId, res);
};


//JESUS
var getUserCompilationPerProject = function(req,res){
  var user = req.param('user');
  logSrv.showUserCompilationPerProject(req.param('startDateLogs'), req.param('endDateLogs'),user, res);

}

/**
 * Get compilation log summary per hour
 * @param req
 * @param res
 */
var getCompilationPerHourLogs = function (req, res) {
  logSrv.showCompilationPerHourLogs(res);
};

/**
 * Get project access log summary per user
 * @param req
 * @param res
 */
var getProjectAccessPerUserLogs = function (req, res) {
  logSrv.showProjectAccessPerUser(res);
};

/**
 * Get project access log summary per project
 * @param req
 * @param res
 */
var getProjectAccessPerProjectLogs = function (req, res) {
  var projectId = req.params.projectId;
  if(projectId == undefined){
    logSrv.showProjectAccessPerProject2(req.param('startDateLogs'), req.param('endDateLogs'), res);
  }else{
    logSrv.showProjectAccessPerProject(projectId, req.param('startDateLogs'), req.param('endDateLogs'), res);
  }
};
//JESUS
var getProjecAccessPerUserAllProjectsLogs = function (req, res) {
  var projectId = req.params.projectId;
  if(req.param('user')){
    var user = req.param('user');
  }
  logSrv.showProjectAccessPerDayLogsByUser( req.param('startDateLogs'), req.param('endDateLogs'),projectId,user, res);
};

/**
 * Get compilation summary per user
 * @param req
 * @param res
 */
var getCompilerActivityPerUserLogs = function (req, res) {
  logSrv.showCompilerActivityPerUser(res);
};

/**
 * Get compilation summary per project
 * @param req
 * @param res
 */
var getCompilerActivityPerProjectLogs = function (req, res) {
  var projectId = parseInt(req.params.projectId);
  logSrv.showCompilerActivityPerProject(projectId, req.param('startDateLogs'),req.param('endDateLogs'),res);
};


/**
 * Get submit summary per project
 * @param req
 * @param res
 */
var getSubmitPerProjectLogs = function (req, res) {
  var projectId = req.params.projectId;
  logSrv.showSubmitPerProject(projectId, req.param('startDateLogs'), req.param('endDateLogs'), res);
};


/**
 * Get compilation summary per project
 * @param req
 * @param res
 */
var getSubmitPerUserLogs = function (req, res) {
  logSrv.showSubmitPerUserLogs(res);
};


/**
 * Get the project access per day (for all projects)
 * @param req
 * @param res
 */
var getProjectAccessPerDayLogs = function (req, res) {
  var projectId = req.params.projectId;
  logSrv.showProjectAccessPerDayLogs(req.param('startDateLogs'), req.param('endDateLogs'),projectId,res);
};
/**
 * Get the project access per day (for all projects)
 * @param req
 * @param res
 */
var getProjectAccessLogsPerProject = function (req, res) {
  var projectId = req.params.projectId;//projectId is going to be undefined
  if(req.param('user')){
    var userName = req.param('user');
  }
  logSrv.showProjectAccessLogsPerProject(req.param('startDateLogs'), req.param('endDateLogs'),projectId,res,userName);
};

/**
 * Get the number of active projects (different projects accessed) per day (for all projects)
 * @param req
 * @param res
 */
var getActiveProjectPerDayLogs = function (req, res) {
  logSrv.showActiveProjectPerDayLogs(req.param('startDateLogs'), req.param('endDateLogs'),res);
};


/**
 * get the number of compilations per programming language (for all Projects)
 * @param req
 * @param res
 */
var getCompilationsPerLanguage = function (req, res) {
  logSrv.showCompilationsPerLanguage(req.param('startDateLogs'), req.param('endDateLogs'),res);
};


/**
 * get the number of compilations errors by classifying them in (normal, slow, too slow, and error)
 * @param req
 * @param res
 */
var getCompilationsErrors = function (req, res) {
  logSrv.showCompilationsErrors(req.param('startDateLogs'), req.param('endDateLogs'),res);
};

/**
 * get the first 50 projects with more user accesses
 * @param req
 * @param res
 */
var getPopularProjects = function (req, res) {
  var limit = parseInt(req.param('limit'));
  logSrv.showPopularProjects(req.param('startDateLogs'), req.param('endDateLogs'),limit,res);
};


// export the service functions
//JESUS
exports.getUserCompilationPerProject = getUserCompilationPerProject;
exports.getCompilationPerDayLogsByUser = getCompilationPerDayLogsByUser;
exports.getProjectAccessPerProjectLogs = getProjectAccessPerProjectLogs;
exports.getCompilerActivityPerProjectLogs = getCompilerActivityPerProjectLogs;
exports.getSubmitPerProjectLogs = getSubmitPerProjectLogs;
exports.getCompilationPerDayLogs = getCompilationPerDayLogs; //called for retrieving the user list 
exports.getProjectAccessPerDayLogs = getProjectAccessPerDayLogs;
exports.getProjectAccessLogsPerProject = getProjectAccessLogsPerProject; //user stats accesses for all projects listed
// the functions below are currently not used but might be in the future for a dashboard
exports.getCompilationPerUserAllProjectsLogs = getCompilationPerUserAllProjectsLogs;//called in route for user stats comp runs global time
exports.getProjecAccessPerUserAllProjectsLogs = getProjecAccessPerUserAllProjectsLogs;//called in route for user stats
exports.getCompilationPerUserPerProjectsLogs = getCompilationPerUserPerProjectsLogs;//user stats comp runs per project
exports.getCompilationDetailPerUserPerProjectsLogs = getCompilationDetailPerUserPerProjectsLogs;//user stats comp runs errors per project
exports.getCompilationDetailPerUserPerTimeLogs = getCompilationDetailPerUserPerTimeLogs;//user stats comp runs errors per project

exports.getLogs = getLogs;
exports.getCompilationPerHourLogs = getCompilationPerHourLogs;
exports.getProjectAccessPerUserLogs = getProjectAccessPerUserLogs;
exports.getCompilerActivityPerUserLogs = getCompilerActivityPerUserLogs;
exports.getSubmitPerUserLogs = getSubmitPerUserLogs;
exports.getCompilationsPerLanguage = getCompilationsPerLanguage;
exports.getCompilationsErrors = getCompilationsErrors;
exports.getActiveProjectPerDayLogs = getActiveProjectPerDayLogs;
exports.getPopularProjects = getPopularProjects;
