var request = require('request');
var standardRoles = ['admin', 'user'];

module.exports = function(pattern, host) {
  return function(req, res, next) {
    if (req.url.match(pattern)) {
      var req_method = req.method.toLowerCase();
      if (req_method == 'delete') {
        req_method = 'del';
      }

      var path = req.url.match(pattern)[1];
      var urlComponents = path.split('/').filter(nonEmpty);
      var db = urlComponents.shift();
      var rest = urlComponents.join('/');

      pickDatabase(req, db, function(err, database) {
        if (err) {
          return res.status(500).send(err);
        }
        proceed([database, rest].join('/'));
      });

      function proceed(path) {
        var url = [host, path].join('/');
        req.pipe(request[req_method](url)).pipe(res);
      }
    } else {
      next();
    }
  };

  function pickDatabase(req, database, cb) {
    if (database !== 'main') {
      cb(null, database);
    } else {
      // the user doesn't have access to the main database
      // instead, they have access to a role-specific
      // database, which we need to find out.
      // First, we need to find the role of
      // the current user

      getSession(req, function(err, session) {
        if (err) {
          return cb(err);
        }

        var roles = session && session.userCtx && session.userCtx.roles || [];
        if (! roles.length) {
          return cb(new Error('No roles for user'));
        }
        var role = roles.find(isStandardRole);
        if (! role) {
          return cb(new Error('No specific role for user'));
        }
        cb(null, dbNameFromRole(role));
      });
    }
  }

  function getSession(req, cb) {
    var options = {
      url: [host, '_session'].join('/'),
      headers: req.headers,
      json: true,
    };

    request.get(options, function(err, res, body) {
      if (err) {
        return cb(err);
      }

      if (res.statusCode >= 400) {
        var message = 'session response status code was ' + res.statusCode;
        if (body) {
          message += '. response was: ' + JSON.stringify(body);
        }
        return cb(new Error(message));
      }

      cb(null, body);
    });
  }
};

function isStandardRole(role) {
  return standardRoles.indexOf(role) == -1;
}

function dbNameFromRole(name) {
  return name && name.replace(/ /g, '-').toLowerCase();
}

function nonEmpty(str) {
  return str.length > 0;
}