var express = require('express');
var app = express();
var sqlite3 = require('sqlite3');
var port = 3000;
var passwordHash = require('password-hash');
var cookieParser = require('cookie-parser');
app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.set("view options", { layout: false });
var db = new sqlite3.Database('formmanager.db');
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
// Login/Register page at localhost:3000/
app.get('/', function (req, res) {
    res.render('login', { loginmsg: "", regmsg: "" });
});
// Enabling server to listen at port 3000
app.listen(port, function () {
    console.log("Listening on port " + port);
});
var title, descrip;
// Enabling CORS
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
var user;
// Registering new users
app.post('/register', function (req, res) {
    console.log("new user " + req.body.username);
    db.all('SELECT * from Auth  where Username=$user',
        {
            $user: req.body.username
        },
        function (err, rows) {
            console.log(rows);
            if (rows.length > 0) {
                console.log("User already exists");
                res.render('login', { loginmsg: "", regmsg: "Username already taken" });
            }
            else {
                db.run('INSERT into Auth (Username,Password) VALUES (?,?)', [req.body.username, passwordHash.generate(req.body.password)], function (err) {
                    if (err)
                        console.log(err.message);
                    else {
                        console.log("User added");
                        user = req.body.username;
                        res.cookie("username", user);
                        res.render('makeform', { titlemsg: "", inpfields: [], title: "", desc: ""});
                       // afterlogin(req, res);
                    }
                });
            }
        });
});
// Check login data
app.post('/login', function (req, res) {
    db.get('SELECT Password from Auth  where Username=$user',
        {
            $user: req.body.username
        },
        function (err, rows) {
            console.log(rows);
            console.log(req.body.username);
            //  console.log(rows.Password);
            if (passwordHash.verify(req.body.password, rows.Password)) {
                console.log("Login Successful");
                user = req.body.username;
                res.cookie("username", user);
                res.render('makeform', { titlemsg: "", inpfields: [],title: "",desc: ""});
            }
            else {
                console.log("fail");
                res.render('login', { loginmsg: "Incorrect username/password", regmsg: "" });
            }
        });
});
// Adding title and description
app.post('/addtitle', function (req, res) {
    
    db.run("INSERT INTO Formstruct (Username,Title,Desc) values (?,?,?)", [user, req.body.title, req.body.desc], function (err, rows) {
        if (err)
            console.log(err.message);
        else {
            console.log("tite desc added");
            res.cookie("title", req.body.title);
            res.cookie("desc", req.body.desc);
            title = req.body.title;
            descrip = req.body.desc;
            res.render('makeformbody', { inpmsg : "", titlemsg: "Title and Desc added ", url: "", urlmsg: "Your link will come here", inpfields: [], title: title, desc: descrip });
        }
    });
});
// Adding the form input fields
app.post('/adding', function (req,res) {
    var field = req.body.fieldname;
    var title = req.cookies.title;
    var descrip = req.cookies.desc;
    
    db.run("INSERT INTO Formstruct (Username,Title,Fields) values (?,?,?)", [user, title, field], function (err, rows) {
        if (err)
            console.log(err.message);
        else {
            console.log("field added");
            db.all('SELECT Title,Desc,Fields from Formstruct where Username=$un AND Fields IS NOT NULL AND Title = $title', { $un: user , $title:title}, function (err, rows) {
                if (err)
                    console.log(err.message);
                else {
                    // list = rows;
                    console.log(rows);
                    res.render('makeformbody', { inpmsg: "Field added", titlemsg: "", urlmsg:"Your link will come here",inpfields: rows, title: title, desc: descrip ,url:""});
                }
            });
        }
    });
});
var ctr = 0;
// Logout function
app.get("/logout", function (req, res) {
    res.render('login', { loginmsg: "", regmsg: "" });
    res.clearCookie("title");
    res.clearCookie("desc");
    res.clearCookie("username");
});
// Link generator
app.get("/generate", function (req,res) {
    let baseurl = " http://localhost:3000/";
    baseurl = baseurl.concat(user, "/");
    baseurl = baseurl.concat(title, "/");
    if(title && user)
    res.render('makeformbody', { inpmsg: "", titlemsg: "", urlmsg: baseurl ,inpfields: [], title: title, desc: descrip, url: baseurl });
})
app.get("/addtitle", function (req, res) {
    res.render('makeformbody', { inpmsg: "", titlemsg: "", urlmsg: "Your link will come here", inpfields: [], title: title, desc: descrip, url: "" });
})
var description;
var form = [];
app.get("/:user/:title", function (req, res) {
    console.log("link user "+req.params.user);
    console.log("link title " + req.params.title);
    res.cookie("user", req.params.user);
    res.cookie("title", req.params.title);
    db.all('SELECT Fields FROM Formstruct where Username=$us AND Title=$tle AND Fields IS NOT NULL', {
        $us: req.params.user,
        $tle: req.params.title
    },
        function (err,rows) {
            if (err) {
                console.log("error in getting fields from formstruct");
                console.log(err.message);
            }
            else {
                console.log(rows);
                form = rows;
                ctr = form.length;
                db.get('SELECT Desc from formstruct where USername=$us AND Title=$tle and Desc IS NOT NULL', {
                    $us: req.params.user,
                    $tle: req.params.title
                },
                    function (err, rows) {
                        if (err) {
                            console.log(err.message);
                        }
                        else {
                            description = rows.Desc;
                            res.render("formfill", { formfields: form, title: req.params.title, desc: description, submsg: "" });
                        }
                    });
                
                    }
        });
});
//  To fill responses in the form
app.post("/respost", function (req, res) {
    console.log(req.body);
    console.log(req.body.id.length);
    var username = req.cookies.user;
    var titleform = req.cookies.title;
    var response = "";
    if (ctr > 1)
        for (var i = 0; i < req.body.id.length; i++) {
            response = response.concat(req.body.id[i], "     ");
            console.log("in for loop");
        }
    else
        response = req.body.id;
    console.log(response);
    db.run('INSERT INTO Response values (?,?,?)', [username, titleform, response], function (err) {
        if (err) {
            console.log(err.message);
            res.render("formfill", { formfields: form, title: req.params.title, desc: description, submsg: "Failed to Submit Response" });
        }
        else {
            console.log("success");
            res.render("formfill", { formfields: form, title: titleform, desc: description, submsg: "Response submitted successfully" });
        }
    });
});
// For user to check responses
app.get('/checkres', function (req, res) {
    res.render('responses', { fields:[],formres: [], title: "", titlemsg: "" });
    
});
app.post('/checkres', function (req, res) {
    var inp=[];
    db.all('SELECT Resp from response where Username=$un AND Title=$title', { $un: user, $title: req.body.title }, function (err, rows) {
        if (err) {
            console.log(err.message);
        }
        else {
            inp = rows;
            if (rows.length > 0) {
                db.all('SELECT Fields FROM Formstruct where Username=$us AND Title=$tle AND Fields IS NOT NULL', {
                    $us: user,
                    $tle: req.body.title
                },
                    function (err, rows) {
                        if (err) {
                            console.log(err.message);
                        }
                        else {
                            res.render('responses', { fields:rows, formres: inp, title: req.body.title, titlemsg: "" });
                            console.log("inp is",inp);
                        }
                    }); 
            }
            else
                res.render('responses', { fields:[],formres: [], title:"" , titlemsg: "INVALID Title / No Responses Yet" });
        }
    });
});
app.get('/home', function (req, res) {
    res.render('makeform', { titlemsg: "", inpfields: [], title: "", desc: "" });
});