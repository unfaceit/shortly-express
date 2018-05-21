var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
// var cookieParser = require('cookie-parser');
// var cookieSession = require('cookie-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');


var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session( {
  secret: 'justin is blocked',
  cookie: {maxAge: 60000}
}));


var restrict = function(req, res, next) {
  if(req.session.user) {
    next();
  } else {
    req.session.error = "Access Denied!"
    console.log(req.session, ' inside redirect')
    res.redirect('/login')
  }
};

app.get('/', restrict, 
function(req, res) {
  console.log('im inside /', req.session)
  res.render('index');
});

app.get('/create', 
function(req, res) {
  res.render('index');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});


app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/signup', function(req, res){
  res.render('signup');
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login', function(req, res) {
  let loginInfo = req.body.username;
  let loginPassword = req.body.password;

  new User({username: loginInfo, password: loginPassword}).fetch().then(function(found){
    if(found) {
      req.session.regenerate(function() {
      req.session.user = loginInfo;
      console.log('im found!', req.session)
      res.status(200).redirect('/');
      })
    } else {
      console.log('im not found!')
    }
  });
})


app.post('/signup', function(req, res){
  let usernam = req.body.username;
  let psswrd = req.body.password;

  new User({username: usernam, password: psswrd}).fetch().then(function(found){
    if(found) {
      // res.status(200).redirect('/login');
      res.jsonp(usernam + ' is taken');
    } else {
      Users.create({
        username: usernam,
        password: psswrd
      }).then(function(usernam) {
        req.session.user = usernam;
        res.status(201).redirect('/login');
      })
    }
  })
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
