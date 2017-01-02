
var common = {};

common.cleanString = function(ugly) {
    if(!ugly) return "";
    var step1 = ugly.replace(/^[^-_a-zA-Z]+/, '').replace(/^-(?:[-0-9]+)/, '-');
    var step2 = step1 && step1.replace(/[^-_a-zA-Z0-9]+/g, '-');
    var step3 = step2.replace(/-/g, '_');
    return step3;
}

common.logIt = function(message, cb) {
  console.log(message);
  cb("logged: " + message);
}

module.exports = common;
