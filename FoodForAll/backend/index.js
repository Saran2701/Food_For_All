const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");

const app = express();
const port = 3000;

// Middleware to parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "HelloWorld", // Replace with a strong secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if you're using HTTPS
  })
);

// Connect to MongoDB (adjust the connection string as per your setup)
mongoose
  .connect("mongodb://localhost:27017/login", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define User schema and model
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  address: String,
  phno: String,
});
const User = mongoose.model("User", userSchema);

// Define Donation schema and model with a foodID field
const donationSchema = new mongoose.Schema({
  donorname:String,
  foodID: String,
  foodname: String,
  meal: String,
  category: String,
  quantity: String,
  phoneno: String,
  district: String,
  address: String,
});
const Donation = mongoose.model("Donation", donationSchema);

// Define GetFood schema and model
const getFoodSchema = new mongoose.Schema({
  foodName:String,
  foodID: String,
  name: String,
  phone: String,
  time: String,
  delivery: String,
});

const GetFood = mongoose.model("GetFood", getFoodSchema);

// Generate a unique food ID
async function generateFoodID() {
  const count = await Donation.countDocuments();
  return (count + 1).toString().padStart(2, "0");
}

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public/")));

// Endpoint to handle food requests
app.post("/getfoodform", async (req, res) => {
  const { foodName,name, phone, time, delivery } = req.body;
  const foodID = req.body.foodId; // Retrieve foodId from the submitted form data

  try {
    // Create a new instance of GetFood
    const newGetFood = new GetFood({
      foodName,
      foodID,
      name,
      phone,
      time,
      delivery,
    });

    // Save the new GetFood document to the database
    await newGetFood.save();

    res.send(`
      <script>
          alert('Food request submitted successfully for Food ID: ${foodID}');
          window.location.href = '/index.html'; // Redirect to index page after request
      </script>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const foundUser = await User.findOne({ username, password });
    if (!foundUser) {
      return res.send("Invalid username or password");
    }

    req.session.username = username;

    // Set a cookie with the username
    res.cookie("username", username, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    }); // 1 day expiration

    // Redirect based on role
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

// Handle signup form submission
app.post("/signup", async (req, res) => {
  const { username, password, address, phno } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.send("Username already exists");
    }

    // Create a new user with the specified role
    const newUser = new User({ username, password, address, phno });
    await newUser.save();

    res.send(`
            <script>
                alert('Signup successful');
                window.location.href = '/login.html'; // Redirect to login page
            </script>
        `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

// Handle donation form submission
app.post("/fooddonateform", async (req, res) => {
  const { donorname,foodname, meal, category, quantity, phoneno, district, address } =
    req.body;

  try {
    const foodID = await generateFoodID();
    const newDonation = new Donation({
      donorname,
      foodID,
      foodname,
      meal,
      category,
      quantity,
      phoneno,
      district,
      address,
    });
    await newDonation.save();

    res.send(`
            <script>
                alert('Donation successful with Food ID: ${foodID}');
                window.location.href = '/index.html'; // Redirect to index page after donation
            </script>
        `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

// Endpoint to fetch all donations
app.get("/donations", async (req, res) => {
  try {
    const donations = await Donation.find();
    //res.json(donations); // Send JSON response containing donations data

   

    // Fetch all food IDs from the GetFood collection
    const takenFoods = await GetFood.find({}, 'foodID');

    // Create a set of all taken foodIDs for faster lookup
    const takenFoodIDs = new Set(takenFoods.map(food => food.foodID));

    // Map over the donations to add a 'status' field
    const donationList = donations.map(donation => {
        return {
            ...donation._doc, // Copy all donation fields
            status: takenFoodIDs.has(donation.foodID) ? 'taken' : 'available'
        };
    });

    // Return the updated donation list with status
    res.json(donationList);
  } catch (err) {
    console.error("Error fetching donations:", err);
    res.status(500).send("Internal server error");

  }


});

app.get("/user/:username", async (req, res) => {
  const { username } = req.params;
  try {
      const user = await User.findOne({ username });
      if (user) {
          res.json({
              address: user.address,
              phone: user.phno
          });
      } else {
          res.status(404).json({ message: "User not found" });
      }
  } catch (err) {
      console.error(err);
      res.status(500).send("Internal server error");
  }
});

// Endpoint to fetch donations by username
app.get("/user/:username/donations", async (req, res) => {
  const username = req.params.username;

  try {
    const donations = await Donation.find({ donorname: username });
    res.json(donations); // Send JSON response containing the user's donations
  } catch (err) {
    console.error("Error fetching donations:", err);
    res.status(500).send("Internal server error");
  }
});

// Endpoint to fetch taken foods by username
app.get("/user/:username/takenFoods", async (req, res) => {
  const username = req.params.username;

  try {
    const takenFoods = await GetFood.find({ name: username });
    res.json(takenFoods); // Send JSON response containing the user's taken foods
  } catch (err) {
    console.error("Error fetching taken foods:", err);
    res.status(500).send("Internal server error");
  }
});

// Endpoint to update the status of a food item to "Taken"
// Serve the index page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
