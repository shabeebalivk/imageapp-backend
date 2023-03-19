const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require('nodemailer');
const { generateApiKey } = require('generate-api-key');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const MONGODB_URL =  "mongodb url here" // MONGOGDB URL SHOULD BE MENTIONED HERE

const User = require("./user");
const Image = require("./image");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('uploads'));

// Set up storage for uploaded images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Create upload middleware using multer
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|jfif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images only!');
    }
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = "testproject";

// Connect to MongoDB
mongoose.connect(MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Error connecting to MongoDB:', err));

// Middleware to authenticate requests using JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err) => {
        if (err) {
            return res.sendStatus(403);
        }
        next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Route to register a new user
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).send("Please provide name, email, and password");
  }
  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).send("User already exists");
    }
    // Hash the password
    const hash = await bcrypt.hash(password, 10);
    // Create a new user
    // Generate and save a new API key for the user
    const apiKey = jwt.sign({ email }, JWT_SECRET, {expiresIn: '1y'});
    // await saveApiKeyToDatabase(email, apiKey);

    // Send an email to the user with the API key

    let testAccount = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
        },
    });
    

    const mailOptions = {
      from: testAccount.user,
      to: email,
      subject: "Your API key",
      text: `Your API key is: ${apiKey}`,
    };

    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.error(error);
        res.status(500).send("Failed to send email");
      } else {
        console.log("Email sent: " + JSON.stringify(info), JSON.stringify(testAccount));
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        user = new User({ name, email, password: hash, apiKey: apiKey });
        await user.save();
        res.sendStatus(201);
      }
    });
   
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

function handleGenerateApiKey() {
    // Generate a random string or use a library like uuid to generate a unique key
    return generateApiKey();
}

// Route to login and get a JWT token
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send("Please provide email and password");
  }
  try {
    // Check if user exists
    const user = await User.findOne({ email });
    console.log(user)
    if (!user) {
      return res.status(401).send("Invalid email or password");
    }
    // Check if password is correct
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).send("Invalid email or password");
    }
    // Generate JWT token and send it to the client
     
    res.json({ token: user.apiKey, userId: user.id });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Route for uploading an image
app.post('/upload', authenticateJWT, upload.single('image'), async (req, res) => {
    console.log('here')
    try {
      // Create new image document and save to database
      console.log(req.body)
      const newImage = new Image({
        user: req.body.userId,
        image: req.file.filename,
        title: req.body.title,
      });
  
      await newImage.save();
  
      res.status(201).send('Image uploaded successfully');
    } catch (error) {
        console.log(error)
        res.status(400).send(error.message);
    }
  });
  
  // Route for retrieving all images
  app.get('/images',  async (req, res) => {
    console.log(req.query)
    const { userId } = req.query
    console.log(userId)
    try {
      // Retrieve all images from database
      const images = await Image.find({user: userId});
  
      res.status(200).send(images);
    } catch (error) {
      res.status(400).send(error.message);
    }
  });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
