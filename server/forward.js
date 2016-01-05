var request = require('request');

var standardRoles = ['admin', 'user'];

module.exports = function(pattern, host) {
  return function(req, res, next) {
    if (req.url.match(pattern)) {
      var req_method = req.method.toLowerCase();
      if (req_method == 'delete') {
        req_method = 'del';
      }

      var db_path = req.url.match(pattern)[1];
      var dbIndex = db_path.indexOf('/');
      var db = db_path.substr(0, dbIndex);
      var rest = db_path.substr(dbIndex + 1);

      if (db == 'main') {
        // the user doesn't have access to the main database
        // instead, they have access to a role-specific
        // database, which we need to find out.
        // First, we need to find the role of
        // the current user

        var options = {
          url: [host, '_session'].join('/'),
          headers: req.headers,
          json: true,
        };

        request.get(options, function(err, _res, body) {
          if (err) {
            return res.status(500).send(err);
          }

          if (_res.statusCode >= 400) {
            var message = 'session response status code was ' + _res.statusCode;
            if (body) {
              message += '. response was: ' + JSON.stringify(body);
            }
            return res.status(500).send(new Error(message));
          }

          // now we have the session
          var roles = body && body.userCtx && body.userCtx.roles || [];
          if (! roles.length) {
            return res.status(400).send({error: 'No roles for user'});
          }
          var role = roles.filter(isStandardRole)[0];
          if (! role) {
            return res.status(400).send({error: 'No specific role for user'});
          }
          var db = dbNameFromRole(role);
          proceed([db, rest].join('/'));
        });

      } else {
        proceed(db_path);
      }


      function proceed(path) {
        var url = [host, path].join('/');
        req.pipe(request[req_method](url)).pipe(res);
      }
    } else {
      next();
    }
  };
};


function isStandardRole(role) {
  return standardRoles.indexOf(role) == -1;
}

function dbNameFromRole(name) {
  return name && name.replace(/ /g, '-').toLowerCase();
}
