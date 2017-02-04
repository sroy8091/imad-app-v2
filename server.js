var express = require('express');
var morgan = require('morgan');
var path = require('path');
// var Pool = require('pg').Pool;
// var crypto = require('crypto');
// var bodyParser = require('body-parser');
// var session = require('express-session');

// var pool = new Pool({
//   user: 'sroy8091',
//   password: process.env.DB_PASSWORD,
//   host: 'db.imad.hasura-app.io',
//   database: 'sroy8091',
//   max: 10, // max number of clients in pool
//   idleTimeoutMillis: 1000, // close & remove clients which have been idle > 1 second
//   port: '5432'
// });

var app = express();
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(session({
  secret : 'SomeReallyShittyCode',
  cookie : {maxAge:1000*60*60*24*30},
}));


var counter = 0;
// var pool = new Pool(config)

function createTemplate (data) {
    var title = data.title;
    var date = data.date;
    var heading = data.heading;
    var content = data.content;
    
    var htmlTemplate = `
    <html>
      <head>
          <title>
              ${title}
          </title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link href="https://fonts.googleapis.com/css?family=Open+Sans|Roboto" rel="stylesheet">
          <link href="/ui/style.css" rel="stylesheet" />
      </head> 
      <body>
          <div class="background-image"></div>
          <div class="container content">
              <div>
                  <a href="/">Home</a>
              </div>
              <hr/>
              <h3>
                  ${heading}
              </h3>
              <div>
              <p>
                  When it happened:  ${date.toDateString()}
                  </p>
              </div>
              <div>
              <p>
                What happened: ${content}
                </p>
              </div>
              <hr/>
              <h4>Comments</h4>
              <div id="comment_form">
              </div>
              <div id="comments">
                <center>Loading comments...</center>
              </div>
          </div>
          <script type="text/javascript" src="/ui/article.js"></script>
      </body>
    </html>
    `;
    return htmlTemplate;
}

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

app.get('/counter', function(req, res){
    counter = counter + 1;
    res.send(counter.toString());
});

function hash(input, salt){
  var hashed = crypto.pbkdf2Sync(input, salt, 10000, 512, 'sha512');
  return [salt, hashed.toString('hex')].join('$');
}

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

app.get('/hash/:input', function(req, res){
  var hashedString = hash(req.params.input, 'This-is-somesalt');
  res.send(hashedString);
});

app.post('/create-user', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  var email = req.body.email;
  var name = req.body.name;
  var salt = crypto.randomBytes(128).toString('hex');
  var dbString = hash(password, salt);
  pool.query('SELECT * FROM "user" WHERE username = $1', [username], function (err, result) {
        if (err) {
          res.status(500).send(err.toString());
        } 
        else if(result.rows.length === 0) {
            pool.query('INSERT INTO "user" (username, password) VALUES ($1, $2)', [username, dbString], function(err, result){
              if (err){
                res.status(500).send(err.toString());
              }
              else{
                res.send("User Successfully created "+username);
              }
            });
        }
        else{
          res.status(409).send("username already exists.");
        } 
  });
});



app.post('/login', function (req, res) {
   var username = req.body.username;
   var password = req.body.password;
   
   pool.query('SELECT * FROM "user" WHERE username = $1', [username], function (err, result) {
      if (err) {
          res.status(500).send(err.toString());
      } else {
          if (result.rows.length === 0) {
              res.status(403).send('username/password is invalid');
          } else {
              // Match the password
              var dbString = result.rows[0].password;
              var salt = dbString.split('$')[0];
              var hashedPassword = hash(password, salt); // Creating a hash based on the password submitted and the original salt
              if (hashedPassword === dbString) {
                
                // Set the session
                req.session.auth = {userId: result.rows[0].id};
                // set cookie with a session id
                // internally, on the server side, it maps the session id to an object
                // { auth: {userId }}
                
                res.send('credentials correct!');
                
              } else {
                res.status(403).send('username/password is invalid');
              }
          }
      }
   });
});

app.get('/check-login', function (req, res) {
   if (req.session && req.session.auth && req.session.auth.userId) {
       // Load the user object
       pool.query('SELECT * FROM "user" WHERE id = $1', [req.session.auth.userId], function (err, result) {
           if (err) {
              res.status(500).send(err.toString());
           } else {
              res.send(result.rows[0].username);    
           }
       });
   } else {
       res.status(400).send('You are not logged in');
   }
});

function logout(){
    var template = `<a href="/">Home</a>
    <hr>
    <h3>Logged out Successfully</h3>
    `;
    return template;
}

app.get('/logout', function(req, res){
    delete req.session.auth;
    res.send(logout());
});

// app.get('/articles/:articleName', function (req, res) {
//     pool.query("SELECT * FROM article where title=$1", [req.params.articleName], function(err, result){
//       if (err){
//         res.status(500).send(err.toString());
//       }
//       else{
//         if (result.rows.length===0){
//           res.status(404).send('Article not found');
//         }
//         else{
//           var articleData = result.rows[0];
//           res.send(createTemplate(articleData));
//         }
//       }
//   });
// });

var names = [];
app.get('/submit-name', function(req, res){ //url=submit-name?name=xxxx
    //for params url app.get('submit-name/:name') and req.params.name
    var name = req.query.name;
    names.push(name);
    res.send(JSON.stringify(names));
});

app.get('/blog', function(req, res){
  res.sendFile(path.join(__dirname, 'ui', 'blog.html'));
});

app.get('/ui/style.css', function (req, res) {
  res.sendFile(path.join(__dirname, 'ui', 'style.css'));
});

app.get('/favicon.ico', function (req, res) {
  res.sendFile(path.join(__dirname, 'ui', 'favicon.jpg'));
});

app.get('/ui/main.js', function (req, res) {
  res.sendFile(path.join(__dirname, 'ui', 'main.js'));
});

app.get('/ui/article.js', function(req, res){
    res.sendFile(path.join(__dirname, 'ui', 'article.js'));
});


app.get('/get-articles', function (req, res) {
   // make a select request
   // return a response with the results
   pool.query('SELECT * FROM article ORDER BY date DESC', function (err, result) {
      if (err) {
          res.status(500).send(err.toString());
      } else {
          res.send(JSON.stringify(result.rows));
      }
   });
});

app.get('/get-comments/:articleName', function (req, res) {
   // make a select request
   // return a response with the results
   pool.query('SELECT comment.*, "user".username FROM article, comment, "user" WHERE article.title = $1 AND article.id = comment.article_id AND comment.user_id = "user".id ORDER BY comment.timestamp DESC', [req.params.articleName], function (err, result) {
      if (err) {
          res.status(500).send(err.toString());
      } else {
          res.send(JSON.stringify(result.rows));
      }
   });
});

app.post('/submit-comment/:articleName', function (req, res) {
   // Check if the user is logged in
    if (req.session && req.session.auth && req.session.auth.userId) {
        // First check if the article exists and get the article-id
        pool.query('SELECT * from article where title = $1', [req.params.articleName], function (err, result) {
            if (err) {
                res.status(500).send(err.toString());
            } else {
                if (result.rows.length === 0) {
                    res.status(400).send('Article not found');
                } else {
                    var articleId = result.rows[0].id;
                    // Now insert the right comment for this article
                    pool.query(
                        "INSERT INTO comment (comment, article_id, user_id) VALUES ($1, $2, $3)",
                        [req.body.comment, articleId, req.session.auth.userId],
                        function (err, result) {
                            if (err) {
                                res.status(500).send(err.toString()+'insert');
                            } else {
                                res.status(200).send('Comment inserted!')
                            }
                        });
                }
            }
       });     
    } else {
        res.status(403).send('Only logged in users can comment');
    }
});

app.get('/articles/:articleName', function (req, res) {
  // SELECT * FROM article WHERE title = '\'; DELETE WHERE a = \'asdf'
  pool.query("SELECT * FROM article WHERE title = $1", [req.params.articleName], function (err, result) {
    if (err) {
        res.status(500).send(err.toString());
    } else {
        if (result.rows.length === 0) {
            res.status(404).send('Article not found');
        } else {
            var articleData = result.rows[0];
            res.send(createTemplate(articleData));
        }
    }
  });
});

// var port = 8080; // Use 8080 for local development because you might already have apache running on 80
// app.listen(8080, function () {
//   console.log(`IMAD course app listening on port ${port}!`);
// });
app.set('port', process.env.PORT || 8080);
app.listen(app.get('port'), function(){
  console.log("IMAD course app listening on port "+app.get('port')+" !");
});